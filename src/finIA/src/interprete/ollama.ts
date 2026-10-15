// Cliente de Ollama con fetch nativo (research R5). Solo habla con la URL configurada, que
// config.ts ya restringió a la máquina o la red local (FR-017). Texto e imágenes (002) usan la
// misma llamada; las imágenes, el modelo y el timeout de visión.
import { z } from 'zod';
import { ErrorInterpreteNoDisponible, type Interprete } from '../tipos.ts';
import { jsonSchemaInterpretacion } from './esquema.ts';
import { instruccionesDelSistema, instruccionesTicket } from './prompt.ts';

export interface OpcionesOllama {
  url: string;
  modelo: string;
  timeoutMs: number;
  /** Modelo para fotos de tickets; por defecto, `modelo`. */
  modeloVision?: string;
  /** Tiempo máximo por imagen; por defecto 60 s (FR-023). */
  visionTimeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

/** Constitución I: también el sobre de la respuesta HTTP se valida antes de usarlo. */
const RespuestaChat = z.object({ message: z.object({ content: z.string() }) });

export function crearInterpreteOllama(opciones: OpcionesOllama): Interprete {
  const hacerFetch = opciones.fetch ?? globalThis.fetch;
  const endpoint = new URL('/api/chat', opciones.url).toString();

  /** POST /api/chat y devuelve el contenido del mensaje. Cualquier falla → no disponible. */
  async function llamar(cuerpo: Record<string, unknown>, timeoutMs: number): Promise<string> {
    let datos: unknown;
    try {
      const respuesta = await hacerFetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
        body: JSON.stringify({
          stream: false,
          // Modelos con razonamiento (qwen3, gemma4…): sin esto piensan antes de responder y
          // la latencia supera la meta de SC-001.
          think: false,
          keep_alive: '30m',
          options: { temperature: 0 },
          ...cuerpo,
        }),
      });
      if (!respuesta.ok) {
        const detalle = (await respuesta.text().catch(() => '')).slice(0, 200);
        throw new Error(`HTTP ${respuesta.status}${detalle ? `: ${detalle}` : ''}`);
      }
      datos = await respuesta.json();
    } catch (error) {
      throw new ErrorInterpreteNoDisponible(error instanceof Error ? error.message : 'error desconocido');
    }
    const sobre = RespuestaChat.safeParse(datos);
    if (!sobre.success) throw new ErrorInterpreteNoDisponible('respuesta de Ollama con formato inesperado');
    return sobre.data.message.content;
  }

  const leerJson = (contenido: string, siFalla: unknown): unknown => {
    try {
      return JSON.parse(contenido) as unknown;
    } catch {
      return siFalla;
    }
  };

  return {
    async interpretar(texto, fechaReferencia, contexto) {
      const contenido = await llamar(
        {
          model: opciones.modelo,
          format: contexto?.jsonSchema ?? jsonSchemaInterpretacion,
          messages: [
            { role: 'system', content: instruccionesDelSistema(fechaReferencia, contexto?.categorias) },
            { role: 'user', content: texto },
          ],
        },
        opciones.timeoutMs,
      );
      return leerJson(contenido, { accion: 'no_entendido' });
    },

    async interpretarTicket(imagen, fechaReferencia, contexto) {
      // El pie de foto NO se envía al modelo: solo aporta la fecha, y la lee el código (FR-020).
      const contenido = await llamar(
        {
          model: opciones.modeloVision ?? opciones.modelo,
          format: contexto.jsonSchema,
          messages: [
            { role: 'system', content: instruccionesTicket(fechaReferencia, contexto.categorias) },
            { role: 'user', content: 'Extrae el ticket de la imagen.', images: [Buffer.from(imagen.bytes).toString('base64')] },
          ],
        },
        opciones.visionTimeoutMs ?? 60_000,
      );
      return leerJson(contenido, null);
    },
  };
}
