// Textos del contrato de conversación v2 (specs/002-configuracion-formato-imagenes/contracts/conversacion.md).
// Las pruebas comparan contra estos textos; cualquier cambio aquí es un cambio de contrato.
// Formato de WhatsApp: montos en negrita, categorías con emoji, textos ajenos escapados.
import type { Movimiento } from '../almacen/repositorio.ts';
import { formatearMonto } from '../dominio/dinero.ts';
import { formatearFechaRelativa, nombreMes, type Periodo } from '../dominio/fechas.ts';
import { conEmoji, escapar, mono, negrita, tablaAlineada } from '../dominio/formato.ts';

export const EJEMPLO = mono('gasté 180 en tacos');

type MovimientoVisible = Pick<Movimiento, 'tipo' | 'monto_centavos' | 'categoria' | 'fecha'>;

const monto = (centavos: number) => negrita(formatearMonto(centavos));

/** "gasto de *$180.00* · 🌮 Comida · hoy" */
export function describir(m: MovimientoVisible, hoy: Date): string {
  return `${m.tipo} de ${monto(m.monto_centavos)} · ${conEmoji(m.categoria, m.tipo)} · ${formatearFechaRelativa(m.fecha, hoy)}`;
}

const vineta = (movimientos: MovimientoVisible[], hoy: Date) =>
  movimientos.map((m) => `• ${describir(m, hoy)}`).join('\n');

export function registrado(movimientos: MovimientoVisible[], hoy: Date): string {
  if (movimientos.length === 1) return `✅ Registrado: ${describir(movimientos[0]!, hoy)}`;
  return `✅ ${negrita(`Registrados ${movimientos.length} movimientos`)}\n${vineta(movimientos, hoy)}`;
}

export function preguntaConfirmacion(movimientos: MovimientoVisible[], hoy: Date): string {
  if (movimientos.length === 1) {
    return `🤔 ¿Confirmas ${describir(movimientos[0]!, hoy)}?\nResponde ${negrita('sí')} para guardarlo.`;
  }
  return `🤔 ¿Confirmas estos ${movimientos.length} movimientos?\n${vineta(movimientos, hoy)}\nResponde ${negrita('sí')} para guardarlos.`;
}

export function pendienteDescartado(movimientos: MovimientoVisible[]): string {
  if (movimientos.length === 1) {
    const m = movimientos[0]!;
    return `⚠️ No guardé el ${m.tipo} de ${monto(m.monto_centavos)} porque no lo confirmaste.`;
  }
  return `⚠️ No guardé los ${negrita(`${movimientos.length} movimientos`)} porque no los confirmaste.`;
}

export function variosConInvalido(montoTexto: string): string {
  return `⚠️ No guardé nada: no entendí "${escapar(montoTexto)}". Envíalo de nuevo, por ejemplo: ${mono('gasté 50 en café y 200 en gasolina')}`;
}

// --- Consultas ---

/** "hoy", "esta semana", "en octubre", "en diciembre de 2025". */
export function etiquetaPeriodo(periodo: Periodo, desde: string, hoy: Date): string {
  if (periodo === 'hoy') return 'hoy';
  if (periodo === 'semana') return 'esta semana';
  const anio = Number(desde.slice(0, 4));
  const mes = nombreMes(desde.slice(0, 7));
  return anio === hoy.getFullYear() ? `en ${mes}` : `en ${mes} de ${anio}`;
}

const sustantivo = (tipo: 'gasto' | 'ingreso', cantidad: number) =>
  `${cantidad} ${tipo}${cantidad === 1 ? '' : 's'}`;

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

export interface LineaConsulta {
  tipo: 'gasto' | 'ingreso';
  centavos: number;
  cantidad: number;
}

/**
 * Una sola línea: "📊 *Comida en octubre*\n*$2,340.00* · 14 gastos".
 * Ingresos y gastos: "📊 *Octubre*\n💰 Ingresos: *$…* · 1 ingreso\n💸 Gastos: *$…* · 1 gasto".
 */
