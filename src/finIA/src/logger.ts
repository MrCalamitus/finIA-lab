// Logger mínimo en líneas JSON (research R11). Nunca registra credenciales ni configuración
// sensible (FR-018); el texto de los mensajes solo aparece con nivel debug.
import type { NivelLog } from './config.ts';

const ORDEN: Record<NivelLog, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const CLAVE_SENSIBLE = /^FINIA_|jid|auth|cred|key|token|secret|password|clave|session|sesion/i;

export interface Logger {
  nivel: NivelLog;
  debug(evento: string, campos?: Record<string, unknown>): void;
  info(evento: string, campos?: Record<string, unknown>): void;
  warn(evento: string, campos?: Record<string, unknown>): void;
  error(evento: string, campos?: Record<string, unknown>): void;
  /** Devuelve el texto solo en nivel debug; si no, una marca. */
  textoSeguro(texto: string | null): string;
}

function redactar(valor: unknown, profundidad = 0): unknown {
  if (valor instanceof Error) return { error: valor.name, mensaje: valor.message };
  if (valor === null || typeof valor !== 'object') return valor;
  if (profundidad > 3) return '[…]';
  if (Array.isArray(valor)) return valor.map((v) => redactar(v, profundidad + 1));
  const salida: Record<string, unknown> = {};
  for (const [clave, v] of Object.entries(valor)) {
    salida[clave] = CLAVE_SENSIBLE.test(clave) ? '[redactado]' : redactar(v, profundidad + 1);
  }
  return salida;
}

export function crearLogger(
  nivel: NivelLog = 'info',
  escribir: (linea: string) => void = (linea) => process.stdout.write(`${linea}\n`),
): Logger {
  const emitir = (n: NivelLog, evento: string, campos: Record<string, unknown> = {}) => {
    if (ORDEN[n] < ORDEN[nivel]) return;
    escribir(JSON.stringify({ t: new Date().toISOString(), nivel: n, evento, ...(redactar(campos) as object) }));
  };
  return {
    nivel,
    debug: (e, c) => emitir('debug', e, c),
    info: (e, c) => emitir('info', e, c),
    warn: (e, c) => emitir('warn', e, c),
    error: (e, c) => emitir('error', e, c),
    textoSeguro: (texto) => (nivel === 'debug' ? (texto ?? '') : '[oculto]'),
  };
}

/** Logger compatible con Baileys. Solo pasa el mensaje de texto, nunca los objetos internos. */
export interface LoggerBaileys {
  level: string;
  child(objeto: Record<string, unknown>): LoggerBaileys;
  trace(objeto: unknown, mensaje?: string): void;
  debug(objeto: unknown, mensaje?: string): void;
  info(objeto: unknown, mensaje?: string): void;
  warn(objeto: unknown, mensaje?: string): void;
  error(objeto: unknown, mensaje?: string): void;
  fatal(objeto: unknown, mensaje?: string): void;
}

export function adaptadorBaileys(logger: Logger): LoggerBaileys {
  const minimo: NivelLog = ORDEN[logger.nivel] > ORDEN.warn ? logger.nivel : 'warn';
  const texto = (objeto: unknown, mensaje?: string) =>
    mensaje ?? (typeof objeto === 'string' ? objeto : objeto instanceof Error ? objeto.message : 'evento');
  const adaptador: LoggerBaileys = {
    level: minimo,
    child: () => adaptador,
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (o, m) => {
      if (ORDEN.warn >= ORDEN[minimo]) logger.warn('baileys', { detalle: texto(o, m) });
    },
    error: (o, m) => logger.error('baileys', { detalle: texto(o, m) }),
    fatal: (o, m) => logger.error('baileys', { detalle: texto(o, m) }),
  };
  return adaptador;
}
