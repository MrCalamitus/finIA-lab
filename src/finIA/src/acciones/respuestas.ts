// Textos del contrato de conversación (contracts/conversacion.md). Las pruebas comparan contra
// estos textos; cualquier cambio aquí es un cambio de contrato.

import type { Movimiento } from '../almacen/repositorio.ts';
import { formatearMonto } from '../dominio/dinero.ts';
import { formatearFechaRelativa, nombreMes, type Periodo } from '../dominio/fechas.ts';

export const EJEMPLO = '"gasté 180 en tacos"';

type MovimientoVisible = Pick<Movimiento, 'tipo' | 'monto_centavos' | 'categoria' | 'fecha'>;

/** "gasto de $180.00 · Comida · hoy" */
export function describir(m: MovimientoVisible, hoy: Date): string {
  return `${m.tipo} de ${formatearMonto(m.monto_centavos)} · ${m.categoria} · ${formatearFechaRelativa(m.fecha, hoy)}`;
}

const lista = (movimientos: MovimientoVisible[], hoy: Date) =>
  movimientos.map((m, i) => `${i + 1}. ${describir(m, hoy)}`).join('\n');

export function registrado(movimientos: MovimientoVisible[], hoy: Date): string {
  if (movimientos.length === 1) return `Registrado: ${describir(movimientos[0]!, hoy)}`;
  return `Registrados ${movimientos.length} movimientos:\n${lista(movimientos, hoy)}`;
}

export function preguntaConfirmacion(movimientos: MovimientoVisible[], hoy: Date): string {
  if (movimientos.length === 1) {
    return `¿Confirmas ${describir(movimientos[0]!, hoy)}? Responde "sí" para guardarlo.`;
  }
  return `¿Confirmas estos ${movimientos.length} movimientos?\n${lista(movimientos, hoy)}\nResponde "sí" para guardarlos.`;
}

export function pendienteDescartado(movimientos: MovimientoVisible[]): string {
  if (movimientos.length === 1) {
    const m = movimientos[0]!;
    return `No guardé el ${m.tipo} de ${formatearMonto(m.monto_centavos)} porque no lo confirmaste.`;
  }
  return `No guardé los ${movimientos.length} movimientos porque no los confirmaste.`;
}

export function variosConInvalido(montoTexto: string): string {
  return `No guardé nada: no entendí "${montoTexto}". Envíalo de nuevo, por ejemplo: "gasté 50 en café y 200 en gasolina".`;
}

// --- Consultas (US2) ---

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

export interface LineaConsulta {
  tipo: 'gasto' | 'ingreso';
  centavos: number;
  cantidad: number;
}

/** "Comida en octubre: $2,340.00 (14 gastos)" o "Gastos esta semana: $500.50 (2 gastos)". */
export function lineaConsulta(linea: LineaConsulta, etiqueta: string, categoria: string | null): string {
  const titulo = categoria ?? (linea.tipo === 'gasto' ? 'Gastos' : 'Ingresos');
  return `${titulo} ${etiqueta}: ${formatearMonto(linea.centavos)} (${sustantivo(linea.tipo, linea.cantidad)})`;
}

/** "No hay gastos de Comida en octubre." / "No hay ingresos hoy." / "No hay movimientos en octubre." */
export function consultaSinDatos(tipo: 'gasto' | 'ingreso' | 'ambos', etiqueta: string, categoria: string | null): string {
  const que = tipo === 'ambos' ? 'movimientos' : `${tipo}s`;
  return `No hay ${que}${categoria ? ` de ${categoria}` : ''} ${etiqueta}.`;
}

// --- Resumen (US4) ---

export interface DatosResumen {
  ingresos: number;
  gastos: number;
  porCategoria: { categoria: string; centavos: number }[];
}

/** etiqueta "en octubre" → "Resumen de octubre"; "esta semana" → "Resumen de esta semana". */
export function resumen(datos: DatosResumen, etiqueta: string): string {
  const titulo = `Resumen de ${etiqueta.replace(/^en /, '')}`;
  const lineas = [
    titulo,
    `Ingresos: ${formatearMonto(datos.ingresos)}`,
    `Gastos: ${formatearMonto(datos.gastos)}`,
    `Balance: ${formatearMonto(datos.ingresos - datos.gastos)}`,
  ];
  if (datos.porCategoria.length > 0) {
    lineas.push('Por categoría:', ...datos.porCategoria.map((c) => `· ${c.categoria} ${formatearMonto(c.centavos)}`));
  }
  return lineas.join('\n');
}

// --- Corrección y borrado (US3) ---

export const NOMBRE_CAMPO = { monto_centavos: 'Monto', categoria: 'Categoría', fecha: 'Fecha' } as const;

/** "Corregido: gasto · Comida · hoy. Monto: $180.00 → $150.00" (el campo corregido sale al final). */
export function corregido(
  m: MovimientoVisible,
  campo: keyof typeof NOMBRE_CAMPO,
  anterior: string,
  nuevo: string,
  hoy: Date,
): string {
  const partes = {
    monto_centavos: `${m.tipo} · ${m.categoria} · ${formatearFechaRelativa(m.fecha, hoy)}`,
    categoria: `${m.tipo} de ${formatearMonto(m.monto_centavos)} · ${formatearFechaRelativa(m.fecha, hoy)}`,
    fecha: `${m.tipo} de ${formatearMonto(m.monto_centavos)} · ${m.categoria}`,
  };
  return `Corregido: ${partes[campo]}. ${NOMBRE_CAMPO[campo]}: ${anterior} → ${nuevo}`;
}

export function borrado(m: MovimientoVisible, hoy: Date): string {
  return `Borrado: ${describir(m, hoy)}`;
}

export function sinCoincidencia(accion: 'corregir' | 'borrar'): string {
  return accion === 'corregir'
    ? 'No encontré qué corregir. Cita la confirmación del registro o escribe "corrige el último …".'
    : 'No encontré qué borrar. Cita la confirmación del registro o escribe "borra el último".';
}

export function citaAmbigua(movimientos: MovimientoVisible[]): string {
  const opciones = movimientos.map((m) => `el de ${formatearMonto(m.monto_centavos)}`);
  const lista = opciones.length > 1 ? `${opciones.slice(0, -1).join(', ')} o ${opciones.at(-1)}` : opciones[0];
  return `Esa confirmación tiene ${movimientos.length} movimientos. Dime cuál: ${lista}.`;
}

export function valorNoValido(valor: string): string {
  return `No entendí el nuevo valor "${valor}". No cambié nada.`;
}

export function montoCorregidoAlto(centavos: number, umbral: number): string {
  return `No corregí: ${formatearMonto(centavos)} supera ${formatearMonto(umbral)}. Borra el registro y regístralo de nuevo para confirmarlo.`;
}

export function antiguosIgnorados(cantidad: number): string {
  return cantidad === 1
    ? 'Estuve apagado. Ignoré 1 mensaje de hace más de 24 h; reenvíalo si quieres registrarlo.'
    : `Estuve apagado. Ignoré ${cantidad} mensajes de hace más de 24 h; reenvíalos si quieres registrarlos.`;
}

export const TEXTOS = {
  noEntendido: `No pude registrarlo. Escríbelo así: ${EJEMPLO}.`,
  noDisponible: 'No puedo interpretar mensajes en este momento. No guardé nada; inténtalo de nuevo en un rato.',
  muyLargo: 'Tu mensaje es muy largo. Envía un movimiento o pregunta a la vez.',
  errorInterno: 'Algo falló y no guardé nada. Inténtalo de nuevo.',
} as const;
