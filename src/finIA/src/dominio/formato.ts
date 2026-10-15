// Formato de WhatsApp (FR-010 a FR-013, research R9 de la 002): solo *negrita*, _cursiva_,
// ```monoespaciado``` y emojis. Todo texto que no escribimos nosotros (categorías, descripciones,
// comercios) pasa por `escapar` para que no rompa el formato.
import { emojiPredeterminado, type Tipo } from './categorias.ts';

const SIMBOLOS_FORMATO = /[*_~`]/g;
// Caracteres de control (incluye saltos de línea y tabuladores) → espacio.
const CONTROL = /[\u0000-\u001f\u007f]/g;

export function escapar(texto: string): string {
  return texto.replace(SIMBOLOS_FORMATO, '').replace(CONTROL, ' ').replace(/\s+/g, ' ').trim();
}

export const negrita = (texto: string) => `*${texto}*`;
export const cursiva = (texto: string) => `_${texto}_`;
export const mono = (texto: string) => `\`\`\`${texto}\`\`\``;

/** "🌮 Comida"; las categorías del dueño llevan el emoji genérico (FR-012). */
export function conEmoji(categoria: string, tipo: Tipo): string {
  const limpia = escapar(categoria);
  return `${emojiPredeterminado(limpia, tipo)} ${limpia}`;
}

/**
 * Tabla de dos columnas en un bloque monoespaciado: nombres rellenados al más largo y montos
 * alineados a la derecha. Sin emojis dentro: tienen anchos distintos y desalinean (FR-013).
 */
export function tablaAlineada(filas: readonly (readonly [string, string])[]): string {
  if (filas.length === 0) return '';
  const limpias = filas.map(([nombre, monto]) => [escapar(nombre), monto] as const);
  const ancho = Math.max(...limpias.map(([nombre]) => nombre.length));
  const anchoMonto = Math.max(...limpias.map(([, monto]) => monto.length));
  const lineas = limpias.map(([nombre, monto]) => `${nombre.padEnd(ancho)}  ${monto.padStart(anchoMonto)}`);
  return mono(lineas.join('\n'));
}
