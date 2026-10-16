// Configuración desde variables de entorno (constitución IV, contracts/configuracion.md).
import { isIP } from 'node:net';
import { z } from 'zod';

export type NivelLog = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  grupoJid: string;
  ollamaUrl: string;
  ollamaModelo: string;
  timeoutMs: number;
  ollamaModeloVision: string;
  visionTimeoutMs: number;
  authDir: string;
  dbPath: string;
  logLevel: NivelLog;
}

/** FR-017: Ollama solo en la máquina (loopback) o en la red privada (RFC 1918). */
export function esHostLocal(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host === '::1') return true;
  if (isIP(host) !== 4) return false;
  const [a = -1, b = -1] = host.split('.').map(Number);
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function urlLocal(valor: string): boolean {
  try {
    const url = new URL(valor);
    return (url.protocol === 'http:' || url.protocol === 'https:') && esHostLocal(url.hostname);
  } catch {
    return false;
  }
}

const esquema = z.object({
  FINIA_GROUP_JID: z.string().regex(/^\d+(-\d+)?@g\.us$/),
  FINIA_OLLAMA_URL: z.string().default('http://127.0.0.1:11434').refine(urlLocal),
  FINIA_OLLAMA_MODEL: z.string().min(1),
  FINIA_LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(20_000),
  FINIA_OLLAMA_MODEL_VISION: z.string().optional(),
  FINIA_VISION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),
  FINIA_AUTH_DIR: z.string().min(1).default('./auth_info'),
  FINIA_DB_PATH: z.string().min(1).default('./data/finia.db'),
  FINIA_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

/** Lee y valida la configuración. Los errores nombran la variable, nunca su valor. */
export function cargarConfig(env: Record<string, string | undefined> = process.env): Config {
  const resultado = esquema.safeParse(env);
  if (!resultado.success) {
    const variables = [...new Set(resultado.error.issues.map((i) => String(i.path[0])))];
    throw new Error(
      `Configuración inválida o incompleta: ${variables.join(', ')}. ` +
        'Revisa .env (plantilla en .env.example y detalle en contracts/configuracion.md).',
    );
  }
  const v = resultado.data;
  return {
    grupoJid: v.FINIA_GROUP_JID,
    ollamaUrl: v.FINIA_OLLAMA_URL,
    ollamaModelo: v.FINIA_OLLAMA_MODEL,
    timeoutMs: v.FINIA_LLM_TIMEOUT_MS,
    ollamaModeloVision: v.FINIA_OLLAMA_MODEL_VISION?.trim() || v.FINIA_OLLAMA_MODEL,
    visionTimeoutMs: v.FINIA_VISION_TIMEOUT_MS,
    authDir: v.FINIA_AUTH_DIR,
    dbPath: v.FINIA_DB_PATH,
    logLevel: v.FINIA_LOG_LEVEL,
  };
}
