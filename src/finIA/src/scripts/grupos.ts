// Lista los grupos de la cuenta con su id, para llenar FINIA_GROUP_JID en .env.
// Solo necesita FINIA_AUTH_DIR (opcional); no requiere el resto de la configuración.
import { crearCanalWhatsApp } from '../canal/whatsapp.ts';
import { crearLogger } from '../logger.ts';

const logger = crearLogger('warn');
const canal = crearCanalWhatsApp({
  authDir: process.env.FINIA_AUTH_DIR ?? './auth_info',
  grupoJid: 'ninguno@g.us',
  logger,
  alAbrir: async (socket) => {
    const grupos = await socket.groupFetchAllParticipating();
    console.log('\nTus grupos (copia el id del tuyo a FINIA_GROUP_JID):\n');
    for (const grupo of Object.values(grupos)) {
      console.log(`  ${grupo.subject}  →  ${grupo.id}  (${grupo.participants.length} miembro/s)`);
    }
    console.log('');
    canal.cerrar();
    process.exit(0);
  },
});

console.log('Conectando con WhatsApp. Si es la primera vez, escanea el QR: WhatsApp → Dispositivos vinculados.');
await canal.conectar();
