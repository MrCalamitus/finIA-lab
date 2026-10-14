// Adaptador de Baileys (research R2). Convierte los eventos de WhatsApp en MensajeEntrante
// validados y envía respuestas al grupo. Nunca registra el contenido de la carpeta de sesión.
import makeWASocket, { DisconnectReason, useMultiFileAuthState, type WAMessage, type WASocket } from 'baileys';
import qrcode from 'qrcode-terminal';
import { adaptadorBaileys, type Logger } from '../logger.ts';
import { validarMensajeEntrante, type Canal, type MensajeEntrante } from '../tipos.ts';

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

/** WAMessage → MensajeEntrante validado (constitución I), o null si está malformado. */
export function convertirMensaje(mensaje: WAMessage): MensajeEntrante | null {
  const remoteJid = mensaje.key?.remoteJid;
  const segundos = aNumero(mensaje.messageTimestamp);
  const contenido = mensaje.message;
  const stanzaId = contenido?.extendedTextMessage?.contextInfo?.stanzaId;
  return validarMensajeEntrante({
    id: `${remoteJid}:${mensaje.key?.id}`,
    remoteJid,
    fromMe: mensaje.key?.fromMe,
    texto: contenido?.conversation ?? contenido?.extendedTextMessage?.text ?? null,
    citadoId: stanzaId ? `${remoteJid}:${stanzaId}` : null,
    enviadoEn: segundos === null ? undefined : new Date(segundos * 1000),
  });
}

export function crearCanalWhatsApp(opciones: OpcionesWhatsApp): CanalWhatsApp {
  const { logger } = opciones;
  let socket: WASocket | null = null;
  let cerrado = false;

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

    nuevo.ev.on('messages.upsert', ({ messages, type }) => {
      if (type !== 'notify' && type !== 'append') return;
      for (const crudo of messages) {
        if (crudo.key?.remoteJid !== opciones.grupoJid) continue;
        const mensaje = convertirMensaje(crudo);
        if (!mensaje) {
          logger.warn('mensaje_malformado', { id: crudo.key?.id ?? null });
          continue;
        }
        opciones.alMensaje?.(mensaje);
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
