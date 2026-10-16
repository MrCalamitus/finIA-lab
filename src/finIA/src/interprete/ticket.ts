// Contrato de la salida del intérprete de tickets (contracts/ticket.md de la 002). El modelo
// propone texto; el código convierte a centavos, suma y decide (constitución I y II).
import { z } from 'zod';
import { parsearMonto } from '../dominio/dinero.ts';
import { escapar } from '../dominio/formato.ts';
import { paraOllama } from './esquema.ts';

export const MAX_ARTICULOS = 40;

const TextoNulo = (max: number) => z.string().max(max).nullable();

function construir(categoriaParaOllama: z.ZodType<string>, categoriaParaValidar: z.ZodType<string>) {
  const articulo = (categoria: z.ZodType<string>) =>
    z.strictObject({
      descripcion: z.string().min(1).max(60),
      cantidad: TextoNulo(20),
      importe_texto: z.string().max(20),
      descuento_texto: TextoNulo(20),
      categoria,
    });
  const ticket = (categoria: z.ZodType<string>) =>
    z.strictObject({
      es_ticket: z.boolean(),
      comercio: TextoNulo(60),
      fecha: TextoNulo(10),
      total_texto: TextoNulo(20),
      // FR-018e: cifras impresas para cuadrar cuando los artículos no suman el total.
      subtotal_texto: TextoNulo(20).optional(),
      impuesto_texto: TextoNulo(20).optional(),
      descuento_general_texto: TextoNulo(20).optional(),
      // 41 permite detectar "más de 40" y avisar en lugar de truncar (FR-018b).
      articulos: z.array(articulo(categoria)).max(MAX_ARTICULOS + 1),
    });
  return { paraOllama: ticket(categoriaParaOllama), paraValidar: ticket(categoriaParaValidar) };
}

export type SalidaTicket = z.infer<ReturnType<typeof construir>['paraValidar']>;

export interface EsquemaTicket {
  validar(valor: unknown): { ok: true; valor: SalidaTicket } | { ok: false };
  jsonSchema: Record<string, unknown>;
}

/**
 * El JSON Schema para Ollama restringe `categoria` a las de gasto activas. La validación acepta
 * cualquier texto corto ahí: la regla 7 convierte una categoría ajena en "Otros".
 */
export function crearEsquemaTicket(categoriasGasto: readonly string[]): EsquemaTicket {
  const unicas = [...new Set(categoriasGasto)] as [string, ...string[]];
  const { paraOllama: ollama, paraValidar } = construir(z.enum(unicas), z.string().max(30));
  return {
    validar(valor) {
      const r = paraValidar.safeParse(valor);
      return r.success ? { ok: true, valor: r.data } : { ok: false };
    },
    jsonSchema: paraOllama(z.toJSONSchema(ollama)) as Record<string, unknown>,
  };
}

export interface ArticuloTicket {
  descripcion: string;
  cantidad: string | null;
  centavos: number;
  descuentoCentavos: number;
  /** Importe impreso con su descuento por artículo, antes del cuadre de FR-018e. */
  centavosLeidos: number;
  categoria: string;
}

export interface TicketValidado {
  comercio: string | null;
  /** Fecha tal como la propuso el modelo (sin validar contra el calendario). */
  fechaTicket: string | null;
  totalCentavos: number;
  articulos: ArticuloTicket[];
  /** Cuadre aplicado (FR-018e); null si los artículos ya sumaban el total. */
  ajuste: AjusteTicket | null;
}

export interface AjusteTicket {
  impuestoCentavos: number;
  descuentoGeneralCentavos: number;
}

export type ResultadoTicket =
  | { ok: true; ticket: TicketValidado }
  | { ok: false; motivo: 'no_es_ticket' | 'mas_de_40' | 'sin_total' }
  | { ok: false; motivo: 'no_cuadra'; sumaLeida: number; totalLeido: number };

const limpio = (texto: string | null, max: number) => {
  if (texto === null) return null;
  const t = escapar(texto).slice(0, max).trim();
  return t.length > 0 ? t : null;
};

/**
 * Importe de una línea tal como lo imprime el comercio: quita la letra de impuesto final
 * ("93.00T", "275.18 A") y reconoce el signo de cancelación al inicio o al final ("97.08-A").
 * El monto en sí lo sigue convirtiendo `parsearMonto`, que no acepta nada más.
 */
export function leerImporte(texto: string): { centavos: number; negativo: boolean } | null {
  // Espacios dentro del número que deja la impresora: "563. 00", "1 ,234.50", "$ 180".
  let t = texto.trim().replace(/\s*[A-Za-z*]$/, '').trim().replace(/(\d)\s*([.,])\s*(?=\d)/g, '$1$2').replace(/^\$\s+/, '$');
  let negativo = false;
  if (t.endsWith('-')) {
    negativo = true;
    t = t.slice(0, -1).trim();
  }
  if (t.startsWith('-')) {
    negativo = !negativo;
    t = t.slice(1).trim();
  }
  const centavos = parsearMonto(t);
  return centavos === null ? null : { centavos, negativo };
}

const claveDescripcion = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Reparto proporcional de `ajuste` centavos según `montos` (FR-018e): a cada uno le toca
 * floor(ajuste·mᵢ/Σ) y el remanente va a los mayores residuos (empate: orden). Enteros con BigInt
 * para que ajuste·mᵢ no pierda precisión. La suma de las partes es exactamente `ajuste`.
 */
