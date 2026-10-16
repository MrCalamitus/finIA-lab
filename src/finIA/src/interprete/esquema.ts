// Contrato de la salida del intérprete (contracts/interpretacion.md). Única fuente de verdad:
// valida la respuesta del modelo y genera el JSON Schema que se envía a Ollama.
import { z } from 'zod';
import { TODAS_LAS_CATEGORIAS } from '../dominio/categorias.ts';

const Categoria = z.enum(TODAS_LAS_CATEGORIAS);
const TextoCorto = z.string().min(1).max(30);

const Movimiento = z.strictObject({
  tipo: z.enum(['gasto', 'ingreso']),
  monto_texto: TextoCorto,
  categoria: Categoria,
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const Consulta = z.strictObject({
  tipo: z.enum(['gasto', 'ingreso', 'ambos']),
  periodo: z.enum(['hoy', 'semana', 'mes', 'mes_concreto']),
  mes: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
  categoria: Categoria.nullish(),
});

const Correccion = z.strictObject({
  campo: z.enum(['monto', 'categoria', 'fecha']),
  nuevo_valor: TextoCorto,
});

const Pista = z.strictObject({
  monto_texto: TextoCorto.nullish(),
  categoria: Categoria.nullish(),
});

const Base = z.strictObject({
  accion: z.enum(['registrar', 'consultar', 'resumen', 'corregir', 'borrar', 'no_entendido']),
  movimientos: z.array(Movimiento).min(1).max(10).nullish(),
  consulta: Consulta.nullish(),
  correccion: Correccion.nullish(),
  pista: Pista.nullish(),
});

const Interpretacion = Base.superRefine((v, ctx) => {
  const falta = (campo: string) => ctx.addIssue({ code: 'custom', path: [campo], message: `falta ${campo}` });
  if (v.accion === 'registrar' && !v.movimientos) falta('movimientos');
  if (v.accion === 'consultar' && !v.consulta) falta('consulta');
  if (v.accion === 'corregir' && !v.correccion) falta('correccion');
  if (v.consulta?.periodo === 'mes_concreto' && !v.consulta.mes) falta('mes');
});

export type Interpretacion = z.infer<typeof Interpretacion>;
export type MovimientoPropuesto = z.infer<typeof Movimiento>;
export type ConsultaPropuesta = z.infer<typeof Consulta>;
export type Accion = Interpretacion['accion'];

export type ResultadoValidacion = { ok: true; valor: Interpretacion } | { ok: false };

export function validarInterpretacion(valor: unknown): ResultadoValidacion {
  const resultado = Interpretacion.safeParse(valor);
  return resultado.success ? { ok: true, valor: resultado.data } : { ok: false };
}

/** Quita claves que la gramática de Ollama no soporta. Las mismas reglas se validan aquí con zod. */
function paraOllama(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(paraOllama);
  if (!valor || typeof valor !== 'object') return valor;
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor)) {
    // `pattern` hace fallar a Ollama 0.32 ("failed to parse grammar"); `$schema` sobra.
    if (clave === 'pattern' || clave === '$schema') continue;
    salida[clave] = paraOllama(v);
  }
  return salida;
}

/** JSON Schema para el parámetro `format` de Ollama (las reglas por acción se validan aquí). */
export const jsonSchemaInterpretacion = paraOllama(z.toJSONSchema(Base)) as Record<string, unknown>;
