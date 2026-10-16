// FR-018d: posibles repetidos de un artículo de ticket (research R6 de la 002).
import type { Movimiento } from '../almacen/repositorio.ts';

/** Minúsculas, sin acentos, solo letras y dígitos: "LECHE ENTERA 1L" → "lecheentera1l". */
export function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

const UNIDADES = new Set([
  'kg', 'kgs', 'kilo', 'kilos', 'g', 'gr', 'grs', 'gramos', 'l', 'lt', 'lts', 'litro', 'litros', 'ml',
  'pz', 'pza', 'pzas', 'pieza', 'piezas', 'x', 'paq', 'pqt',
]);

/** Primera palabra de al menos 3 letras que no sea una unidad: "3 PZ PAN DULCE" → "pan". */
export function primeraPalabraSignificativa(descripcion: string): string | null {
  for (const palabra of normalizarPalabras(descripcion)) {
    if (palabra.length >= 3 && /^[a-z]+$/.test(palabra) && !UNIDADES.has(palabra)) return palabra;
  }
  return null;
}

function normalizarPalabras(texto: string): string[] {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export interface ArticuloComparable {
  descripcion: string;
  centavos: number;
  fecha: string;
}

type MovimientoComparable = Pick<Movimiento, 'fecha' | 'monto_centavos' | 'estado' | 'origen' | 'descripcion' | 'texto_original'>;

/** Misma fecha, mismo monto exacto y descripción equivalente (ticket) o presente en el texto (texto). */
export function esPosibleRepetido(articulo: ArticuloComparable, movimiento: MovimientoComparable): boolean {
  if (movimiento.estado !== 'vigente') return false;
  if (movimiento.fecha !== articulo.fecha || movimiento.monto_centavos !== articulo.centavos) return false;
  if (movimiento.origen === 'imagen' && movimiento.descripcion) {
    const a = normalizar(articulo.descripcion);
    const b = normalizar(movimiento.descripcion);
    return a.length > 0 && b.length > 0 && (a === b || a.includes(b) || b.includes(a));
  }
  const palabra = primeraPalabraSignificativa(articulo.descripcion);
  return palabra !== null && normalizarPalabras(movimiento.texto_original).includes(palabra);
}
