import { abrirBaseDeDatos } from '../../src/almacen/db.ts';
import { crearRepositorio } from '../../src/almacen/repositorio.ts';
import { crearManejador } from '../../src/manejador.ts';
import type { MensajeEntrante } from '../../src/tipos.ts';
import { crearInterpreteFalso } from './interprete-falso.ts';
import { crearCanalFalso } from './canal-falso.ts';

export const GRUPO = '120363000000000000@g.us';
/** Martes 13 de octubre de 2026, 12:00 hora local. */
export const AHORA = new Date(2026, 9, 13, 12, 0, 0);

export interface Sembrado {
  tipo: 'gasto' | 'ingreso';
  centavos: number;
  categoria: string;
  fecha?: string;
  estado?: 'pendiente' | 'vigente' | 'borrado' | 'descartado';
  confirmacion?: string;
  texto?: string;
}

export interface OpcionesMensaje {
  id?: string;
  citadoId?: string | null;
  enviadoEn?: Date;
  fromMe?: boolean;
  remoteJid?: string;
}

export function crearEntorno(opciones: { programa?: Parameters<typeof crearInterpreteFalso>[0]; ahora?: Date } = {}) {
  let ahora = opciones.ahora ?? AHORA;
  const reloj = () => ahora;
  const db = abrirBaseDeDatos(':memory:', ahora);
  const repo = crearRepositorio(db);
  const interprete = crearInterpreteFalso(opciones.programa ?? {});
  const canal = crearCanalFalso(GRUPO, reloj);
  const manejador = crearManejador({
    repo,
    interprete,
    canal,
    grupoJid: GRUPO,
    reloj,
    reintentos: { intentos: 3, esperaMs: 0 },
  });
  let contador = 0;

  function mensaje(texto: string | null, o: OpcionesMensaje = {}): MensajeEntrante {
    contador++;
    const remoteJid = o.remoteJid ?? GRUPO;
    return {
      id: o.id ?? `${remoteJid}:usr-${contador}`,
      remoteJid,
      fromMe: o.fromMe ?? true,
      texto,
      citadoId: o.citadoId ?? null,
      enviadoEn: o.enviadoEn ?? ahora,
    };
  }

  /** Entrega un mensaje, espera a que la cola se vacíe y devuelve las respuestas nuevas. */
  async function escribir(texto: string | null, o: OpcionesMensaje = {}): Promise<string[]> {
    return entregar(mensaje(texto, o));
  }

  async function entregar(m: MensajeEntrante): Promise<string[]> {
    const antes = canal.enviados.length;
    manejador.recibir(m);
    await manejador.ocioso();
    return canal.enviados.slice(antes).map((e) => e.texto);
  }

  return {
    db,
    repo,
    interprete,
    canal,
    manejador,
    mensaje,
    escribir,
    entregar,
    reloj,
    fijarAhora(fecha: Date) {
      ahora = fecha;
    },
    /**
     * Siembra movimientos directo en la base (sin intérprete), uno por mensaje. Devuelve sus ids.
     * Si se da `confirmacion`, se asigna como id de la respuesta que los confirmó.
     */
    sembrar(movimientos: Sembrado[]): number[] {
      return repo.transaccion(() =>
        movimientos.map((m) => {
          contador++;
          const mensajeId = `${GRUPO}:semilla-${contador}`;
          repo.marcarProcesado(mensajeId, ahora, 'registrado');
          const [id] = repo.insertarMovimientos(
            mensajeId,
            m.texto ?? 'sembrado',
            [{ tipo: m.tipo, montoCentavos: m.centavos, categoria: m.categoria, fecha: m.fecha ?? '2026-10-13' }],
            'vigente',
          );
          if (m.estado && m.estado !== 'vigente') {
            db.prepare('UPDATE movimientos SET estado = ? WHERE id = ?').run(m.estado, id!);
          }
          if (m.confirmacion) repo.asignarConfirmacion([id!], m.confirmacion);
          return id!;
        }),
      );
    },
    /** Id del último mensaje enviado por el asistente (para citarlo). */
    idUltimaRespuesta() {
      return canal.enviados.at(-1)?.id ?? null;
    },
    filas<T = Record<string, unknown>>(sql: string, ...params: (string | number)[]) {
      // node:sqlite devuelve objetos sin prototipo; se copian para compararlos con deepEqual.
      return db.prepare(sql).all(...params).map((fila) => ({ ...fila })) as T[];
    },
  };
}

export const mov = (
  tipo: 'gasto' | 'ingreso',
  monto_texto: string,
  categoria: string,
  fecha = '2026-10-13',
) => ({ tipo, monto_texto, categoria, fecha });
