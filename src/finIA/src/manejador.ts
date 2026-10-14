// Orquesta cada mensaje: filtro → idempotencia → antigüedad → pendiente → intérprete →
// validación → acción → respuesta. Todo ocurre en una cola en serie (research R10): un mensaje
// a la vez, en orden de llegada.
import type { Repositorio } from './almacen/repositorio.ts';
import { clasificar } from './canal/filtro.ts';
import { resolverPendiente } from './acciones/confirmar.ts';
import { despachar } from './acciones/despachador.ts';
import { antiguosIgnorados, TEXTOS } from './acciones/respuestas.ts';
import type { ResultadoAccion } from './acciones/tipos.ts';
import { validarInterpretacion } from './interprete/esquema.ts';
import { crearLogger, type Logger } from './logger.ts';
import { ErrorInterpreteNoDisponible, type Canal, type Interprete, type MensajeEntrante } from './tipos.ts';

/** FR-020: al volver a encender solo se procesan los mensajes de las últimas 24 h. */
export const MAX_ANTIGUEDAD_MS = 24 * 60 * 60 * 1000;

export interface DependenciasManejador {
  repo: Repositorio;
  interprete: Interprete;
  canal: Canal;
  grupoJid: string;
  reloj?: () => Date;
  logger?: Logger;
  reintentos?: { intentos: number; esperaMs: number };
}

export interface Manejador {
  /** Encola un mensaje. No espera a que se procese. */
  recibir(mensaje: MensajeEntrante): void;
  /** Se resuelve cuando la cola queda vacía (incluye mensajes encolados mientras tanto). */
  ocioso(): Promise<void>;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

export function crearManejador(deps: DependenciasManejador): Manejador {
  const { repo, interprete, canal, grupoJid } = deps;
  const reloj = deps.reloj ?? (() => new Date());
  const logger = deps.logger ?? crearLogger('error', () => {});
  const reintentos = deps.reintentos ?? { intentos: 3, esperaMs: 1000 };
  let cola: Promise<void> = Promise.resolve();
  let enCola = 0;
  let antiguos = 0;

  /** Constitución II: si el envío falla se reintenta; si nunca sale, queda en el log. */
  async function enviar(texto: string): Promise<string | null> {
    for (let intento = 1; intento <= reintentos.intentos; intento++) {
      try {
        return await canal.enviar(texto);
      } catch (error) {
        logger.warn('envio_fallido', { intento, error });
        if (intento < reintentos.intentos) await esperar(reintentos.esperaMs);
      }
    }
    logger.error('envio_abandonado', { intentos: reintentos.intentos });
    return null;
  }

  /**
   * Envía la respuesta y guarda su id para no procesarla como mensaje nuevo (FR-014). Si la
   * respuesta confirma movimientos, les asigna ese id para poder citarla al corregir (FR-011).
   */
  async function responder(texto: string, confirmar: number[] = []): Promise<void> {
    const id = await enviar(texto);
    if (id === null) return;
    repo.guardarEnviado(id);
    if (confirmar.length > 0) repo.asignarConfirmacion(confirmar, id);
  }

  async function rechazar(mensaje: MensajeEntrante, texto: string): Promise<void> {
    repo.marcarProcesado(mensaje.id, mensaje.enviadoEn, 'rechazado');
    await responder(texto);
  }

  async function procesar(mensaje: MensajeEntrante): Promise<void> {
    // El filtro corre dentro de la cola: así el eco de una respuesta se evalúa después de
    // haber guardado su id, aunque WhatsApp lo entregue antes de terminar el envío.
    const clase = clasificar(mensaje, grupoJid, repo.esEnviado);
    if (clase === 'ignorar') return;
    if (repo.yaProcesado(mensaje.id)) return;

    // Historial anterior a instalar el asistente: se ignora sin aviso (research R4).
    if (mensaje.enviadoEn < repo.primerArranque()) return;
    if (reloj().getTime() - mensaje.enviadoEn.getTime() > MAX_ANTIGUEDAD_MS) {
      repo.marcarProcesado(mensaje.id, mensaje.enviadoEn, 'ignorado_antiguo');
      antiguos++;
      return;
    }

    logger.info('mensaje', { id: mensaje.id, texto: logger.textoSeguro(mensaje.texto) });
    const texto = mensaje.texto as string;

    // FR-005a: si hay un pendiente, este mensaje lo confirma o lo descarta.
    const resolucion = repo.transaccion(() => {
      const r = resolverPendiente(repo, { id: mensaje.id, texto }, reloj());
      if (r.tipo === 'confirmado') repo.marcarProcesado(mensaje.id, mensaje.enviadoEn, 'confirmado');
      return r;
    });
    if (resolucion.tipo === 'confirmado') {
      return responder(resolucion.resultado.respuesta, resolucion.resultado.confirmar);
    }
    if (resolucion.tipo === 'descartado') {
      // El aviso sale y el mensaje sigue su camino: no se pierde (spec FR-005a).
      await responder(resolucion.aviso);
    }

    if (clase === 'muy_largo') return rechazar(mensaje, TEXTOS.muyLargo);

    let propuesta: unknown;
    try {
      propuesta = await interprete.interpretar(texto, mensaje.enviadoEn);
    } catch (error) {
      const esperado = error instanceof ErrorInterpreteNoDisponible;
      logger[esperado ? 'warn' : 'error']('interprete_no_disponible', { error });
      return rechazar(mensaje, TEXTOS.noDisponible);
    }

    const validacion = validarInterpretacion(propuesta);
    if (!validacion.ok || validacion.valor.accion === 'no_entendido') {
      logger.info('no_entendido', { id: mensaje.id, esquemaValido: validacion.ok });
      return rechazar(mensaje, TEXTOS.noEntendido);
    }

    let resultado: ResultadoAccion;
    try {
      resultado = repo.transaccion(() => {
        const r = despachar({
          repo,
          mensaje: { ...mensaje, texto },
          interpretacion: validacion.valor,
          ahora: reloj(),
        });
        repo.marcarProcesado(mensaje.id, mensaje.enviadoEn, r.resultado);
        return r;
      });
    } catch (error) {
      logger.error('accion_fallida', { id: mensaje.id, error });
      return rechazar(mensaje, TEXTOS.errorInterno);
    }
    logger.info('procesado', { id: mensaje.id, accion: validacion.valor.accion, resultado: resultado.resultado });
    await responder(resultado.respuesta, resultado.confirmar);
  }

  /** Al vaciarse la cola, un solo aviso con los mensajes antiguos ignorados (FR-020). */
  async function avisarAntiguos(): Promise<void> {
    if (antiguos === 0) return;
    const cantidad = antiguos;
    antiguos = 0;
    await responder(antiguosIgnorados(cantidad));
  }

  return {
    recibir(mensaje) {
      enCola++;
      cola = cola
        .then(() => procesar(mensaje))
        .catch((error: unknown) => logger.error('procesamiento_fallido', { id: mensaje.id, error }))
        .then(() => {
          enCola--;
          if (enCola === 0) return avisarAntiguos();
        })
        .catch((error: unknown) => logger.error('aviso_fallido', { error }));
    },
    async ocioso() {
      let actual: Promise<void>;
      do {
        actual = cola;
        await actual;
      } while (actual !== cola);
    },
  };
}
