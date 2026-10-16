// Lista fija definida por el proyecto (data-model.md). El dueño no crea categorías.

export type Tipo = 'gasto' | 'ingreso';

export const CATEGORIAS_GASTO = [
  'Comida', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Educación', 'Entretenimiento', 'Ropa', 'Otros',
] as const;

export const CATEGORIAS_INGRESO = ['Salario', 'Honorarios', 'Regalo', 'Otros'] as const;

export const TODAS_LAS_CATEGORIAS = [
  ...CATEGORIAS_GASTO,
  ...CATEGORIAS_INGRESO.filter((c) => c !== 'Otros'),
] as [string, ...string[]];

export function categoriaValida(categoria: string, tipo: Tipo): boolean {
  const lista: readonly string[] = tipo === 'gasto' ? CATEGORIAS_GASTO : CATEGORIAS_INGRESO;
  return lista.includes(categoria);
}
