import type { Repositorio, Resultado } from '../almacen/repositorio.ts';
import type { Interpretacion } from '../interprete/esquema.ts';
import type { MensajeEntrante } from '../tipos.ts';

export interface ContextoAccion {
  repo: Repositorio;
  mensaje: MensajeEntrante & { texto: string };
  interpretacion: Interpretacion;
  /** Momento del procesamiento (para "hoy" en las respuestas). */
  ahora: Date;
}

export interface ResultadoAccion {
  resultado: Resultado;
  respuesta: string;
  /** Movimientos a los que se asigna el id de la respuesta, para poder citarla (FR-011). */
  confirmar?: number[];
}

export type FuncionAccion = (ctx: ContextoAccion) => ResultadoAccion;

export const rechazo = (respuesta: string): ResultadoAccion => ({ resultado: 'rechazado', respuesta });
