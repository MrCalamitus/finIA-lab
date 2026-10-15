// Adaptador de Baileys (research R2). Convierte los eventos de WhatsApp en MensajeEntrante
// validados y envía respuestas al grupo. Nunca registra el contenido de la carpeta de sesión.
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  useMultiFileAuthState,
  type WAMessage,
  type WASocket,
} from 'baileys';
import qrcode from 'qrcode-terminal';
import { adaptadorBaileys, type Logger } from '../logger.ts';
import {
  bytesCoinciden,
  MAX_BYTES_IMAGEN,
  validarMensajeEntrante,
  type Canal,
  type MensajeEntrante,
  type MimeImagen,
} from '../tipos.ts';

export interface OpcionesWhatsApp {
  authDir: string;
  grupoJid: string;
  logger: Logger;
  alMensaje?: (mensaje: MensajeEntrante) => void;
  alAbrir?: (socket: WASocket) => void;
  /** La conexión terminó y no se reintentará (sesión cerrada o reemplazada por otra copia). */
  alFinalizar?: (motivo: 'sesion_cerrada' | 'sesion_reemplazada') => void;
}

export interface CanalWhatsApp extends Canal {
  conectar(): Promise<void>;
  cerrar(): void;
}

function aNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  if (valor && typeof valor === 'object' && 'toNumber' in valor && typeof valor.toNumber === 'function') {
    return Number(valor.toNumber());
  }
  return null;
}

function camposComunes(mensaje: WAMessage) {
  const remoteJid = mensaje.key?.remoteJid;
  const segundos = aNumero(mensaje.messageTimestamp);
  const contenido = mensaje.message;
  const stanzaId =
    contenido?.extendedTextMessage?.contextInfo?.stanzaId ?? contenido?.imageMessage?.contextInfo?.stanzaId;
  return {
    id: `${remoteJid}:${mensaje.key?.id}`,
    remoteJid,
    fromMe: mensaje.key?.fromMe,
    citadoId: stanzaId ? `${remoteJid}:${stanzaId}` : null,
    enviadoEn: segundos === null ? undefined : new Date(segundos * 1000),
  };
}

/** WAMessage de texto → MensajeEntrante validado (constitución I), o null si está malformado. */
export function convertirMensaje(mensaje: WAMessage): MensajeEntrante | null {
  const contenido = mensaje.message;
  return validarMensajeEntrante({
    ...camposComunes(mensaje),
    texto: contenido?.conversation ?? contenido?.extendedTextMessage?.text ?? null,
  });
}

const TIPOS_IMAGEN: readonly MimeImagen[] = ['image/jpeg', 'image/png'];

/**
 * Convierte cualquier mensaje. Para fotos (FR-016, FR-021, research R3): revisa tipo y tamaño
 * declarados antes de descargar, descarga con `descargar` y revisa tamaño y bytes reales. Si algo
 * falla, el mensaje llega con `imagenRechazada` para poder avisar. La imagen solo vive en memoria.
 */
export async function prepararMensaje(
  mensaje: WAMessage,
  descargar: (mensaje: WAMessage) => Promise<Uint8Array>,
): Promise<MensajeEntrante | null> {
  const foto = mensaje.message?.imageMessage;
  if (!foto) return convertirMensaje(mensaje);

  const comunes = { ...camposComunes(mensaje), texto: foto.caption ?? null };
  const rechazada = () => validarMensajeEntrante({ ...comunes, imagen: null, imagenRechazada: true });
  const mime = foto.mimetype?.split(';')[0]?.trim() as MimeImagen | undefined;
  const declarado = aNumero(foto.fileLength);
  if (!mime || !TIPOS_IMAGEN.includes(mime) || declarado === null || declarado > MAX_BYTES_IMAGEN) return rechazada();

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await descargar(mensaje));
  } catch {
    return rechazada();
  }
  if (bytes.length === 0 || bytes.length > MAX_BYTES_IMAGEN || !bytesCoinciden(mime, bytes)) return rechazada();
  return validarMensajeEntrante({ ...comunes, imagen: { mime, bytes } });
}

export function crearCanalWhatsApp(opciones: OpcionesWhatsApp): CanalWhatsApp {
  const { logger } = opciones;
  let socket: WASocket | null = null;
  let cerrado = false;
  let enOrden: Promise<void> = Promise.resolve();

  async function conectar(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(opciones.authDir);
    const nuevo = makeWASocket({
      auth: state,
      logger: adaptadorBaileys(logger),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    socket = nuevo;

    nuevo.ev.on('creds.update', saveCreds);

    nuevo.ev.on('connection.update', (cambio) => {
      if (cambio.qr) {
        logger.info('qr', { indicacion: 'Escanea con WhatsApp → Dispositivos vinculados' });
        qrcode.generate(cambio.qr, { small: true });
      }
      if (cambio.connection === 'open') {
        logger.info('whatsapp_conectado');
        opciones.alAbrir?.(nuevo);
      }
      if (cambio.connection === 'close') {
        const error = cambio.lastDisconnect?.error as { output?: { statusCode?: number } } | undefined;
        const codigo = error?.output?.statusCode;
        if (codigo === DisconnectReason.loggedOut) {
          logger.error('whatsapp_sesion_cerrada', {
            indicacion: 'La sesión se cerró desde el teléfono. Borra la carpeta de sesión y vuelve a vincular.',
          });
          opciones.alFinalizar?.('sesion_cerrada');
          return;
        }
        if (codigo === DisconnectReason.connectionReplaced) {
          // Otra copia del asistente abrió la misma sesión. Reconectar haría que ambas se
          // expulsen en bucle (y podrían responder dos veces): esta copia se detiene.
          logger.error('whatsapp_sesion_reemplazada', {
            indicacion: 'Otra copia del asistente está usando esta sesión. Deja solo una corriendo.',
          });
          opciones.alFinalizar?.('sesion_reemplazada');
          return;
        }
        if (cerrado) return;
        logger.warn('whatsapp_reconectando', { codigo });
        setTimeout(() => void conectar().catch((e: unknown) => logger.error('reconexion_fallida', { error: e })), 2000);
      }
    });

    const descargar = async (msg: WAMessage) =>
      new Uint8Array(await downloadMediaMessage(msg, 'buffer', {}, { logger: adaptadorBaileys(logger), reuploadRequest: nuevo.updateMediaMessage }));

    nuevo.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const crudo of messages) {
        // FR-013/FR-016: nada de otro chat ni de otra persona se descarga ni se procesa.
        if (crudo.key?.remoteJid !== opciones.grupoJid || crudo.key?.fromMe !== true) continue;
        // En cadena: la descarga de una foto no debe adelantar ni atrasar el orden de los mensajes.
        enOrden = enOrden
          .then(async () => {
            const mensaje = await prepararMensaje(crudo, descargar);
            if (!mensaje) {
              logger.warn('mensaje_malformado', { id: crudo.key?.id ?? null });
              return;
            }
            opciones.alMensaje?.(mensaje);
          })
          .catch((error: unknown) => logger.error('mensaje_no_preparado', { error }));
      }
    });
  }

  return {
    conectar,
    async enviar(texto) {
      if (!socket) throw new Error('WhatsApp no está conectado');
      const enviado = await socket.sendMessage(opciones.grupoJid, { text: texto });
      const id = enviado?.key?.id;
      if (!id) throw new Error('WhatsApp no devolvió id del mensaje enviado');
      return `${opciones.grupoJid}:${id}`;
    },
    cerrar() {
      cerrado = true;
      socket?.end(undefined);
    },
  };
}
