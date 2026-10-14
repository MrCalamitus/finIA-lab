// Cliente de Ollama con fetch nativo (research R5). Solo habla con la URL configurada, que
// config.ts ya restringió a la máquina o la red local (FR-017).
import { z } from 'zod';
import { ErrorInterpreteNoDisponible, type Interprete } from '../tipos.ts';
import { jsonSchemaInterpretacion } from './esquema.ts';
import { instruccionesDelSistema } from './prompt.ts';

export interface OpcionesOllama {
  url: string;
  modelo: string;
  timeoutMs: number;
  fetch?: typeof globalThis.fetch;
}

/** Constitución I: también el sobre de la respuesta HTTP se valida antes de usarlo. */
const RespuestaChat = z.object({ message: z.object({ content: z.string() }) });

export function crearInterpreteOllama(opciones: OpcionesOllama): Interprete {
  const hacerFetch = opciones.fetch ?? globalThis.fetch;
  const endpoint = new URL('/api/chat', opciones.url).toString();

  return {
    async interpretar(texto, fechaReferencia) {
      let cuerpo: unknown;
      try {
        const respuesta = await hacerFetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          signal: AbortSignal.timeout(opciones.timeoutMs),
          body: JSON.stringify({
            model: opciones.modelo,
            stream: false,
            keep_alive: '30m',
            format: jsonSchemaInterpretacion,
            options: { temperature: 0 },
            messages: [
              { role: 'system', content: instruccionesDelSistema(fechaReferencia) },
              { role: 'user', content: texto },
            ],
          }),
        });
        if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
        cuerpo = await respuesta.json();
      } catch (error) {
        throw new ErrorInterpreteNoDisponible(error instanceof Error ? error.message : 'error desconocido');
      }

      const sobre = RespuestaChat.safeParse(cuerpo);
      if (!sobre.success) throw new ErrorInterpreteNoDisponible('respuesta de Ollama con formato inesperado');
      try {
        return JSON.parse(sobre.data.message.content) as unknown;
      } catch {
        return { accion: 'no_entendido' };
      }
    },
  };
}
