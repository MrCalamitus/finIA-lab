import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cargarConfig } from '../../src/config.ts';

const minimo = {
  FINIA_GROUP_JID: '120363000000000000@g.us',
  FINIA_OLLAMA_MODEL: 'modelo-de-prueba',
};

test('aplica los valores por defecto', () => {
  const config = cargarConfig(minimo);
  assert.equal(config.grupoJid, '120363000000000000@g.us');
  assert.equal(config.ollamaModelo, 'modelo-de-prueba');
  assert.equal(config.ollamaUrl, 'http://127.0.0.1:11434');
  assert.equal(config.timeoutMs, 20000);
  assert.equal(config.authDir, './auth_info');
  assert.equal(config.dbPath, './data/finia.db');
  assert.equal(config.logLevel, 'info');
});

test('lee los valores dados', () => {
  const config = cargarConfig({ ...minimo, FINIA_LLM_TIMEOUT_MS: '9000', FINIA_LOG_LEVEL: 'debug' });
  assert.equal(config.timeoutMs, 9000);
  assert.equal(config.logLevel, 'debug');
});

for (const variable of ['FINIA_GROUP_JID', 'FINIA_OLLAMA_MODEL'] as const) {
  test(`si falta ${variable}, el error la nombra sin mostrar valores`, () => {
    const env: Record<string, string> = { ...minimo, FINIA_OLLAMA_URL: 'http://10.0.0.5:11434' };
    delete env[variable];
    assert.throws(
      () => cargarConfig(env),
      (error: Error) => {
        assert.match(error.message, new RegExp(variable));
        for (const valor of Object.values(env)) assert.ok(!error.message.includes(valor), `filtró ${valor}`);
        return true;
      },
    );
  });
}

test('un valor inválido se nombra sin mostrarse', () => {
  assert.throws(
    () => cargarConfig({ ...minimo, FINIA_LLM_TIMEOUT_MS: 'secreto-raro' }),
    (error: Error) => /FINIA_LLM_TIMEOUT_MS/.test(error.message) && !error.message.includes('secreto-raro'),
  );
});

const urlsLocales = [
  'http://localhost:11434',
  'http://127.0.0.1:11434',
  'http://10.1.2.3:11434',
  'http://172.16.0.10:11434',
  'http://172.31.255.1:11434',
  'http://192.168.1.50:11434',
  'http://[::1]:11434',
];
for (const url of urlsLocales) {
  test(`FR-017: acepta Ollama local o de red privada ${url}`, () => {
    assert.equal(cargarConfig({ ...minimo, FINIA_OLLAMA_URL: url }).ollamaUrl, url);
  });
}

const urlsExternas = [
  'https://api.ejemplo.com',
  'http://8.8.8.8:11434',
  'http://172.32.0.1:11434',
  'http://192.169.0.1:11434',
  'http://localhost.ejemplo.com:11434',
  'http://10.0.0.1.nip.io:11434',
  'no-es-url',
  'ftp://127.0.0.1',
];
for (const url of urlsExternas) {
  test(`FR-017: rechaza Ollama fuera de la red local ${url}`, () => {
    assert.throws(() => cargarConfig({ ...minimo, FINIA_OLLAMA_URL: url }), /FINIA_OLLAMA_URL/);
  });
}