export function consulta(lineas: LineaConsulta[], etiqueta: string, categoria: string | null): string {
  if (lineas.length === 1) {
    const l = lineas[0]!;
    const titulo = categoria ? `${escapar(categoria)} ${etiqueta}` : `${l.tipo === 'gasto' ? 'Gastos' : 'Ingresos'} ${etiqueta}`;
    return `📊 ${negrita(titulo)}\n${monto(l.centavos)} · ${sustantivo(l.tipo, l.cantidad)}`;
  }
  const titulo = categoria ? `${escapar(categoria)} ${etiqueta}` : mayuscula(etiqueta.replace(/^en /, ''));
  const filas = lineas.map((l) =>
    l.tipo === 'ingreso'
      ? `💰 Ingresos: ${monto(l.centavos)} · ${sustantivo('ingreso', l.cantidad)}`
      : `💸 Gastos: ${monto(l.centavos)} · ${sustantivo('gasto', l.cantidad)}`,
  );
  return `📊 ${negrita(titulo)}\n${filas.join('\n')}`;
}

/** "📊 No hay gastos de 🌮 Comida en octubre." / "📊 No hay movimientos en octubre." */
export function consultaSinDatos(tipo: 'gasto' | 'ingreso' | 'ambos', etiqueta: string, categoria: string | null): string {
  const que = tipo === 'ambos' ? 'movimientos' : `${tipo}s`;
  const deCategoria = categoria ? ` de ${conEmoji(categoria, tipo === 'ingreso' ? 'ingreso' : 'gasto')}` : '';
  return `📊 No hay ${que}${deCategoria} ${etiqueta}.`;
}

// --- Resumen ---

export interface DatosResumen {
  ingresos: number;
  gastos: number;
  porCategoria: { categoria: string; centavos: number }[];
}

export function resumen(datos: DatosResumen, etiqueta: string): string {
  const balance = datos.ingresos - datos.gastos;
  const lineas = [
    `📊 ${negrita(`Resumen de ${etiqueta.replace(/^en /, '')}`)}`,
    `💰 Ingresos: ${monto(datos.ingresos)}`,
    `💸 Gastos: ${monto(datos.gastos)}`,
    `${balance < 0 ? '🔴' : '🟢'} Balance: ${monto(balance)}`,
  ];
  if (datos.porCategoria.length > 0) {
    lineas.push(
      '',
      negrita('Gasto por categoría'),
      tablaAlineada(datos.porCategoria.map((c) => [c.categoria, formatearMonto(c.centavos)] as const)),
    );
  }
  return lineas.join('\n');
}

// --- Corrección y borrado ---

export const NOMBRE_CAMPO = { monto_centavos: 'Monto', categoria: 'Categoría', fecha: 'Fecha' } as const;

/**
 * "✏️ Corregido: gasto · 🌮 Comida · hoy\nMonto: $180.00 → *$150.00*". La primera línea describe el
 * movimiento sin el campo corregido; la segunda, el valor anterior y el nuevo.
 */
export function corregido(
  m: MovimientoVisible,
  campo: keyof typeof NOMBRE_CAMPO,
  anterior: string,
  nuevo: string,
  hoy: Date,
): string {
  const fecha = formatearFechaRelativa(m.fecha, hoy);
  const partes = {
    monto_centavos: `${m.tipo} · ${conEmoji(m.categoria, m.tipo)} · ${fecha}`,
    categoria: `${m.tipo} de ${monto(m.monto_centavos)} · ${fecha}`,
    fecha: `${m.tipo} de ${monto(m.monto_centavos)} · ${conEmoji(m.categoria, m.tipo)}`,
  };
  return `✏️ Corregido: ${partes[campo]}\n${NOMBRE_CAMPO[campo]}: ${escapar(anterior)} → ${negrita(escapar(nuevo))}`;
}

export function borrado(m: MovimientoVisible, hoy: Date): string {
  return `🗑️ Borrado: ${describir(m, hoy)}`;
}

export function sinCoincidencia(accion: 'corregir' | 'borrar'): string {
  return accion === 'corregir'
    ? `⚠️ No encontré qué corregir. Cita la confirmación del registro o escribe ${mono('corrige el último …')}`
    : `⚠️ No encontré qué borrar. Cita la confirmación del registro o escribe ${mono('borra el último')}`;
}

