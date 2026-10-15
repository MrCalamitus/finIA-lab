// FR-017 y SC-006: durante un flujo completo, la única conexión HTTP es la del Ollama configurado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBaseDeDatos } from '../../src/almacen/db.ts';
import { crearRepositorio } from '../../src/almacen/repositorio.ts';
import { cargarConfig } from '../../src/config.ts';
import { crearInterpreteOllama } from '../../src/interprete/ollama.ts';
import { crearManejador } from '../../src/manejador.ts';
import { crearCanalFalso } from '../dobles/canal-falso.ts';
import { AHORA, GRUPO } from '../dobles/fabrica.ts';

const respuestasDelModelo: Record<string, unknown> = {
  'gasté 180 en tacos': { accion: 'registrar', movimientos: [{ tipo: 'gasto', monto_texto: '180', categoria: 'Comida', fecha: '2026-10-13' }] },
  '¿cuánto gasté hoy?': { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'hoy' } },
  resumen: { accion: 'resumen' },
};

test('SC-006: registro, consulta y resumen solo llaman a la URL de Ollama configurada', async (t) => {
  const destinos: string[] = [];
  const espia: typeof fetch = async (entrada, init) => {
    const url = String(entrada instanceof Request ? entrada.url : entrada);
    destinos.push(url);
    const cuerpo = JSON.parse(String(init?.body)) as { messages: { role: string; content: string }[] };
    const texto = cuerpo.messages.at(-1)!.content;
    const contenido = JSON.stringify(respuestasDelModelo[texto] ?? { accion: 'no_entendido' });
    return new Response(JSON.stringify({ message: { role: 'assistant', content: contenido } }), {
      headers: { 'content-type': 'application/json' },
    });
  };
  // Cualquier fetch fuera del intérprete también queda registrado.
  t.mock.method(globalThis, 'fetch', espia);

  const config = cargarConfig({
    FINIA_GROUP_JID: GRUPO,
    FINIA_OLLAMA_MODEL: 'modelo-de-prueba',
    FINIA_OLLAMA_URL: 'http://192.168.1.50:11434',
  });
  const repo = crearRepositorio(abrirBaseDeDatos(':memory:', AHORA));
  repo.fijarEstadoConfiguracion('completa');
  const canal = crearCanalFalso(GRUPO, () => AHORA);
  const manejador = crearManejador({
    repo,
    canal,
    grupoJid: GRUPO,
    reloj: () => AHORA,
    interprete: crearInterpreteOllama({ url: config.ollamaUrl, modelo: config.ollamaModelo, timeoutMs: 1000 }),
  });

  let n = 0;
  for (const texto of Object.keys(respuestasDelModelo)) {
    n++;
    manejador.recibir({ id: `${GRUPO}:p${n}`, remoteJid: GRUPO, fromMe: true, texto, citadoId: null, enviadoEn: AHORA });
  }
  await manejador.ocioso();

  assert.deepEqual(canal.enviados.map((m) => m.texto), [
    '✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy',
    '📊 *Gastos hoy*\n*$180.00* · 1 gasto',
    '📊 *Resumen de octubre*\n💰 Ingresos: *$0.00*\n💸 Gastos: *$180.00*\n🔴 Balance: *-$180.00*\n\n*Gasto por categoría*\n```Comida  $180.00```',
  ]);
  assert.equal(destinos.length, 3);
  for (const destino of destinos) assert.equal(destino, 'http://192.168.1.50:11434/api/chat');
});

test('FR-019: Ollama caído o que tarda más del timeout se reporta como no disponible', async () => {
  const caido = crearInterpreteOllama({
    url: 'http://127.0.0.1:11434',
    modelo: 'm',
    timeoutMs: 1000,
    fetch: async () => {
      throw new TypeError('fetch failed');
    },
  });
  await assert.rejects(caido.interpretar('hola', AHORA), { name: 'ErrorInterpreteNoDisponible' });

  const lento = crearInterpreteOllama({
    url: 'http://127.0.0.1:11434',
    modelo: 'm',
    timeoutMs: 1000,
    fetch: (_url, init) =>
      new Promise((_resolver, rechazar) => {
        init?.signal?.addEventListener('abort', () => rechazar(init.signal!.reason));
      }),
  });
  await assert.rejects(lento.interpretar('hola', AHORA), { name: 'ErrorInterpreteNoDisponible' });
});

test('respuestas raras de Ollama no se convierten en acciones', async () => {
  const conTexto = crearInterpreteOllama({
    url: 'http://127.0.0.1:11434',
    modelo: 'm',
    timeoutMs: 1000,
    fetch: async () => new Response(JSON.stringify({ message: { content: 'no es JSON' } })),
  });
  assert.deepEqual(await conTexto.interpretar('hola', AHORA), { accion: 'no_entendido' });

  const sobreRaro = crearInterpreteOllama({
    url: 'http://127.0.0.1:11434',
    modelo: 'm',
    timeoutMs: 1000,
    fetch: async () => new Response(JSON.stringify({ respuesta: 'borrar' })),
  });
  await assert.rejects(sobreRaro.interpretar('hola', AHORA), { name: 'ErrorInterpreteNoDisponible' });

  const error500 = crearInterpreteOllama({
    url: 'http://127.0.0.1:11434',
    modelo: 'm',
    timeoutMs: 1000,
    fetch: async () => new Response('falla', { status: 500 }),
  });
  await assert.rejects(error500.interpretar('hola', AHORA), { name: 'ErrorInterpreteNoDisponible' });
});

// --- 002: imágenes (SC-007, FR-017, FR-023) ---

const JPEG = { mime: 'image/jpeg' as const, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]) };
const CONTEXTO_TICKET = { categorias: ['Comida', 'Otros'], jsonSchema: { type: 'object' } };

test('SC-007: una foto solo viaja a la URL de Ollama configurada, con el modelo de visión', async () => {
  const llamadas: { url: string; cuerpo: Record<string, unknown> }[] = [];
  const interprete = crearInterpreteOllama({
    url: 'http://10.0.0.7:11434',
    modelo: 'texto',
    modeloVision: 'vision',
    timeoutMs: 1000,
    fetch: async (url, init) => {
      llamadas.push({ url: String(url), cuerpo: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ message: { content: '{"es_ticket":false}' } }));
    },
  });
  await interprete.interpretarTicket!(JPEG, AHORA, CONTEXTO_TICKET);
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0]!.url, 'http://10.0.0.7:11434/api/chat');
  assert.equal(llamadas[0]!.cuerpo.model, 'vision');
  assert.equal(llamadas[0]!.cuerpo.think, false);
  const mensajes = llamadas[0]!.cuerpo.messages as { content: string; images?: string[] }[];
  assert.deepEqual(mensajes[1]!.images, [Buffer.from(JPEG.bytes).toString('base64')]);
});

test('FR-023: el modelo de visión que excede su timeout se reporta como no disponible', async () => {
  const lento = crearInterpreteOllama({
    url: 'http://127.0.0.1:11434',
    modelo: 'm',
    timeoutMs: 60_000,
    visionTimeoutMs: 1000,
    fetch: (_url, init) =>
      new Promise((_resolver, rechazar) => {
        init?.signal?.addEventListener('abort', () => rechazar(init.signal!.reason));
      }),
  });
  const inicio = Date.now();
  await assert.rejects(lento.interpretarTicket!(JPEG, AHORA, CONTEXTO_TICKET), { name: 'ErrorInterpreteNoDisponible' });
  assert.ok(Date.now() - inicio < 5000, 'usa el timeout de visión, no el de texto');
});
