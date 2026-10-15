// Categorías. Las predeterminadas (las de la 001, con su emoji) se siembran en la base; desde la
// 002 las vigentes se leen de la base y el dueño puede cambiarlas (data-model.md de la 002).

export type Tipo = 'gasto' | 'ingreso';

export interface CategoriaPredeterminada {
  nombre: string;
  emoji: string;
}

export const EMOJI_CATEGORIA_PROPIA = '🏷️';

export const PREDETERMINADAS: Record<Tipo, readonly CategoriaPredeterminada[]> = {
  gasto: [
    { nombre: 'Comida', emoji: '🌮' },
    { nombre: 'Transporte', emoji: '🚌' },
    { nombre: 'Hogar', emoji: '🏠' },
    { nombre: 'Servicios', emoji: '💡' },
    { nombre: 'Salud', emoji: '💊' },
    { nombre: 'Educación', emoji: '📚' },
    { nombre: 'Entretenimiento', emoji: '🎬' },
    { nombre: 'Ropa', emoji: '👕' },
    { nombre: 'Otros', emoji: '📦' },
  ],
  ingreso: [
    { nombre: 'Salario', emoji: '💼' },
    { nombre: 'Honorarios', emoji: '🧾' },
    { nombre: 'Regalo', emoji: '🎁' },
    { nombre: 'Otros', emoji: '📦' },
  ],
};

export const CATEGORIAS_GASTO = PREDETERMINADAS.gasto.map((c) => c.nombre);
export const CATEGORIAS_INGRESO = PREDETERMINADAS.ingreso.map((c) => c.nombre);

export const TODAS_LAS_CATEGORIAS = [
  ...CATEGORIAS_GASTO,
  ...CATEGORIAS_INGRESO.filter((c) => c !== 'Otros'),
] as [string, ...string[]];

/** Emoji predeterminado de una categoría, o el genérico si es del dueño (FR-012). */
export function emojiPredeterminado(nombre: string, tipo: Tipo): string {
  return PREDETERMINADAS[tipo].find((c) => c.nombre === nombre)?.emoji ?? EMOJI_CATEGORIA_PROPIA;
}

// --- Listas del dueño (002: FR-003, FR-004, FR-006a) ---

export const MAX_CATEGORIAS = 15;
const NOMBRE_VALIDO = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]{1,20}$/;
const MAX_PALABRAS = 3;

/** Minúsculas y sin acentos, para comparar nombres ("Educación" = "educacion"). */
export function claveCategoria(nombre: string): string {
  return nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

export type ResultadoLista = { ok: true; nombres: string[] } | { ok: false; motivo: string };

/**
 * Lee una lista separada por comas. Toda la lista se rechaza si un nombre no cumple las reglas
 * (research R8): solo letras y espacios, 1–20 caracteres, hasta 3 palabras, sin repetirse,
 * máximo 15. "Otros" se añade siempre. El motivo cita el nombre tal como se escribió.
 */
export function validarListaCategorias(texto: string): ResultadoLista {
  const crudos = texto.split(',').map((n) => n.trim()).filter((n) => n.length > 0);
  if (crudos.length === 0) return { ok: false, motivo: 'la lista está vacía' };
  if (crudos.length > MAX_CATEGORIAS) return { ok: false, motivo: `hay más de ${MAX_CATEGORIAS} categorías` };

  const nombres: string[] = [];
  const vistas = new Set<string>();
  for (const crudo of crudos) {
    // Solo se colapsan espacios normales: saltos de línea y otros controles no se permiten.
    const nombre = crudo.replace(/ +/g, ' ');
    if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]*$/.test(nombre)) return { ok: false, motivo: `"${crudo}" tiene caracteres no permitidos` };
    if (!NOMBRE_VALIDO.test(nombre)) return { ok: false, motivo: `"${crudo}" tiene más de 20 caracteres` };
    if (nombre.split(' ').length > MAX_PALABRAS) return { ok: false, motivo: `"${crudo}" tiene más de 3 palabras` };
    const clave = claveCategoria(nombre);
    if (vistas.has(clave)) return { ok: false, motivo: `"${crudo}" está repetida` };
    vistas.add(clave);
    nombres.push(clave === 'otros' ? 'Otros' : nombre);
  }
  if (!vistas.has('otros')) {
    if (nombres.length >= MAX_CATEGORIAS) return { ok: false, motivo: `hay más de ${MAX_CATEGORIAS} categorías` };
    nombres.push('Otros');
  }
  return { ok: true, nombres };
}

const normalizarRespuesta = (texto: string) =>
  claveCategoria(texto).replace(/[.!¡?¿\s]+$/, '').replace(/^[¡¿\s]+/, '');

export function esPredeterminadas(texto: string): boolean {
  return normalizarRespuesta(texto) === 'predeterminadas';
}

/** FR-006a: "predeterminadas" o una lista con al menos una coma y sin dígitos. */
export function esIntentoDeCategorias(texto: string): boolean {
  return esPredeterminadas(texto) || (texto.includes(',') && !/\d/.test(texto));
}

/**
 * ¿`categoria` es válida para un movimiento nuevo de este tipo? `activas` son las categorías
 * vigentes de la base; sin ellas se usan las predeterminadas.
 */
export function categoriaValida(categoria: string, tipo: Tipo, activas?: readonly string[]): boolean {
  const lista = activas ?? (tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO);
  return lista.includes(categoria);
}
