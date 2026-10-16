// Arranque: configuración → base → intérprete → canal → manejador.
import { abrirBaseDeDatos } from './almacen/db.ts';
import { crearRepositorio } from './almacen/repositorio.ts';
import { crearCanalWhatsApp } from './canal/whatsapp.ts';
import { cargarConfig, type Config } from './config.ts';
import { crearInterpreteOllama } from './interprete/ollama.ts';
import { crearLogger } from './logger.ts';
import { crearManejador } from './manejador.ts';

let config: Config;
try {
  config = cargarConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const logger = crearLogger(config.logLevel);
const db = abrirBaseDeDatos(config.dbPath);
const repo = crearRepositorio(db);
const interprete = crearInterpreteOllama({
  url: config.ollamaUrl,
  modelo: config.ollamaModelo,
  timeoutMs: config.timeoutMs,
});

let manejador: ReturnType<typeof crearManejador> | null = null;
const canal = crearCanalWhatsApp({
  authDir: config.authDir,
  grupoJid: config.grupoJid,
  logger,
  alMensaje: (mensaje) => manejador?.recibir(mensaje),
  alFinalizar: async (motivo) => {
    await manejador?.ocioso();
    db.close();
    console.error(
      motivo === 'sesion_reemplazada'
        ? 'Otra copia del asistente está conectada con esta sesión. Me detengo; deja solo una corriendo.'
        : 'La sesión de WhatsApp se cerró. Vuelve a vincular con: npm run grupos',
    );
    process.exit(1);
  },
});
manejador = crearManejador({ repo, interprete, canal, grupoJid: config.grupoJid, logger });

async function cerrar(senal: string) {
  logger.info('cerrando', { senal });
  canal.cerrar();
  await manejador?.ocioso();
  db.close();
  process.exit(0);
}
process.once('SIGINT', () => void cerrar('SIGINT'));
process.once('SIGTERM', () => void cerrar('SIGTERM'));

logger.info('arranque');
await canal.conectar();
