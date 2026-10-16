// Contrato de la salida del intérprete (contracts/interpretacion.md de la 001). Única fuente de
// verdad: valida la respuesta del modelo y genera el JSON Schema que se envía a Ollama.
// Desde la 002 las categorías salen de la base: el esquema se genera con ellas.
import { z } from 'zod';
import { CATEGORIAS_GASTO, CATEGORIAS_INGRESO } from '../dominio/categorias.ts';

const TextoCorto = z.string().min(1).max(30);

export interface CategoriasEsquema {
  /** Activas de gasto: las únicas aceptadas para registrar o corregir. */
  gasto: readonly string[];
  /** Activas de ingreso. */
  ingreso: readonly string[];
  /** Todas las que existen (activas o no): aceptadas en consultas (FR-006b). */
  todas?: readonly string[];
}

function enumDe(nombres: readonly string[]) {
  const unicos = [...new Set(nombres)];
  return z.enum(unicos as [string, ...string[]]);
}

function construir(categorias: CategoriasEsquema) {
  const Activa = enumDe([...categorias.gasto, ...categorias.ingreso]);
  const Cualquiera = enumDe([...categorias.gasto, ...categorias.ingreso, ...(categorias.todas ?? [])]);

  const Movimiento = z.strictObject({
    tipo: z.enum(['gasto', 'ingreso']),
    monto_texto: TextoCorto,
    categoria: Activa,
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  const Consulta = z.strictObject({
    tipo: z.enum(['gasto', 'ingreso', 'ambos']),
    periodo: z.enum(['hoy', 'semana', 'mes', 'mes_concreto']),
    mes: z.string().regex(/^\d{4}-\d{2}$/).nullish(),
    categoria: Cualquiera.nullish(),
  });

  const Correccion = z.strictObject({
    campo: z.enum(['monto', 'categoria', 'fecha']),
    nuevo_valor: TextoCorto,
  });

  const Pista = z.strictObject({
    monto_texto: TextoCorto.nullish(),
    categoria: Cualquiera.nullish(),
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

  return { Base, Interpretacion };
}

type Esquemas = ReturnType<typeof construir>;
export type Interpretacion = z.infer<Esquemas['Interpretacion']>;
export type MovimientoPropuesto = NonNullable<Interpretacion['movimientos']>[number];
export type ConsultaPropuesta = NonNullable<Interpretacion['consulta']>;
export type Accion = Interpretacion['accion'];

export type ResultadoValidacion = { ok: true; valor: Interpretacion } | { ok: false };

/** Quita claves que la gramática de Ollama no soporta. Las mismas reglas se validan aquí con zod. */
export function paraOllama(valor: unknown): unknown {
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

export interface EsquemaInterpretacion {
  validar(valor: unknown): ResultadoValidacion;
  /** JSON Schema para el parámetro `format` de Ollama. */
  jsonSchema: Record<string, unknown>;
}

const cache = new Map<string, EsquemaInterpretacion>();

/** Esquema para las categorías dadas. Se cachea por lista: cambia solo si cambian las categorías. */
export function crearEsquemaInterpretacion(categorias: CategoriasEsquema): EsquemaInterpretacion {
  const clave = JSON.stringify([categorias.gasto, categorias.ingreso, categorias.todas ?? []]);
  const existente = cache.get(clave);
  if (existente) return existente;
  const { Base, Interpretacion } = construir(categorias);
  const esquema: EsquemaInterpretacion = {
    validar(valor) {
      const resultado = Interpretacion.safeParse(valor);
      return resultado.success ? { ok: true, valor: resultado.data } : { ok: false };
    },
    jsonSchema: paraOllama(z.toJSONSchema(Base)) as Record<string, unknown>,
  };
  if (cache.size > 20) cache.clear();
  cache.set(clave, esquema);
  return esquema;
}

/** Esquema con las categorías predeterminadas (las de la 001). */
const predeterminado = crearEsquemaInterpretacion({ gasto: CATEGORIAS_GASTO, ingreso: CATEGORIAS_INGRESO });
export const validarInterpretacion = predeterminado.validar;
export const jsonSchemaInterpretacion = predeterminado.jsonSchema;
