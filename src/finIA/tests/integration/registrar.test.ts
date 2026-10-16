// US1, escenarios 1–4, 6 y 7; FR-001, FR-002, FR-002a, FR-004, FR-005.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';
import { TEXTOS } from '../../src/acciones/respuestas.ts';

interface Fila {
  id: number;
  tipo: string;
  monto_centavos: number;
  categoria: string;
  fecha: string;
  estado: string;
  indice_en_mensaje: number;
  confirmacion_msg_id: string | null;
  texto_original: string;
}

const movimientos = (e: ReturnType<typeof crearEntorno>) =>
  e.filas<Fila>('SELECT * FROM movimientos ORDER BY id');

test('escenario 1: "gasté 180 en tacos" registra un gasto y confirma', async () => {
  const e = crearEntorno({
    programa: { 'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] } },
  });
  const respuestas = await e.escribir('gasté 180 en tacos');
  assert.deepEqual(respuestas, ['✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy']);
  const [fila] = movimientos(e);
  assert.equal(fila?.tipo, 'gasto');
  assert.equal(fila?.monto_centavos, 18000);
  assert.equal(fila?.categoria, 'Comida');
  assert.equal(fila?.fecha, '2026-10-13');
  assert.equal(fila?.estado, 'vigente');
  assert.equal(fila?.texto_original, 'gasté 180 en tacos');
  assert.equal(fila?.confirmacion_msg_id, e.idUltimaRespuesta());
});

test('escenario 2: "me pagaron 12,500 de la quincena" registra un ingreso de Salario', async () => {
  const texto = 'me pagaron 12,500 de la quincena';
  const e = crearEntorno({
    programa: { [texto]: { accion: 'registrar', movimientos: [mov('ingreso', '12,500', 'Salario')] } },
  });
  assert.deepEqual(await e.escribir(texto), ['✅ Registrado: ingreso de *$12,500.00* · 💼 Salario · hoy']);
  assert.equal(movimientos(e)[0]?.monto_centavos, 1_250_000);
});

test('escenario 3: "ayer gasté 99.90 en el súper" guarda la fecha de ayer y el monto exacto', async () => {
  const texto = 'ayer gasté 99.90 en el súper';
  const e = crearEntorno({
    programa: { [texto]: { accion: 'registrar', movimientos: [mov('gasto', '99.90', 'Comida', '2026-10-12')] } },
  });
  assert.deepEqual(await e.escribir(texto), ['✅ Registrado: gasto de *$99.90* · 🌮 Comida · ayer']);
  const [fila] = movimientos(e);
  assert.equal(fila?.fecha, '2026-10-12');
  assert.equal(fila?.monto_centavos, 9990);
});

test('escenario 4: "hoy comí tacos" no guarda nada y muestra un ejemplo', async () => {
  const e = crearEntorno({ programa: { 'hoy comí tacos': { accion: 'no_entendido' } } });
  assert.deepEqual(await e.escribir('hoy comí tacos'), [TEXTOS.noEntendido]);
  assert.equal(movimientos(e).length, 0);
});

test('FR-004: "Otros" es válido para gasto e ingreso', async () => {
  const e = crearEntorno({
    programa: {
      'gasté 300 en una multa': { accion: 'registrar', movimientos: [mov('gasto', '300', 'Otros')] },
      'me encontré 100': { accion: 'registrar', movimientos: [mov('ingreso', '100', 'Otros')] },
    },
  });
  assert.deepEqual(await e.escribir('gasté 300 en una multa'), ['✅ Registrado: gasto de *$300.00* · 📦 Otros · hoy']);
  assert.deepEqual(await e.escribir('me encontré 100'), ['✅ Registrado: ingreso de *$100.00* · 📦 Otros · hoy']);
});

test('escenario 6: un mensaje con dos movimientos registra ambos y responde una sola vez', async () => {
  const texto = 'gasté 50 en café y 200 en gasolina';
  const e = crearEntorno({
    programa: {
      [texto]: { accion: 'registrar', movimientos: [mov('gasto', '50', 'Comida'), mov('gasto', '200', 'Transporte')] },
    },
  });
  const respuestas = await e.escribir(texto);
  assert.deepEqual(respuestas, [
    '✅ *Registrados 2 movimientos*\n• gasto de *$50.00* · 🌮 Comida · hoy\n• gasto de *$200.00* · 🚌 Transporte · hoy',
  ]);
  const filas = movimientos(e);
  assert.deepEqual(filas.map((f) => [f.monto_centavos, f.indice_en_mensaje]), [[5000, 0], [20000, 1]]);
  assert.ok(filas.every((f) => f.confirmacion_msg_id === e.idUltimaRespuesta()));
});

test('escenario 7: si uno de varios movimientos es inválido, no se guarda ninguno', async () => {
  const texto = 'gasté 50 en café y mucho en gasolina';
  const e = crearEntorno({
    programa: {
      [texto]: { accion: 'registrar', movimientos: [mov('gasto', '50', 'Comida'), mov('gasto', 'mucho', 'Transporte')] },
    },
  });
  assert.deepEqual(await e.escribir(texto), [
    '⚠️ No guardé nada: no entendí "mucho". Envíalo de nuevo, por ejemplo: ```gasté 50 en café y 200 en gasolina```',
  ]);
  assert.equal(movimientos(e).length, 0);
});

test('un mensaje registrado queda en mensajes_procesados como registrado', async () => {
  const e = crearEntorno({
    programa: { 'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] } },
  });
  await e.escribir('gasté 180 en tacos');
  assert.deepEqual(e.filas('SELECT resultado FROM mensajes_procesados'), [{ resultado: 'registrado' }]);
});
