// FR-005a (001): la confirmación de un pendiente la decide el código con una lista fija, nunca el
// modelo (research R6 de la 001). Así ningún texto puede "convencer" al sistema de confirmar algo.
// Desde la 002 el pendiente es una espera de tipo `registro_pendiente`.
import { pendienteDescartado, registrado } from './respuestas.ts';
import type { ManejadorEspera } from './espera.ts';

const AFIRMATIVOS = new Set(['sí', 'si', 'confirmo']);

export function esAfirmativo(texto: string): boolean {
  const normalizado = texto
    .trim()
    .toLowerCase()
    .replace(/^[¡¿\s]+/, '')
    .replace(/[.!?¡¿\s]+$/, '');
  return AFIRMATIVOS.has(normalizado);
}

/** Espera `registro_pendiente`: un afirmativo exacto confirma; cualquier otra cosa descarta. */
export const resolverRegistroPendiente: ManejadorEspera = ({ repo, mensaje, ahora }) => {
  repo.cancelarEspera();
  if (!repo.pendienteActual()) return { tipo: 'cancelada', aviso: null };

  if (esAfirmativo(mensaje.texto)) {
    const movimientos = repo.resolverPendientes('vigente', mensaje.id);
    return {
      tipo: 'resuelta',
      resultado: {
        resultado: 'confirmado',
        respuesta: registrado(movimientos, ahora),
        confirmar: movimientos.map((m) => m.id),
      },
    };
  }
  const movimientos = repo.resolverPendientes('descartado', mensaje.id);
  return { tipo: 'cancelada', aviso: pendienteDescartado(movimientos) };
};
