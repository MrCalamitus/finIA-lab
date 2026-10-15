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

/** Bytes mínimos de un JPEG (los "números mágicos" bastan para la validación). */
export const FOTO_JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

export interface OpcionesMensaje {
  /** Adjunta una foto JPEG válida (o la dada). */
  foto?: boolean | Uint8Array;
  imagenRechazada?: boolean;
  id?: string;
  citadoId?: string | null;
  enviadoEn?: Date;
  fromMe?: boolean;
  remoteJid?: string;
}

export function crearEntorno(
  opciones: {
    programa?: Parameters<typeof crearInterpreteFalso>[0];
    ahora?: Date;
    /** Estado de la configuración del dueño (002). Por defecto, ya configurado. */
    configuracion?: 'pendiente' | 'pausada' | 'completa';
  } = {},
) {
  let ahora = opciones.ahora ?? AHORA;
  const reloj = () => ahora;
  const db = abrirBaseDeDatos(':memory:', ahora);
  const repo = crearRepositorio(db);
  repo.fijarEstadoConfiguracion(opciones.configuracion ?? 'completa');
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
      ...(o.foto ? { imagen: { mime: 'image/jpeg' as const, bytes: o.foto === true ? FOTO_JPEG : o.foto } } : {}),
      ...(o.imagenRechazada ? { imagen: null, imagenRechazada: true } : {}),
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
          // Un pendiente siempre va con su espera, como lo deja `registrar` (002).
          if (m.estado === 'pendiente') repo.crearEspera('registro_pendiente', mensajeId);
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

/** Salida del intérprete de tickets para un ticket de prueba (contracts/ticket.md de la 002). */
export function salidaTicket(
  articulos: [descripcion: string, importe: string, categoria?: string, cantidad?: string | null, descuento?: string | null][],
  total: string | null,
  cambios: Record<string, unknown> = {},
) {
  return {
    es_ticket: true,
    comercio: 'Super La Esquina',
    fecha: '2026-10-12',
    total_texto: total,
    articulos: articulos.map(([descripcion, importe, categoria = 'Comida', cantidad = null, descuento = null]) => ({
      descripcion,
      cantidad,
      importe_texto: importe,
      descuento_texto: descuento,
      categoria,
    })),
    ...cambios,
  };
}