export function citaAmbigua(movimientos: MovimientoVisible[]): string {
  const opciones = movimientos.map((m) => `el de ${monto(m.monto_centavos)}`);
  const lista = opciones.length > 1 ? `${opciones.slice(0, -1).join(', ')} o ${opciones.at(-1)}` : opciones[0];
  return `⚠️ Esa confirmación tiene ${movimientos.length} movimientos. Dime cuál: ${lista}.`;
}

export function valorNoValido(valor: string): string {
  return `⚠️ No entendí el nuevo valor "${escapar(valor)}". No cambié nada.`;
}

export function montoCorregidoAlto(centavos: number, umbral: number): string {
  return `⚠️ No corregí: ${monto(centavos)} supera ${monto(umbral)}. Borra el registro y regístralo de nuevo para confirmarlo.`;
}

export function antiguosIgnorados(cantidad: number): string {
  return cantidad === 1
    ? `🕒 Estuve apagado. Ignoré ${negrita('1 mensaje')} de hace más de 24 h; reenvíalo si quieres registrarlo.`
    : `🕒 Estuve apagado. Ignoré ${negrita(`${cantidad} mensajes`)} de hace más de 24 h; reenvíalos si quieres registrarlos.`;
}

// --- Configuración (002, US1) ---

const lista = (nombres: readonly string[], tipo: 'gasto' | 'ingreso') => nombres.map((n) => conEmoji(n, tipo)).join(', ');
const TITULO_CATEGORIAS = { gasto: 'Categorías de gasto', ingreso: 'Categorías de ingreso' } as const;
const INSTRUCCION_LISTA = `Responde ${negrita('predeterminadas')} o escribe las tuyas separadas por comas (máx. 15).`;

/** Pregunta 1/2 (o la de ingresos). Con bienvenida la primera vez; si no, muestra las actuales. */
export function preguntaCategorias(tipo: 'gasto' | 'ingreso', actuales: readonly string[], bienvenida: boolean): string {
  const lineas: string[] = [];
  if (bienvenida) lineas.push(`👋 ${negrita('¡Hola! Vamos a configurar tu asistente.')}`);
  lineas.push(`⚙️ ${negrita(tipo === 'gasto' ? `1/2 · ${TITULO_CATEGORIAS.gasto}` : TITULO_CATEGORIAS.ingreso)}`);
  lineas.push(bienvenida ? `Las predeterminadas son: ${lista(actuales, tipo)}.` : `Ahora: ${lista(actuales, tipo)}.`);
  lineas.push(INSTRUCCION_LISTA);
  return lineas.join('\n');
}

export function preguntaUmbral(actualCentavos: number): string {
  return [
    `⚙️ ${negrita('2/2 · Monto de confirmación')}`,
    `¿A partir de qué monto te pido confirmar antes de guardar? Escribe un monto entre $100 y $1,000,000. Ahora: ${monto(actualCentavos)}`,
  ].join('\n');
}

/** "✅ Categorías de gasto: Comida, Ropa → *🌮 Comida, 🏷️ Mascotas, 📦 Otros*" */
export function categoriasGuardadas(tipo: 'gasto' | 'ingreso', antes: readonly string[], ahora: readonly string[]): string {
  const nuevas = negrita(lista(ahora, tipo));
  const igual = antes.length === ahora.length && antes.every((n, i) => n === ahora[i]);
  return igual
    ? `✅ ${TITULO_CATEGORIAS[tipo]}: ${nuevas}`
    : `✅ ${TITULO_CATEGORIAS[tipo]}: ${antes.map(escapar).join(', ')} → ${nuevas}`;
}

export interface VistaConfiguracion {
  gastos: readonly string[];
  ingresos: readonly string[];
  umbralCentavos: number;
}

function vinetasConfiguracion(c: VistaConfiguracion, umbralAnterior?: number): string[] {
  const umbral =
    umbralAnterior !== undefined && umbralAnterior !== c.umbralCentavos
      ? `• Umbral: ${formatearMonto(umbralAnterior)} → ${monto(c.umbralCentavos)}`
      : `• Confirmo arriba de ${monto(c.umbralCentavos)}`;
  return [`• Gastos: ${lista(c.gastos, 'gasto')}`, `• Ingresos: ${lista(c.ingresos, 'ingreso')}`, umbral];
}

