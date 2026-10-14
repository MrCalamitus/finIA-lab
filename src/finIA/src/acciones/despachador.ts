// FR-015: lista cerrada de acciones. Lo que no esté en este mapa no se puede ejecutar,
// diga lo que diga el mensaje o el modelo.
import type { Accion } from '../interprete/esquema.ts';
import { borrar } from './borrar.ts';
import { consultar } from './consultar.ts';
import { corregir } from './corregir.ts';
import { registrar } from './registrar.ts';
import { resumen } from './resumen.ts';
import { TEXTOS } from './respuestas.ts';
import { rechazo, type ContextoAccion, type FuncionAccion, type ResultadoAccion } from './tipos.ts';

const ACCIONES: Record<Exclude<Accion, 'no_entendido'>, FuncionAccion> = {
  registrar,
  consultar,
  resumen,
  corregir,
  borrar,
};

/** Ejecuta la acción interpretada. Síncrono: corre dentro de la transacción del manejador. */
export function despachar(ctx: ContextoAccion): ResultadoAccion {
  const accion = ctx.interpretacion.accion;
  if (!Object.hasOwn(ACCIONES, accion)) return rechazo(TEXTOS.noEntendido);
  return ACCIONES[accion as keyof typeof ACCIONES](ctx);
}
