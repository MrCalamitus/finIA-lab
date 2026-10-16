// Interfaces compartidas. El manejador depende de ellas, no de Baileys ni de Ollama,
// para que las pruebas usen dobles.
import { z } from 'zod';

export interface MensajeEntrante {
  /** `<remoteJid>:<key.id>` */
  id: string;
  remoteJid: string;
  fromMe: boolean;
  texto: string | null;
  /** Id (`<remoteJid>:<stanzaId>`) del mensaje citado, si lo hay. */
  citadoId: string | null;
  enviadoEn: Date;
}

export interface Canal {
  /** Envía un texto al grupo y devuelve el id (`<remoteJid>:<key.id>`) del mensaje enviado. */
  enviar(texto: string): Promise<string>;
}

export interface Interprete {
  /** Devuelve la propuesta del modelo, sin validar. Lanza ErrorInterpreteNoDisponible. */
  interpretar(texto: string, fechaReferencia: Date): Promise<unknown>;
}

export class ErrorInterpreteNoDisponible extends Error {
  override name = 'ErrorInterpreteNoDisponible';
}

const idCorto = z.string().min(1).max(200);

/** Constitución I: todo mensaje que llega de WhatsApp se valida contra este esquema. */
export const esquemaMensajeEntrante = z.strictObject({
  id: idCorto,
  remoteJid: idCorto,
  fromMe: z.boolean(),
  texto: z.string().nullable(),
  citadoId: idCorto.nullable(),
  enviadoEn: z.date().refine((d) => !Number.isNaN(d.getTime())),
});

/** Devuelve el mensaje si es válido o null si está malformado. Nunca lanza. */
export function validarMensajeEntrante(valor: unknown): MensajeEntrante | null {
  const resultado = esquemaMensajeEntrante.safeParse(valor);
  return resultado.success ? resultado.data : null;
}