export function configuracionGuardada(c: VistaConfiguracion, umbralAnterior: number): string {
  return [`✅ ${negrita('Configuración guardada')}`, ...vinetasConfiguracion(c, umbralAnterior)].join('\n');
}

export function verConfiguracion(c: VistaConfiguracion): string {
  return [`⚙️ ${negrita('Tu configuración')}`, ...vinetasConfiguracion(c)].join('\n');
}

export function listaNoValida(motivo: string): string {
  return `⚠️ No pude usar esa lista: ${escapar(motivo)}. Usa solo letras, máx. 3 palabras y 20 caracteres por categoría (máx. 15).`;
}

export const umbralFueraDeRango = () =>
  `⚠️ El monto debe estar entre ${monto(10_000)} y ${monto(100_000_000)}.`;

export const configuracionPausada = () =>
  `⏸️ Pausé la configuración. Escribe ${negrita('configurar')} cuando quieras terminarla.`;

// --- Imágenes (002, US3) ---

/** "2026-10-12" → "12/10" */
export const diaMes = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export interface ArticuloPropuesto {
  descripcion: string;
  cantidad: string | null;
  centavos: number;
  descuentoCentavos: number;
  /** Importe impreso con su descuento, antes del cuadre (FR-018e). */
  centavosLeidos: number;
  categoria: string;
  repetidoTexto: string | null;
}

export interface VistaTicket {
  comercio: string | null;
  fecha: string;
  origenFecha: 'texto' | 'ticket';
  totalCentavos: number;
  articulos: readonly ArticuloPropuesto[];
  textoIgnorado: boolean;
  ajuste: { impuestoCentavos: number; descuentoGeneralCentavos: number } | null;
}

const tituloTicket = (comercio: string | null) => negrita(comercio ? `Ticket de ${escapar(comercio)}` : 'Ticket');
const articulos = (n: number) => `${n} artículo${n === 1 ? '' : 's'}`;

/** "✅ Suman *$X*…" con el cuadre de FR-018e cuando lo hubo. */
function lineaSuma(t: VistaTicket): string {
  const igual = 'igual que el total del ticket.';
  if (!t.ajuste) return `✅ Suman ${monto(t.totalCentavos)}, ${igual}`;
  const leidos = t.articulos.reduce((s, a) => s + a.centavosLeidos, 0);
  const { impuestoCentavos: iva, descuentoGeneralCentavos: desc } = t.ajuste;
  const terminos = [iva > 0 ? `+ IVA ${monto(iva)}` : '', desc > 0 ? `− descuento ${monto(desc)}` : ''].filter(Boolean).join(' ');
  const repartido = iva > 0 && desc > 0 ? 'el IVA y el descuento' : iva > 0 ? 'el IVA' : 'el descuento';
  return `✅ Suman ${monto(leidos)} ${terminos} = ${monto(t.totalCentavos)}, ${igual} Repartí ${repartido} entre los artículos.`;
}

/** Propuesta de un ticket (contracts/conversacion.md, "Propuesta de ticket"). */
export function propuestaTicket(t: VistaTicket, hoy: Date): string {
  const origen = t.origenFecha === 'texto' ? 'fecha que escribiste' : 'fecha del ticket';
  const lineas = [`🧾 ${tituloTicket(t.comercio)} · ${formatearFechaRelativa(t.fecha, hoy)} _(${origen})_`];
  t.articulos.forEach((a, i) => {
    let linea = `${i + 1}. ${escapar(a.descripcion)}${a.cantidad ? ` (${escapar(a.cantidad)})` : ''} · ${monto(a.centavos)} · ${conEmoji(a.categoria, 'gasto')}`;
    if (a.descuentoCentavos > 0) linea += ` · descuento ${monto(a.descuentoCentavos)}`;
    if (a.repetidoTexto) linea += ` ⚠️ _posible repetido de: ${escapar(a.repetidoTexto)}_`;
    lineas.push(linea);
  });
  lineas.push(lineaSuma(t));
  if (t.textoIgnorado) lineas.push('ℹ️ Ignoré los productos y montos del texto; solo uso los del ticket.');
  const n = t.articulos.length;
  const repetidos = t.articulos.filter((a) => a.repetidoTexto).length;
  const guardar = n === 1 ? 'para guardarlo' : `para guardar los ${n}`;
  if (repetidos === n) {
    lineas.push(
      `⚠️ Todos parecen repetidos. Responde ${negrita('sí')} para guardarlos de todos modos o ${negrita('sin repetidos')} para no guardar nada.`,
    );
  } else {
    lineas.push(
      repetidos > 0
        ? `Responde ${negrita('sí')} ${guardar} o ${negrita('sin repetidos')} para guardar ${n - repetidos}.`
        : `Responde ${negrita('sí')} ${guardar}.`,
    );
  }
  return lineas.join('\n');
}

