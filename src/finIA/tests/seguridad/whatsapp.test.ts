// Constitución I: lo que llega de Baileys se convierte y valida antes de llegar al manejador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WAMessage } from 'baileys';
import { convertirMensaje } from '../../src/canal/whatsapp.ts';

const GRUPO = '120363000000000000@g.us';
const crudo = (cambios: Record<string, unknown>) => ({ key: { remoteJid: GRUPO, id: 'ABC', fromMe: true }, messageTimestamp: 1_760_000_000, ...cambios }) as unknown as WAMessage;

test('convierte un texto simple', () => {
  const m = convertirMensaje(crudo({ message: { conversation: 'gasté 180 en tacos' } }));
  assert.deepEqual(m, {
    id: `${GRUPO}:ABC`,
    remoteJid: GRUPO,
    fromMe: true,
    texto: 'gasté 180 en tacos',
    citadoId: null,
    enviadoEn: new Date(1_760_000_000_000),
  });
});

test('convierte una respuesta citada (extendedTextMessage)', () => {
  const m = convertirMensaje(
    crudo({ message: { extendedTextMessage: { text: 'era 150', contextInfo: { stanzaId: 'BOT1' } } } }),
  );
  assert.equal(m?.texto, 'era 150');
  assert.equal(m?.citadoId, `${GRUPO}:BOT1`);
});

test('acepta messageTimestamp tipo Long', () => {
  const m = convertirMensaje(crudo({ message: { conversation: 'hola' }, messageTimestamp: { toNumber: () => 1_760_000_000 } }));
  assert.equal(m?.enviadoEn.getTime(), 1_760_000_000_000);
});

test('un sticker o imagen llega sin texto', () => {
  assert.equal(convertirMensaje(crudo({ message: { stickerMessage: {} } }))?.texto, null);
});

test('rechaza mensajes malformados', () => {
  assert.equal(convertirMensaje(crudo({ key: { remoteJid: GRUPO, id: 'ABC' }, message: { conversation: 'x' } })), null);
  assert.equal(convertirMensaje(crudo({ messageTimestamp: null, message: { conversation: 'x' } })), null);
  assert.equal(convertirMensaje(crudo({ message: { conversation: 42 } })), null);
  assert.equal(convertirMensaje({} as WAMessage), null);
});
