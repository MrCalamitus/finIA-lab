// Comandos que reconoce el código, sin pasar por el modelo (FR-006, FR-020a; contracts/configuracion.md).
// Solo coincidencia exacta tras normalizar: "configurar" dentro de una frase no es un comando.
import { claveCategoria } from '../dominio/categorias.ts';

export type Comando = 'configurar' | 'configurar_ingresos' | 'ver_configuracion' | 'borrar_ticket';

const COMANDOS: Record<string, Comando> = {
  configurar: 'configurar',
  'configurar ingresos': 'configurar_ingresos',
  'ver configuracion': 'ver_configuracion',
  'borra el ticket': 'borrar_ticket',
  'borrar ticket': 'borrar_ticket',
  'borra ticket': 'borrar_ticket',
  'borrar el ticket': 'borrar_ticket',
};

/** Minúsculas, sin acentos, sin puntuación final y con espacios colapsados. */
export function normalizarComando(texto: string): string {
  return claveCategoria(texto)
    .replace(/\s+/g, ' ')
    .replace(/^[¡¿\s]+/, '')
    .replace(/[.!?¡¿\s]+$/, '');
}

export function reconocerComando(texto: string): Comando | null {
  return COMANDOS[normalizarComando(texto)] ?? null;
}
