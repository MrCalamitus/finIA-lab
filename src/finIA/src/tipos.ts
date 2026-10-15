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
  /** Foto adjunta, ya descargada y verificada (002). El texto, si hay, es el pie de foto. */
  imagen?: ImagenEntrante | null;
  /** Llegó una imagen que no se pudo aceptar (tipo, tamaño o bytes); hay que avisar (FR-021). */
  imagenRechazada?: boolean;
}

export type MimeImagen = 'image/jpeg' | 'image/png';

export interface ImagenEntrante {
  mime: MimeImagen;
  bytes: Uint8Array;
}

/** FR-021: hasta 5 MB. */
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

const NUMEROS_MAGICOS: Record<MimeImagen, number[]> = {
  'image/jpeg': [0xff, 0xd8, 0xff],
  'image/png': [0x89, 0x50, 0x4e, 0x47],
};

/** ¿Los bytes empiezan como el tipo declarado? (no se confía en el mimetype de WhatsApp). */
export function bytesCoinciden(mime: MimeImagen, bytes: Uint8Array): boolean {
  return NUMEROS_MAGICOS[mime].every((b, i) => bytes[i] === b);
}

export interface Canal {
  /** Envía un texto al grupo y devuelve el id (`<remoteJid>:<key.id>`) del mensaje enviado. */
  enviar(texto: string): Promise<string>;
}

/** Categorías de gasto activas y el JSON Schema del ticket generado con ellas (002). */
export interface ContextoTicket {
  categorias: readonly string[];
  jsonSchema: Record<string, unknown>;
}

/** Categorías vigentes y el JSON Schema generado con ellas (002). */
export interface ContextoInterprete {
  categorias: { gasto: readonly string[]; ingreso: readonly string[] };
  jsonSchema: Record<string, unknown>;
}

export interface Interprete {
  /** Devuelve la propuesta del modelo, sin validar. Lanza ErrorInterpreteNoDisponible. */
  interpretar(texto: string, fechaReferencia: Date, contexto?: ContextoInterprete): Promise<unknown>;
  /** Propone el contenido de un ticket a partir de la foto (002). Lanza ErrorInterpreteNoDisponible. */
  interpretarTicket?(imagen: ImagenEntrante, fechaReferencia: Date, contexto: ContextoTicket): Promise<unknown>;
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
  imagen: z
    .strictObject({
      mime: z.enum(['image/jpeg', 'image/png']),
      bytes: z.instanceof(Uint8Array).refine((b) => b.length > 0 && b.length <= MAX_BYTES_IMAGEN),
    })
    .refine((i) => bytesCoinciden(i.mime, i.bytes))
    .nullish(),
  imagenRechazada: z.boolean().optional(),
});

/** Devuelve el mensaje si es válido o null si está malformado. Nunca lanza. */
export function validarMensajeEntrante(valor: unknown): MensajeEntrante | null {
  const resultado = esquemaMensajeEntrante.safeParse(valor);
  return resultado.success ? resultado.data : null;
}
