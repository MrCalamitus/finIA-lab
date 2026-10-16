// FR-021 y constitución I: las imágenes se validan por tipo, tamaño y bytes reales.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { WAMessage } from 'baileys';
import { prepararMensaje } from '../../src/canal/whatsapp.ts';
import { MAX_BYTES_IMAGEN, validarMensajeEntrante, type MensajeEntrante } from '../../src/tipos.ts';

const GRUPO = '120363000000000000@g.us';
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);

const base = (imagen: MensajeEntrante['imagen']): MensajeEntrante => ({
  id: `${GRUPO}:F1`,
  remoteJid: GRUPO,
  fromMe: true,
  texto: null,
  citadoId: null,
  enviadoEn: new Date(2026, 9, 13, 12),
  imagen,
});

test('acepta JPEG y PNG con sus bytes correctos', () => {
  assert.ok(validarMensajeEntrante(base({ mime: 'image/jpeg', bytes: JPEG })));
  assert.ok(validarMensajeEntrante(base({ mime: 'image/png', bytes: PNG })));
});

const rechazadas: Record<string, unknown> = {
  gif: { mime: 'image/gif', bytes: JPEG },
  webp: { mime: 'image/webp', bytes: JPEG },
  pdf: { mime: 'application/pdf', bytes: PDF },
  'PNG declarado con contenido PDF': { mime: 'image/png', bytes: PDF },
  'JPEG declarado con bytes PNG': { mime: 'image/jpeg', bytes: PNG },
  vacía: { mime: 'image/jpeg', bytes: new Uint8Array() },
  '5 MB + 1 byte': { mime: 'image/jpeg', bytes: (() => { const b = new Uint8Array(MAX_BYTES_IMAGEN + 1); b.set(JPEG); return b; })() },
  'bytes como texto': { mime: 'image/jpeg', bytes: 'ffd8ff' },
};
for (const [nombre, imagen] of Object.entries(rechazadas)) {
  test(`rechaza imagen: ${nombre}`, () => {
    assert.equal(validarMensajeEntrante(base(imagen as MensajeEntrante['imagen'])), null);
  });
}

test('justo 5 MB se acepta', () => {
  const b = new Uint8Array(MAX_BYTES_IMAGEN);
  b.set(JPEG);
  assert.ok(validarMensajeEntrante(base({ mime: 'image/jpeg', bytes: b })));
});

const crudo = (imageMessage: Record<string, unknown>) =>
  ({ key: { remoteJid: GRUPO, id: 'F1', fromMe: true }, messageTimestamp: 1_760_000_000, message: { imageMessage } }) as unknown as WAMessage;

test('prepararMensaje descarga una foto válida y usa el pie de foto como texto', async () => {
  let descargas = 0;
  const m = await prepararMensaje(crudo({ mimetype: 'image/jpeg', fileLength: JPEG.length, caption: 'súper de ayer' }), async () => {
    descargas++;
    return Buffer.from(JPEG);
  });
  assert.equal(descargas, 1);
  assert.equal(m?.texto, 'súper de ayer');
  assert.equal(m?.imagen?.mime, 'image/jpeg');
  assert.deepEqual([...m!.imagen!.bytes], [...JPEG]);
  assert.equal(m?.imagenRechazada ?? false, false);
});

for (const [nombre, imageMessage] of Object.entries({
  'fileLength declarado > 5 MB': { mimetype: 'image/jpeg', fileLength: MAX_BYTES_IMAGEN + 1 },
  'tipo no permitido': { mimetype: 'image/gif', fileLength: 100 },
  'sin fileLength': { mimetype: 'image/jpeg' },
})) {
  test(`prepararMensaje no descarga y marca la imagen como rechazada: ${nombre}`, async () => {
    let descargas = 0;
    const m = await prepararMensaje(crudo(imageMessage), async () => {
      descargas++;
      return Buffer.from(JPEG);
    });
    assert.equal(descargas, 0);
    assert.equal(m?.imagen ?? null, null);
    assert.equal(m?.imagenRechazada, true);
  });
}

test('prepararMensaje rechaza si los bytes descargados no son de la imagen declarada', async () => {
  const m = await prepararMensaje(crudo({ mimetype: 'image/png', fileLength: PDF.length }), async () => Buffer.from(PDF));
  assert.equal(m?.imagen ?? null, null);
  assert.equal(m?.imagenRechazada, true);
});

test('prepararMensaje rechaza si la descarga falla', async () => {
  const m = await prepararMensaje(crudo({ mimetype: 'image/jpeg', fileLength: 10 }), async () => {
    throw new Error('red');
  });
  assert.equal(m?.imagenRechazada, true);
});