export function repartirProporcional(montos: readonly number[], ajuste: number): number[] {
  const total = montos.reduce((s, m) => s + m, 0);
  if (ajuste === 0 || total === 0) return montos.map(() => 0);
  const X = BigInt(ajuste);
  const S = BigInt(total);
  const partes = montos.map((m) => (X * BigInt(m)) / S);
  const residuos = montos.map((m, i) => ({ i, r: (X * BigInt(m)) % S }));
  let faltan = X - partes.reduce((s, p) => s + p, 0n);
  residuos.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1));
  for (const { i } of residuos) {
    if (faltan === 0n) break;
    partes[i]! += 1n;
    faltan -= 1n;
  }
  return partes.map(Number);
}

/**
 * FR-018e (reglas 6a–6b): solo con un subtotal impreso igual a la suma, prueba en orden
 * suma + impuesto, suma − descuento y suma + impuesto − descuento. Devuelve el primero que cuadra.
 */
function buscarCuadre(salida: SalidaTicket, suma: number, total: number): AjusteTicket | null {
  const positivo = (texto: string | null | undefined) => {
    if (!texto) return 0;
    const l = leerImporte(texto);
    return l ? l.centavos : null;
  };
  const subtotal = salida.subtotal_texto ? leerImporte(salida.subtotal_texto) : null;
  if (!subtotal || subtotal.negativo || subtotal.centavos !== suma) return null;
  const impuesto = positivo(salida.impuesto_texto);
  const descuento = positivo(salida.descuento_general_texto);
  if (impuesto === null || descuento === null) return null;
  const opciones: AjusteTicket[] = [
    { impuestoCentavos: impuesto, descuentoGeneralCentavos: 0 },
    { impuestoCentavos: 0, descuentoGeneralCentavos: descuento },
    { impuestoCentavos: impuesto, descuentoGeneralCentavos: descuento },
  ];
  return (
    opciones.find(
      (o) => (o.impuestoCentavos > 0 || o.descuentoGeneralCentavos > 0) && suma + o.impuestoCentavos - o.descuentoGeneralCentavos === total,
    ) ?? null
  );
}

/** Reglas 1–8 de contracts/ticket.md, en orden. */
export function validarTicket(salida: SalidaTicket, categoriasActivas: readonly string[]): ResultadoTicket {
  if (!salida.es_ticket || salida.articulos.length === 0) return { ok: false, motivo: 'no_es_ticket' };
  if (salida.articulos.length > MAX_ARTICULOS) return { ok: false, motivo: 'mas_de_40' };
  const leido = salida.total_texto === null ? null : leerImporte(salida.total_texto);
  if (leido === null || leido.negativo) return { ok: false, motivo: 'sin_total' };
  const total = leido.centavos;

  let suma = 0;
  let legible = true;
  const articulos: ArticuloTicket[] = [];
  for (const a of salida.articulos) {
    const importe = leerImporte(a.importe_texto);
    const descuento = a.descuento_texto === null ? { centavos: 0, negativo: false } : leerImporte(a.descuento_texto);
    if (importe === null) {
      legible = false;
      continue;
    }
    const descripcion = limpio(a.descripcion, 60) ?? 'Artículo';
    if (importe.negativo) {
      // Cancelación o devolución: anula el último artículo igual (FR-018a, descuento por artículo).
      suma -= importe.centavos;
      const clave = claveDescripcion(descripcion);
      const igual = articulos.findLastIndex((x) => claveDescripcion(x.descripcion) === clave);
      if (igual === -1) {
        legible = false;
        continue;
      }
      const anulado = articulos[igual]!;
      anulado.centavos -= importe.centavos;
      if (anulado.centavos === 0) articulos.splice(igual, 1);
      continue;
    }
    suma += importe.centavos;
    if (descuento === null) {
      legible = false;
      continue;
    }
    suma -= descuento.centavos;
    articulos.push({
      descripcion,
      cantidad: limpio(a.cantidad, 20),
      centavos: importe.centavos - descuento.centavos,
      centavosLeidos: importe.centavos - descuento.centavos,
      descuentoCentavos: descuento.centavos,
      categoria: categoriasActivas.includes(a.categoria) ? a.categoria : 'Otros',
    });
  }
  if (articulos.some((a) => a.centavos <= 0)) legible = false;
  for (const a of articulos) a.centavosLeidos = a.centavos;
  const noCuadra = { ok: false, motivo: 'no_cuadra', sumaLeida: suma, totalLeido: total } as const;
  if (!legible) return noCuadra;

  let ajuste: AjusteTicket | null = null;
  if (suma !== total) {
    ajuste = buscarCuadre(salida, suma, total);
    if (!ajuste) return noCuadra;
    const neto = ajuste.impuestoCentavos - ajuste.descuentoGeneralCentavos;
    const partes = repartirProporcional(articulos.map((a) => a.centavos), Math.abs(neto));
    articulos.forEach((a, i) => {
      a.centavos += Math.sign(neto) * partes[i]!;
    });
    if (articulos.some((a) => a.centavos <= 0)) return noCuadra;
  }

  return {
    ok: true,
    ticket: {
      comercio: limpio(salida.comercio, 60),
      fechaTicket: salida.fecha,
      totalCentavos: total,
      articulos,
      ajuste,
    },
  };
}
