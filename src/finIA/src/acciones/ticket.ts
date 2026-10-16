// US3 de la 002: registrar gastos desde la foto de un ticket (FR-016 a FR-023).
// El modelo de visión propone; el código suma, decide la fecha, marca repetidos y pide confirmación.
import { z } from 'zod';
import type { Movimiento, Repositorio, Ticket } from '../almacen/repositorio.ts';
import { fechaEscritaConCoincidencia, validarFecha } from '../dominio/fechas.ts';
import { esPosibleRepetido } from '../dominio/repetidos.ts';
import { crearEsquemaTicket, validarTicket, type ArticuloTicket } from '../interprete/ticket.ts';
import { ErrorInterpreteNoDisponible, type Interprete, type MensajeEntrante } from '../tipos.ts';
import { esAfirmativo } from './confirmar.ts';
import { normalizarComando } from './comandos.ts';
import { registrarManejadorEspera, type ManejadorEspera } from './espera.ts';
import {
  borrarTicketSinCita,
  diaMes,
  faltaFecha,
  fechaNoEntendida,
  faltaTotal,
  imagenNoValida,
  masDe40,
  nadaQueGuardar,
  noCuadra,
  noEsTicket,
  preguntaBorrarTicket,
  propuestaTicket,
  ticketBorrado,
  ticketDescartado,
  ticketGuardado,
  ticketGuardadoDirecto,
  ticketIlegible,
  ticketNoBorrado,
  visionNoDisponible,
  type ArticuloPropuesto,
} from './respuestas.ts';
import type { ResultadoAccion } from './tipos.ts';

/** La propuesta se guarda como JSON y se valida al leerla (constitución I). */
const Propuesta = z.strictObject({
  articulos: z
    .array(
      z.strictObject({
        descripcion: z.string().min(1).max(60),
        cantidad: z.string().max(20).nullable(),
        centavos: z.number().int().positive(),
        descuentoCentavos: z.number().int().nonnegative(),
        centavosLeidos: z.number().int().positive(),
        categoria: z.string().min(1).max(30),
        repetidoDe: z.number().int().nullable(),
        repetidoTexto: z.string().max(120).nullable(),
      }),
    )
    .min(1)
    .max(40),
  textoIgnorado: z.boolean(),
  // FR-018e: cuadre con IVA o descuento general; null si los artículos ya sumaban el total.
  ajuste: z
    .strictObject({ impuestoCentavos: z.number().int().nonnegative(), descuentoGeneralCentavos: z.number().int().nonnegative() })
    .nullable(),
});
type Propuesta = z.infer<typeof Propuesta>;

