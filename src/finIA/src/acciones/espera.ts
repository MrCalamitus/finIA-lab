// Una sola espera activa (research R7 de la 002). Cada mensaje se ofrece primero a la espera:
// si la responde, se resuelve y el mensaje termina ahí; si no, la espera se cancela (con aviso
// cuando corresponde) y el mensaje sigue el flujo normal. Debe llamarse dentro de una transacción.
import type { Espera, Repositorio, TipoEspera } from '../almacen/repositorio.ts';
import type { MensajeEntrante } from '../tipos.ts';
import { resolverRegistroPendiente } from './confirmar.ts';
import type { ResultadoAccion } from './tipos.ts';

export interface ContextoEspera {
  repo: Repositorio;
  mensaje: MensajeEntrante & { texto: string };
  ahora: Date;
}

export type ResolucionEspera =
  | { tipo: 'sin_espera' }
  /** El mensaje respondió a la espera: se responde `resultado` y no se procesa más. */
  | { tipo: 'resuelta'; resultado: ResultadoAccion }
  /** El mensaje no la respondió: se envía `aviso` (si hay) y el mensaje sigue el flujo normal. */
  | { tipo: 'cancelada'; aviso: string | null };

export type ManejadorEspera = (ctx: ContextoEspera, espera: Espera) => ResolucionEspera;

const MANEJADORES: Partial<Record<TipoEspera, ManejadorEspera>> = {
  registro_pendiente: resolverRegistroPendiente,
};

/** Registra manejadores de otros módulos (configuración, tickets) sin dependencias circulares. */
export function registrarManejadorEspera(tipo: TipoEspera, manejador: ManejadorEspera): void {
  MANEJADORES[tipo] = manejador;
}

export function resolverEspera(ctx: ContextoEspera): ResolucionEspera {
  const espera = ctx.repo.espera();
  if (!espera) return { tipo: 'sin_espera' };
  const manejador = MANEJADORES[espera.tipo];
  if (!manejador) {
    ctx.repo.cancelarEspera();
    return { tipo: 'cancelada', aviso: null };
  }
  return manejador(ctx, espera);
}
