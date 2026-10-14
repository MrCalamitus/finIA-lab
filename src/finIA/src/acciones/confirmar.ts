// FR-005a: la confirmación de un pendiente la decide el código con una lista fija, nunca el
// modelo (research R6). Así ningún texto puede "convencer" al sistema de confirmar algo.
import type { Movimiento, Repositorio } from '../almacen/repositorio.ts';
import type { ResultadoAccion } from './tipos.ts';
import { pendienteDescartado, registrado } from './respuestas.ts';

const AFIRMATIVOS = new Set(['sí', 'si', 'confirmo']);

export function esAfirmativo(texto: string): boolean {
  const normalizado = texto
    .trim()
    .toLowerCase()
    .replace(/^[¡¿\s]+/, '')
    .replace(/[.!?¡¿\s]+$/, '');
  return AFIRMATIVOS.has(normalizado);
}

export type ResolucionPendiente =
  | { tipo: 'sin_pendiente' }
  | { tipo: 'confirmado'; resultado: ResultadoAccion }
  | { tipo: 'descartado'; aviso: string; movimientos: Movimiento[] };

/**
 * Si hay un pendiente, el mensaje lo confirma (afirmativo exacto) o lo descarta (cualquier otra
 * cosa). Debe llamarse dentro de una transacción.
 */
export function resolverPendiente(
  repo: Repositorio,
  mensaje: { id: string; texto: string },
  ahora: Date,
): ResolucionPendiente {
  const pendiente = repo.pendienteActual();
  if (!pendiente) return { tipo: 'sin_pendiente' };

  if (esAfirmativo(mensaje.texto)) {
    const movimientos = repo.resolverPendientes('vigente', mensaje.id);
    return {
      tipo: 'confirmado',
      resultado: {
        resultado: 'confirmado',
        respuesta: registrado(movimientos, ahora),
        confirmar: movimientos.map((m) => m.id),
      },
    };
  }
  const movimientos = repo.resolverPendientes('descartado', mensaje.id);
  return { tipo: 'descartado', aviso: pendienteDescartado(movimientos), movimientos };
}
