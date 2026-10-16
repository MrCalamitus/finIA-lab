// Dinero exacto (constitución II): siempre enteros en centavos de MXN, nunca flotantes.

/** Montos mayores a $50,000.00 requieren confirmación del dueño (FR-005a). */
export const UMBRAL_CONFIRMACION_CENTAVOS = 5_000_000;

/** Máximo de dígitos enteros admitidos; evita números fuera de Number.MAX_SAFE_INTEGER. */
const MAX_DIGITOS_ENTEROS = 12;

const CON_MILES = /^\d{1,3}(?:,\d{3})+(?:\.(\d+))?$/;
const SIN_MILES = /^\d+(?:\.(\d+))?$/;

/**
 * Convierte texto como "12,500", "12.5 mil", "$180", "180 pesos" o "99.90" a centavos.
 * Formato mexicano: coma de miles y punto decimal. Devuelve null si no es un monto válido (> 0).
 */
export function parsearMonto(texto: string): number | null {
  let limpio = texto.trim().toLowerCase().replace(/\s+/g, ' ');
  limpio = limpio.replace(/^\$\s*/, '').replace(/\s*(pesos?|mxn)$/, '');
  let esMil = false;
  if (/\s?mil$/.test(limpio)) {
    esMil = true;
    limpio = limpio.replace(/\s?mil$/, '');
  }
  limpio = limpio.replace(/^\$\s*/, '').trim();

  const coincidencia = CON_MILES.exec(limpio) ?? SIN_MILES.exec(limpio);
  if (!coincidencia) return null;

  const [parteEntera = '', parteDecimal = ''] = limpio.replaceAll(',', '').split('.');
  if (parteEntera.length > MAX_DIGITOS_ENTEROS) return null;
  if (limpio.includes('.') && parteDecimal.length === 0) return null;

  // Con "mil", la parte decimal son pesos (hasta 3 dígitos); sin "mil", centavos (hasta 2).
  const maxDecimales = esMil ? 3 : 2;
  if (parteDecimal.length > maxDecimales) return null;

  const entero = Number(parteEntera);
  const fraccion = Number(parteDecimal.padEnd(maxDecimales, '0') || '0');
  const centavos = esMil ? (entero * 1000 + fraccion) * 100 : entero * 100 + fraccion;

  if (!Number.isSafeInteger(centavos) || centavos <= 0) return null;
  return centavos;
}

const formatoPesos = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

/** 1250000 → "$12,500.00". Trabaja con enteros: los centavos nunca pasan por un flotante. */
export function formatearMonto(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(centavos);
  const pesos = Math.trunc(absoluto / 100);
  const resto = absoluto % 100;
  return `${signo}$${formatoPesos.format(pesos)}.${String(resto).padStart(2, '0')}`;
}

const NUMERO_EN_TEXTO = /\d[\d.,]*\d|\d/g;

/**
 * Anti-alucinación (contracts/interpretacion.md, regla 2): el monto que propone el modelo debe
 * corresponder a un número escrito en el mensaje original, con o sin "mil" después.
 */
export function digitosPresentes(montoTexto: string, textoOriginal: string): boolean {
  const propuesto = parsearMonto(montoTexto);
  if (propuesto === null) return false;
  const texto = textoOriginal.toLowerCase();
  for (const encontrado of texto.matchAll(NUMERO_EN_TEXTO)) {
    const numero = encontrado[0];
    const siguiente = texto.slice((encontrado.index ?? 0) + numero.length);
    const candidatos = [parsearMonto(numero)];
    if (/^\s?mil\b/.test(siguiente)) candidatos.push(parsearMonto(`${numero} mil`));
    if (candidatos.includes(propuesto)) return true;
  }
  return false;
}
