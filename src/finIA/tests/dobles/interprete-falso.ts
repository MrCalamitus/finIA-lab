import { ErrorInterpreteNoDisponible, type Interprete } from '../../src/tipos.ts';

type Programa = Record<string, unknown> | ((texto: string, fechaReferencia: Date) => unknown);

export interface InterpreteFalso extends Interprete {
  llamadas: string[];
  noDisponible: boolean;
  programar(texto: string, respuesta: unknown): void;
}

/** Intérprete programado por texto exacto. Si no hay respuesta, devuelve `no_entendido`. */
export function crearInterpreteFalso(programa: Programa = {}): InterpreteFalso {
  const tabla = typeof programa === 'function' ? null : new Map(Object.entries(programa));
  const falso: InterpreteFalso = {
    llamadas: [],
    noDisponible: false,
    programar(texto, respuesta) {
      if (!tabla) throw new Error('programa por función');
      tabla.set(texto, respuesta);
    },
    async interpretar(texto, fechaReferencia) {
      falso.llamadas.push(texto);
      if (falso.noDisponible) throw new ErrorInterpreteNoDisponible('doble apagado');
      if (typeof programa === 'function') return programa(texto, fechaReferencia);
      return tabla!.has(texto) ? structuredClone(tabla!.get(texto)) : { accion: 'no_entendido' };
    },
  };
  return falso;
}
