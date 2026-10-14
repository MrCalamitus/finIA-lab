// US3: borrado lógico de un movimiento vigente (FR-011, FR-012).
import { resolverObjetivo } from './objetivo.ts';
import { borrado, citaAmbigua, sinCoincidencia } from './respuestas.ts';
import { rechazo, type FuncionAccion } from './tipos.ts';

export const borrar: FuncionAccion = ({ repo, mensaje, interpretacion, ahora }) => {
  const objetivo = resolverObjetivo(repo, mensaje.citadoId, interpretacion.pista);
  if (objetivo.tipo === 'ninguno') return rechazo(sinCoincidencia('borrar'));
  if (objetivo.tipo === 'ambiguo') return rechazo(citaAmbigua(objetivo.movimientos));
  repo.marcarBorrado(objetivo.movimiento.id, mensaje.id);
  return { resultado: 'borrado', respuesta: borrado(objetivo.movimiento, ahora) };
};
