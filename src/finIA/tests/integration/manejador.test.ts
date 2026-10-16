import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, GRUPO } from '../dobles/fabrica.ts';
import { TEXTOS } from '../../src/acciones/respuestas.ts';

const contarMovimientos = (e: ReturnType<typeof crearEntorno>) =>
  (e.filas<{ n: number }>('SELECT COUNT(*) AS n FROM movimientos')[0]!).n;

test('FR-019: intérprete no disponible → nada guardado y aviso', async () => {
  const e = crearEntorno();
  e.interprete.noDisponible = true;
  const respuestas = await e.escribir('gasté 10 en chicle');
  assert.deepEqual(respuestas, [TEXTOS.noDisponible]);
  assert.equal(contarMovimientos(e), 0);
});

test('FR-019: un error inesperado del intérprete también avisa sin guardar', async () => {
  const e = crearEntorno({
    programa: () => {
      throw new Error('explotó');
    },
  });
  assert.deepEqual(await e.escribir('gasté 10 en chicle'), [TEXTOS.noDisponible]);
  assert.equal(contarMovimientos(e), 0);
});

test('FR-007/FR-016: salida que no cumple el esquema → nada guardado y ejemplo', async () => {
  const e = crearEntorno({ programa: { 'gasté 180 en tacos': { accion: 'registrar', movimientos: 'muchos' } } });
  assert.deepEqual(await e.escribir('gasté 180 en tacos'), [TEXTOS.noEntendido]);
  assert.equal(contarMovimientos(e), 0);
});

test('FR-007: no_entendido → nada guardado y ejemplo', async () => {
  const e = crearEntorno();
  assert.deepEqual(await e.escribir('hola'), [TEXTOS.noEntendido]);
  assert.equal(contarMovimientos(e), 0);
});

test('un mensaje de más de 500 caracteres no llama al intérprete', async () => {
  const e = crearEntorno();
  assert.deepEqual(await e.escribir('a'.repeat(501)), [TEXTOS.muyLargo]);
  assert.equal(e.interprete.llamadas.length, 0);
});

test('los mensajes ignorados no reciben respuesta ni llaman al intérprete', async () => {
  const e = crearEntorno();
  assert.deepEqual(await e.escribir('gasté 5', { fromMe: false }), []);
  assert.deepEqual(await e.escribir('gasté 5', { remoteJid: '120363999999999999@g.us' }), []);
  assert.deepEqual(await e.escribir(null), []);
  assert.equal(e.interprete.llamadas.length, 0);
});

test('los mensajes se procesan en serie, en orden de llegada', async () => {
  const orden: string[] = [];
  const e = crearEntorno({
    programa: async (texto: string) => {
      orden.push(`inicio ${texto}`);
      await new Promise((r) => setTimeout(r, texto === 'uno' ? 20 : 0));
      orden.push(`fin ${texto}`);
      return { accion: 'no_entendido' };
    },
  });
  e.manejador.recibir(e.mensaje('uno'));
  e.manejador.recibir(e.mensaje('dos'));
  await e.manejador.ocioso();
  assert.deepEqual(orden, ['inicio uno', 'fin uno', 'inicio dos', 'fin dos']);
});

test('el id de cada respuesta queda en mensajes_enviados', async () => {
  const e = crearEntorno();
  await e.escribir('hola');
  const id = e.idUltimaRespuesta()!;
  assert.equal(e.repo.esEnviado(id), true);
});

test('FR-006: un mensaje ya procesado no produce otra respuesta', async () => {
  const e = crearEntorno();
  const m = e.mensaje('hola');
  assert.equal((await e.entregar(m)).length, 1);
  assert.equal((await e.entregar(m)).length, 0);
  assert.equal(e.interprete.llamadas.length, 1);
});

test('FR-014: el eco de una respuesta no se procesa aunque llegue antes de terminar el envío', async () => {
  const e = crearEntorno();
  e.canal.alEco = (eco) => e.manejador.recibir(eco);
  await e.escribir('hola');
  await e.manejador.ocioso();
  assert.equal(e.canal.enviados.length, 1);
  assert.equal(e.interprete.llamadas.length, 1);
});

test('constitución II: si el envío falla se reintenta', async () => {
  const e = crearEntorno();
  e.canal.fallosPendientes = 2;
  assert.deepEqual(await e.escribir('hola'), [TEXTOS.noEntendido]);
});

test('si el envío falla en todos los intentos, el mensaje queda procesado y no se cae la cola', async () => {
  const e = crearEntorno();
  e.canal.fallosPendientes = 3;
  assert.deepEqual(await e.escribir('hola'), []);
  assert.equal(e.repo.yaProcesado(`${GRUPO}:usr-1`), true);
  assert.deepEqual(await e.escribir('hola otra vez'), [TEXTOS.noEntendido]);
});
