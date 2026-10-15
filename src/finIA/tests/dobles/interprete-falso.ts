import { ErrorInterpreteNoDisponible, type Interprete } from '../../src/tipos.ts';

type Programa = Record<string, unknown> | ((texto: string, fechaReferencia: Date) => unknown);
type ProgramaTicket = unknown | (() => unknown);

export interface InterpreteFalso extends Interprete {
  llamadas: string[];
  noDisponible: boolean;
  programar(texto: string, respuesta: unknown): void;
  /** Lo que devolverá `interpretarTicket` (o una función que lo calcula). */
  programarTicket(respuesta: ProgramaTicket): void;
  llamadasTicket: number;
  ticketNoDisponible: boolean;
}

/** Intérprete programado por texto exacto. Si no hay respuesta, devuelve `no_entendido`. */
export function crearInterpreteFalso(programa: Programa = {}): InterpreteFalso {
  const tabla = typeof programa === 'function' ? null : new Map(Object.entries(programa));
  let ticket: ProgramaTicket = { es_ticket: false, comercio: null, fecha: null, total_texto: null, articulos: [] };
  const falso: InterpreteFalso = {
    llamadas: [],
    noDisponible: false,
    llamadasTicket: 0,
    ticketNoDisponible: false,
    programar(texto, respuesta) {
      if (!tabla) throw new Error('programa por función');
      tabla.set(texto, respuesta);
    },
    programarTicket(respuesta) {
      ticket = respuesta;
    },
    async interpretar(texto, fechaReferencia) {
      falso.llamadas.push(texto);
      if (falso.noDisponible) throw new ErrorInterpreteNoDisponible('doble apagado');
      if (typeof programa === 'function') return programa(texto, fechaReferencia);
      return tabla!.has(texto) ? structuredClone(tabla!.get(texto)) : { accion: 'no_entendido' };
    },
    async interpretarTicket() {
      falso.llamadasTicket++;
      if (falso.ticketNoDisponible) throw new ErrorInterpreteNoDisponible('visión apagada');
      return typeof ticket === 'function' ? (ticket as () => unknown)() : structuredClone(ticket);
    },
  };
  return falso;
}
