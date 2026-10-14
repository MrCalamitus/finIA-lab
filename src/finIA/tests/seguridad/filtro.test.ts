// FR-013 y FR-014: solo se procesan mensajes de texto del grupo configurado, del dueño, y nunca
// las respuestas del propio asistente. Constitución I: todo mensaje externo se valida con esquema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clasificar } from '../../src/canal/filtro.ts';
import { validarMensajeEntrante, type MensajeEntrante } from '../../src/tipos.ts';

const GRUPO = '120363000000000000@g.us';
const enviados = new Set([`${GRUPO}:BOT1`]);
const esEnviado = (id: string) => enviados.has(id);

function mensaje(cambios: Partial<MensajeEntrante> = {}): MensajeEntrante {
  return {
    id: `${GRUPO}:ABC`,
    remoteJid: GRUPO,
    fromMe: true,
    texto: 'gasté 180 en tacos',
    citadoId: null,
    enviadoEn: new Date(2026, 9, 13, 12),
    ...cambios,
  };
}

test('acepta texto del grupo configurado enviado por el dueño', () => {
  assert.equal(clasificar(mensaje(), GRUPO, esEnviado), 'procesar');
});

test('FR-013: ignora mensajes de otro grupo', () => {
  const otro = '120363999999999999@g.us';
  assert.equal(clasificar(mensaje({ remoteJid: otro, id: `${otro}:ABC` }), GRUPO, esEnviado), 'ignorar');
});

test('FR-013: ignora mensajes de un chat privado', () => {
  const privado = '5215512345678@s.whatsapp.net';
  assert.equal(clasificar(mensaje({ remoteJid: privado, id: `${privado}:ABC` }), GRUPO, esEnviado), 'ignorar');
});

test('FR-013: ignora mensajes de otra persona (fromMe=false)', () => {
  assert.equal(clasificar(mensaje({ fromMe: false }), GRUPO, esEnviado), 'ignorar');
});

test('ignora mensajes sin texto (imagen, sticker, audio)', () => {
  assert.equal(clasificar(mensaje({ texto: null }), GRUPO, esEnviado), 'ignorar');
  assert.equal(clasificar(mensaje({ texto: '   ' }), GRUPO, esEnviado), 'ignorar');
});

test('FR-014: ignora las respuestas del propio asistente', () => {
  assert.equal(clasificar(mensaje({ id: `${GRUPO}:BOT1`, texto: 'Registrado: gasto de $180.00 · Comida · hoy' }), GRUPO, esEnviado), 'ignorar');
});

test('marca como muy_largo un texto de más de 500 caracteres', () => {
  assert.equal(clasificar(mensaje({ texto: 'a'.repeat(501) }), GRUPO, esEnviado), 'muy_largo');
  assert.equal(clasificar(mensaje({ texto: 'a'.repeat(500) }), GRUPO, esEnviado), 'procesar');
});

test('constitución I: validarMensajeEntrante acepta un mensaje bien formado', () => {
  assert.deepEqual(validarMensajeEntrante(mensaje()), mensaje());
  assert.deepEqual(validarMensajeEntrante(mensaje({ citadoId: `${GRUPO}:XYZ` })), mensaje({ citadoId: `${GRUPO}:XYZ` }));
});

const malformados: Record<string, unknown> = {
  'null': null,
  'texto plano': 'gasté 180',
  'sin id': (() => { const { id: _id, ...resto } = mensaje(); return resto; })(),
  'id vacío': mensaje({ id: '' }),
  'id de más de 200': mensaje({ id: 'x'.repeat(201) }),
  'remoteJid vacío': mensaje({ remoteJid: '' }),
  'fromMe no booleano': { ...mensaje(), fromMe: 'true' },
  'texto no string': { ...mensaje(), texto: 180 },
  'citadoId no string': { ...mensaje(), citadoId: 42 },
  'citadoId vacío': mensaje({ citadoId: '' }),
  'fecha inválida': mensaje({ enviadoEn: new Date('no es fecha') }),
  'fecha como número': { ...mensaje(), enviadoEn: 1760000000 },
  'propiedad extra': { ...mensaje(), accion: 'borrar' },
};

for (const [nombre, valor] of Object.entries(malformados)) {
  test(`constitución I: validarMensajeEntrante rechaza ${nombre}`, () => {
    assert.equal(validarMensajeEntrante(valor), null);
  });
}
