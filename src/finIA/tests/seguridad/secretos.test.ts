// FR-018 y constitución IV: ningún secreto en el repo ni en los registros de actividad.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { crearLogger } from '../../src/logger.ts';

const raiz = new URL('../../', import.meta.url);

test('.gitignore excluye secretos y datos', () => {
  const lineas = readFileSync(new URL('.gitignore', raiz), 'utf8').split('\n').map((l) => l.trim());
  for (const patron of ['.env', '.env.local', 'auth_info*/', 'data/']) {
    assert.ok(lineas.includes(patron), `falta ${patron} en .gitignore`);
  }
});

test('.env.example solo tiene valores de ejemplo', () => {
  const contenido = readFileSync(new URL('.env.example', raiz), 'utf8');
  assert.doesNotMatch(contenido, /\b\d{10,13}@s\.whatsapp\.net\b/, 'no debe contener números de teléfono');
  const jids = contenido.match(/\d+@g\.us/g) ?? [];
  assert.deepEqual(jids, ['120363000000000000@g.us']);
  assert.doesNotMatch(contenido, /\+?52\d{10}/, 'no debe contener teléfonos mexicanos');
});

function capturar(nivel: 'debug' | 'info' | 'warn' | 'error') {
  const lineas: string[] = [];
  const logger = crearLogger(nivel, (linea) => lineas.push(linea));
  return { logger, lineas };
}

test('el logger oculta variables FINIA_* y campos sensibles', () => {
  const { logger, lineas } = capturar('debug');
  logger.info('arranque', {
    FINIA_GROUP_JID: '120363111111111111@g.us',
    FINIA_OLLAMA_MODEL: 'modelo-secreto',
    creds: { noiseKey: 'clave-privada' },
    authDir: './auth_info',
    accion: 'registrar',
  });
  const salida = lineas.join('\n');
  for (const valor of ['120363111111111111@g.us', 'modelo-secreto', 'clave-privada', './auth_info']) {
    assert.ok(!salida.includes(valor), `filtró ${valor}`);
  }
  assert.match(salida, /registrar/);
});

test('el texto del mensaje solo aparece con nivel debug', () => {
  const info = capturar('info');
  info.logger.info('mensaje', { texto: info.logger.textoSeguro('gasté 180 en tacos') });
  assert.ok(!info.lineas.join('').includes('tacos'));

  const debug = capturar('debug');
  debug.logger.info('mensaje', { texto: debug.logger.textoSeguro('gasté 180 en tacos') });
  assert.ok(debug.lineas.join('').includes('tacos'));
});

test('el logger respeta el nivel mínimo', () => {
  const { logger, lineas } = capturar('warn');
  logger.debug('a');
  logger.info('b');
  logger.warn('c');
  logger.error('d');
  assert.equal(lineas.length, 2);
});
