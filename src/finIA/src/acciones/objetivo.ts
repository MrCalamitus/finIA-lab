// FR-011 (contracts/interpretacion.md, regla 6): corregir y borrar afectan exactamente un
// movimiento vigente: el de la confirmación citada o, sin cita, el último registrado.
import type { Movimiento, Repositorio } from '../almacen/repositorio.ts';
import { parsearMonto } from '../dominio/dinero.ts';
import type { Interpretacion } from '../interprete/esquema.ts';

export type Objetivo =
  | { tipo: 'uno'; movimiento: Movimiento }
  | { tipo: 'ambiguo'; movimientos: Movimiento[] }
  | { tipo: 'ninguno' };

export function resolverObjetivo(
  repo: Repositorio,
  citadoId: string | null,
  pista: Interpretacion['pista'],
): Objetivo {
  if (!citadoId) {
    const ultimo = repo.ultimoVigente();
    return ultimo ? { tipo: 'uno', movimiento: ultimo } : { tipo: 'ninguno' };
  }

  const candidatos = repo.movimientosPorConfirmacion(citadoId).filter((m) => m.estado === 'vigente');
  if (candidatos.length === 0) return { tipo: 'ninguno' };
  if (candidatos.length === 1) return { tipo: 'uno', movimiento: candidatos[0]! };

  const monto = pista?.monto_texto ? parsearMonto(pista.monto_texto) : null;
  const categoria = pista?.categoria ?? null;
  const filtrados = candidatos.filter(
    (m) => (monto === null || m.monto_centavos === monto) && (categoria === null || m.categoria === categoria),
  );
  if ((monto !== null || categoria !== null) && filtrados.length === 1) {
    return { tipo: 'uno', movimiento: filtrados[0]! };
  }
  return { tipo: 'ambiguo', movimientos: candidatos };
}