function leerPropuesta(ticket: Ticket): Propuesta | null {
  try {
    const r = Propuesta.safeParse(JSON.parse(ticket.propuesta));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** FR-018d: "gasto del 12/10 "gasté 28.50 en leche"" o ""Leche entera 1 l" del ticket del 12/10". */
function describirRepetido(m: Movimiento): string {
  if (m.origen === 'imagen' && m.descripcion) return `"${m.descripcion}" del ticket del ${diaMes(m.fecha)}`;
  const texto = m.texto_original.length > 60 ? `${m.texto_original.slice(0, 57)}…` : m.texto_original;
  return `${m.tipo} del ${diaMes(m.fecha)} "${texto}"`;
}

/** Marca cada artículo con el primer movimiento vigente al que se parece (FR-018d). */
function marcarRepetidos(repo: Repositorio, articulos: readonly ArticuloTicket[], fecha: string): Propuesta['articulos'] {
  const existentes = repo.movimientosVigentesDeFecha(fecha);
  return articulos.map((a) => {
    const igual = existentes.find((m) => esPosibleRepetido({ descripcion: a.descripcion, centavos: a.centavos, fecha }, m));
    return { ...a, repetidoDe: igual?.id ?? null, repetidoTexto: igual ? describirRepetido(igual) : null };
  });
}

/** Fecha escrita en el texto (si es válida) y si el texto traía otros números (FR-018c, FR-020). */
function leerTexto(texto: string | null, enviadoEn: Date): { fecha: string | null; textoIgnorado: boolean } {
  if (!texto) return { fecha: null, textoIgnorado: false };
  const escrita = fechaEscritaConCoincidencia(texto, enviadoEn);
  const fecha = escrita && validarFecha(escrita.iso, enviadoEn) ? escrita.iso : null;
  const sinFecha = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(escrita?.coincidencia ?? '\u0000', '');
  return { fecha, textoIgnorado: /\d/.test(sinFecha) };
}

function vista(ticket: Ticket, propuesta: Propuesta): Parameters<typeof propuestaTicket>[0] {
  return {
    comercio: ticket.comercio,
    fecha: ticket.fecha!,
    origenFecha: ticket.origen_fecha ?? 'ticket',
    totalCentavos: ticket.total_centavos,
    articulos: propuesta.articulos as ArticuloPropuesto[],
    textoIgnorado: propuesta.textoIgnorado,
    ajuste: propuesta.ajuste,
  };
}

const rechazoImagen = (respuesta: string): ResultadoAccion => ({ resultado: 'imagen_rechazada', respuesta });

/** Guarda los artículos elegidos del ticket (todos o ninguno, en la transacción en curso). */
function guardar(repo: Repositorio, ticket: Ticket, elegidos: Propuesta['articulos'], respuesta: string): ResultadoAccion {
  const ids = repo.guardarArticulosTicket(ticket, elegidos);
  repo.actualizarTicket(ticket.id, { estado: 'guardado' });
  return { resultado: 'ticket_guardado', respuesta, confirmar: ids, confirmarTicket: ticket.id };
}

/**
 * FR-019 (enmienda): con fecha conocida y la suma cuadrada, se guarda directo, salvo que haya
 * posibles repetidos o que el total supere el monto de confirmación; en esos casos, propuesta
 * pendiente de una sola confirmación.
 */
function proponerOGuardar(repo: Repositorio, ticket: Ticket, propuesta: Propuesta, ahora: Date): ResultadoAccion {
  const hayRepetidos = propuesta.articulos.some((a) => a.repetidoDe !== null);
  if (!hayRepetidos && ticket.total_centavos <= repo.umbralCentavos()) {
    repo.cancelarEspera();
    return guardar(repo, ticket, propuesta.articulos, ticketGuardadoDirecto(vista(ticket, propuesta), ahora));
  }
  repo.crearEspera('ticket_confirmacion', String(ticket.id));
  return { resultado: 'ticket_propuesto', respuesta: propuestaTicket(vista(ticket, propuesta), ahora) };
}

export interface ContextoImagen {
  repo: Repositorio;
  interprete: Interprete;
  mensaje: MensajeEntrante;
  ahora: Date;
}

/**
 * Procesa una foto: modelo de visión → reglas de contracts/ticket.md → fecha → repetidos →
 * ticket pendiente con su espera. Marca el mensaje como procesado en la misma transacción.
 */
export async function procesarImagen({ repo, interprete, mensaje, ahora }: ContextoImagen): Promise<ResultadoAccion> {
  const terminar = (r: ResultadoAccion) => {
    repo.marcarProcesado(mensaje.id, mensaje.enviadoEn, r.resultado);
    return r;
  };
  if (!mensaje.imagen || !interprete.interpretarTicket) return repo.transaccion(() => terminar(rechazoImagen(imagenNoValida())));

  const categorias = repo.categorias('gasto', { soloActivas: true }).map((c) => c.nombre);
  const esquema = crearEsquemaTicket(categorias);
  let salida: unknown;
  try {
    salida = await interprete.interpretarTicket(mensaje.imagen, mensaje.enviadoEn, { categorias, jsonSchema: esquema.jsonSchema });
  } catch (error) {
    if (!(error instanceof ErrorInterpreteNoDisponible)) throw error;
    return repo.transaccion(() => terminar({ resultado: 'rechazado', respuesta: visionNoDisponible() }));
  }

  const validacion = esquema.validar(salida);
  if (!validacion.ok) return repo.transaccion(() => terminar(rechazoImagen(ticketIlegible())));
  const r = validarTicket(validacion.valor, categorias);
  if (!r.ok) {
    const textos = {
      no_es_ticket: noEsTicket,
      mas_de_40: masDe40,
      sin_total: faltaTotal,
      no_cuadra: () => (r.motivo === 'no_cuadra' ? noCuadra(r.sumaLeida, r.totalLeido) : ''),
    };
    return repo.transaccion(() => terminar(rechazoImagen(textos[r.motivo]())));
  }

  // FR-018c: fecha escrita > fecha del ticket > preguntar. Nunca la fecha de envío.
  const texto = leerTexto(mensaje.texto, mensaje.enviadoEn);
  const fechaTicket =
    r.ticket.fechaTicket && /^\d{4}-\d{2}-\d{2}$/.test(r.ticket.fechaTicket) && validarFecha(r.ticket.fechaTicket, mensaje.enviadoEn)
      ? r.ticket.fechaTicket
      : null;
  const fecha = texto.fecha ?? fechaTicket;
  const origenFecha = texto.fecha ? 'texto' : fechaTicket ? 'ticket' : null;

  return repo.transaccion(() => {
    const articulos = fecha
      ? marcarRepetidos(repo, r.ticket.articulos, fecha)
      : r.ticket.articulos.map((a) => ({ ...a, repetidoDe: null, repetidoTexto: null }));
    const propuesta: Propuesta = { articulos, textoIgnorado: texto.textoIgnorado, ajuste: r.ticket.ajuste };
    const id = repo.crearTicket({
      mensajeOrigenId: mensaje.id,
      comercio: r.ticket.comercio,
      fecha,
      origenFecha,
      totalCentavos: r.ticket.totalCentavos,
      propuesta: JSON.stringify(propuesta),
      textoFoto: mensaje.texto?.slice(0, 500) ?? null,
      estado: fecha ? 'pendiente' : 'esperando_fecha',
    });
    if (!fecha) {
      repo.crearEspera('ticket_fecha', String(id));
      return terminar({ resultado: 'ticket_esperando_fecha', respuesta: faltaFecha() });
    }
    return terminar(proponerOGuardar(repo, repo.ticket(id)!, propuesta, ahora));
  });
}

const ticketDeEspera = (repo: Repositorio, referencia: string | null) => {
  const ticket = referencia ? repo.ticket(Number(referencia)) : null;
  return ticket ? { ticket, propuesta: leerPropuesta(ticket) } : null;
};

function descartar(repo: Repositorio, ticket: Ticket, aviso: string | null) {
  repo.actualizarTicket(ticket.id, { estado: 'descartado' });
  repo.cancelarEspera();
  return { tipo: 'cancelada' as const, aviso };
}

/** Espera `ticket_fecha`: una fecha escrita completa la propuesta; otra foto lo sustituye (FR-018c). */
const resolverFecha: ManejadorEspera = ({ repo, mensaje, ahora }, espera) => {
  const datos = ticketDeEspera(repo, espera.referencia);
  if (!datos?.propuesta) {
    repo.cancelarEspera();
    return { tipo: 'cancelada', aviso: null };
  }
  const { ticket, propuesta } = datos;
  // Otra foto: el ticket anterior se descarta sin aviso y la foto se procesa como ticket nuevo.
  if (mensaje.imagen || mensaje.imagenRechazada) return descartar(repo, ticket, null);

  const escrita = fechaEscritaConCoincidencia(mensaje.texto, mensaje.enviadoEn);
  if (!escrita || !validarFecha(escrita.iso, mensaje.enviadoEn)) return descartar(repo, ticket, fechaNoEntendida(ticket.total_centavos));

  const completa: Propuesta = {
    ...propuesta,
    articulos: marcarRepetidos(
      repo,
      propuesta.articulos.map(({ repetidoDe: _r, repetidoTexto: _t, ...a }) => a),
      escrita.iso,
    ),
  };
  repo.actualizarTicket(ticket.id, {
    fecha: escrita.iso,
    origen_fecha: 'texto',
    estado: 'pendiente',
    propuesta: JSON.stringify(completa),
  });
  return { tipo: 'resuelta', resultado: proponerOGuardar(repo, repo.ticket(ticket.id)!, completa, ahora) };
};

/** Espera `ticket_confirmacion`: "sí" guarda todo; "sin repetidos" omite los marcados (FR-019). */
const resolverConfirmacion: ManejadorEspera = ({ repo, mensaje, ahora }, espera) => {
  const datos = ticketDeEspera(repo, espera.referencia);
  if (!datos?.propuesta || datos.ticket.estado !== 'pendiente') {
    repo.cancelarEspera();
    return { tipo: 'cancelada', aviso: null };
  }
  const { ticket, propuesta } = datos;
  // Una foto nunca confirma, aunque su pie diga "sí".
  if (mensaje.imagen || mensaje.imagenRechazada) return descartar(repo, ticket, ticketDescartado(ticket.total_centavos));

  const hayRepetidos = propuesta.articulos.some((a) => a.repetidoDe !== null);
  const todo = esAfirmativo(mensaje.texto);
  const sinRepetidos = hayRepetidos && normalizarComando(mensaje.texto) === 'sin repetidos';
  if (!todo && !sinRepetidos) return descartar(repo, ticket, ticketDescartado(ticket.total_centavos));

  repo.cancelarEspera();
  const elegidos = propuesta.articulos.filter((a) => todo || a.repetidoDe === null);
  if (elegidos.length === 0) {
    repo.actualizarTicket(ticket.id, { estado: 'descartado' });
    return { tipo: 'resuelta', resultado: { resultado: 'ticket_descartado', respuesta: nadaQueGuardar() } };
  }
  const centavos = elegidos.reduce((s, a) => s + a.centavos, 0);
  return {
    tipo: 'resuelta',
    resultado: guardar(repo, ticket, elegidos, ticketGuardado(ticket.comercio, elegidos.length, centavos, ticket.fecha!, ahora)),
  };
};

/** Espera `borrar_ticket`: solo un "sí" borra (FR-020a). */
const resolverBorrado: ManejadorEspera = ({ repo, mensaje }, espera) => {
  repo.cancelarEspera();
  const ticket = espera.referencia ? repo.ticket(Number(espera.referencia)) : null;
  if (!ticket || ticket.estado !== 'guardado' || mensaje.imagen || !esAfirmativo(mensaje.texto)) {
    return { tipo: 'cancelada', aviso: ticketNoBorrado() };
  }
  const { cantidad, centavos } = repo.borrarTicket(ticket.id, mensaje.id);
  return {
    tipo: 'resuelta',
    resultado: { resultado: 'ticket_borrado', respuesta: ticketBorrado(ticket.fecha!, cantidad, centavos) },
  };
};

/** Comando "borra el ticket": solo citando la confirmación de un ticket guardado (FR-020a). */
export function comandoBorrarTicket(repo: Repositorio, mensaje: MensajeEntrante): ResultadoAccion {
  const ticket = mensaje.citadoId ? repo.ticketPorConfirmacion(mensaje.citadoId) : null;
  if (!ticket || ticket.estado !== 'guardado') return { resultado: 'rechazado', respuesta: borrarTicketSinCita() };
  const vigentes = repo.vigentesDeTicket(ticket.id);
  if (vigentes.length === 0) return { resultado: 'rechazado', respuesta: borrarTicketSinCita() };
  repo.crearEspera('borrar_ticket', String(ticket.id));
  const centavos = vigentes.reduce((s, m) => s + m.monto_centavos, 0);
  return { resultado: 'pendiente', respuesta: preguntaBorrarTicket(vigentes.length, ticket.fecha!, centavos) };
}

registrarManejadorEspera('ticket_fecha', resolverFecha);
registrarManejadorEspera('ticket_confirmacion', resolverConfirmacion);
registrarManejadorEspera('borrar_ticket', resolverBorrado);