export function ticketGuardado(comercio: string | null, cantidad: number, centavos: number, fecha: string, hoy: Date): string {
  return `✅ ${negrita(comercio ? `Guardé el ticket de ${escapar(comercio)}` : 'Guardé el ticket')} · ${articulos(cantidad)} · ${monto(centavos)} · ${formatearFechaRelativa(fecha, hoy)}`;
}

export const ticketDescartado = (centavos: number) =>
  `⚠️ No guardé el ticket de ${monto(centavos)} porque no lo confirmaste.`;

export const nadaQueGuardar = () => '✅ No guardé nada: todos los artículos ya estaban registrados.';

export const faltaFecha = () =>
  `🤔 No encontré la fecha del ticket. Envía otra foto donde se vea o escríbela, por ejemplo ${mono('12/10/2026')} o ${mono('ayer')}.`;

export const faltaTotal = () =>
  `⚠️ No pude leer el ${negrita('total')} del ticket. Envía una foto más nítida donde se vea el total.`;

export const noCuadra = (suma: number, total: number) =>
  `⚠️ Los artículos suman ${monto(suma)} pero el total del ticket es ${monto(total)}. Envía una foto más nítida donde se vea el total.`;

export const noEsTicket = () => `⚠️ No encontré un ticket en la imagen. Si fue una compra, escríbela así: ${EJEMPLO}`;

export const ticketIlegible = () =>
  `⚠️ No pude leer bien el ticket. Envía una foto más nítida o escribe el gasto, por ejemplo: ${EJEMPLO}`;

export const masDe40 = () => '⚠️ El ticket tiene más de 40 artículos. Regístralo por partes o escríbelo a mano.';

export const imagenNoValida = () => '⚠️ Solo puedo leer fotos JPG o PNG de hasta 5 MB.';

export const visionNoDisponible = () =>
  '⚠️ No puedo leer imágenes en este momento. No guardé nada; inténtalo más tarde o escribe el gasto.';

export function preguntaBorrarTicket(cantidad: number, fecha: string, centavos: number): string {
  const que = cantidad === 1 ? negrita('1 artículo') : `los ${negrita(articulos(cantidad))}`;
  const accion = cantidad === 1 ? 'borrarlo' : 'borrarlos';
  return `🤔 ¿Borro ${que} del ticket del ${diaMes(fecha)} por ${monto(centavos)}? Responde ${negrita('sí')} para ${accion}.`;
}

export const ticketBorrado = (fecha: string, cantidad: number, centavos: number) =>
  `🗑️ Borré el ticket del ${diaMes(fecha)}: ${articulos(cantidad)} por ${monto(centavos)}.`;

export const borrarTicketSinCita = () => '⚠️ Cita la confirmación del ticket que quieres borrar.';

export const ticketNoBorrado = () => '⚠️ No borré el ticket.';

export const TEXTOS = {
  noEntendido: `⚠️ No pude registrarlo. Escríbelo así: ${EJEMPLO}`,
  noDisponible: '⚠️ No puedo interpretar mensajes en este momento. No guardé nada; inténtalo de nuevo en un rato.',
  muyLargo: '⚠️ Tu mensaje es muy largo. Envía un movimiento o pregunta a la vez.',
  errorInterno: '⚠️ Algo falló y no guardé nada. Inténtalo de nuevo.',
} as const;
