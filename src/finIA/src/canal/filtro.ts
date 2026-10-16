// FR-013, FR-014 y FR-016 (research R3): solo texto o fotos del grupo configurado, del dueño (fromMe, porque es un
// grupo de un solo miembro) y que no sea una respuesta del propio asistente.
import type { MensajeEntrante } from '../tipos.ts';

export const MAX_CARACTERES = 500;

export type Clase = 'procesar' | 'ignorar' | 'muy_largo';

export function clasificar(
  mensaje: MensajeEntrante,
  grupoJid: string,
  esEnviado: (id: string) => boolean,
): Clase {
  if (mensaje.remoteJid !== grupoJid) return 'ignorar';
  if (!mensaje.fromMe) return 'ignorar';
  if (esEnviado(mensaje.id)) return 'ignorar';
  const tieneTexto = mensaje.texto !== null && mensaje.texto.trim() !== '';
  const tieneImagen = Boolean(mensaje.imagen) || mensaje.imagenRechazada === true;
  if (!tieneTexto && !tieneImagen) return 'ignorar';
  if (tieneTexto && mensaje.texto!.length > MAX_CARACTERES) return 'muy_largo';
  return 'procesar';
}
