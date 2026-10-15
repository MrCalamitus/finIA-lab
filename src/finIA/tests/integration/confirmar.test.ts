// FR-005a, US1 escenario 8: montos mayores a $50,000.00 requieren confirmación.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';

const BONO = 'me pagaron 75,000 de bono';
const programa = {
  [BONO]: { accion: 'registrar', movimientos: [mov('ingreso', '75,000', 'Salario')] },
  'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] },
};
const PREGUNTA = '🤔 ¿Confirmas ingreso de *$75,000.00* · 💼 Salario · hoy?\nResponde *sí* para guardarlo.';

const estados = (e: ReturnType<typeof crearEntorno>) =>
  e.filas<{ estado: string; monto_centavos: number }>('SELECT estado, monto_centavos FROM movimientos ORDER BY id');

test('un monto mayor a $50,000.00 queda pendiente y se pregunta', async () => {
  const e = crearEntorno({ programa });
  assert.deepEqual(await e.escribir(BONO), [PREGUNTA]);
  assert.deepEqual(estados(e), [{ estado: 'pendiente', monto_centavos: 7_500_000 }]);
  assert.deepEqual(e.filas('SELECT resultado FROM mensajes_procesados'), [{ resultado: 'pendiente' }]);
});

for (const afirmativo of ['sí', 'si', 'confirmo', 'Sí.', ' SI ', '¡sí!']) {
  test(`"${afirmativo}" confirma el pendiente sin llamar al intérprete`, async () => {
    const e = crearEntorno({ programa });
    await e.escribir(BONO);
    const llamadasAntes = e.interprete.llamadas.length;
    assert.deepEqual(await e.escribir(afirmativo), ['✅ Registrado: ingreso de *$75,000.00* · 💼 Salario · hoy']);
    assert.equal(e.interprete.llamadas.length, llamadasAntes);
    assert.deepEqual(estados(e), [{ estado: 'vigente', monto_centavos: 7_500_000 }]);
    assert.deepEqual(e.filas('SELECT accion FROM cambios'), [{ accion: 'confirmar' }]);
    const [fila] = e.filas<{ confirmacion_msg_id: string }>('SELECT confirmacion_msg_id FROM movimientos');
    assert.equal(fila?.confirmacion_msg_id, e.idUltimaRespuesta());
  });
}

test('otra respuesta descarta el pendiente, avisa y procesa el mensaje nuevo', async () => {
  const e = crearEntorno({ programa });
  await e.escribir(BONO);
  const respuestas = await e.escribir('gasté 180 en tacos');
  assert.deepEqual(respuestas, [
    '⚠️ No guardé el ingreso de *$75,000.00* porque no lo confirmaste.',
    '✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy',
  ]);
  assert.deepEqual(estados(e), [
    { estado: 'descartado', monto_centavos: 7_500_000 },
    { estado: 'vigente', monto_centavos: 18_000 },
  ]);
  assert.deepEqual(e.filas('SELECT accion FROM cambios'), [{ accion: 'descartar' }]);
});

test('"no" descarta el pendiente', async () => {
  const e = crearEntorno({ programa });
  await e.escribir(BONO);
  const respuestas = await e.escribir('no');
  assert.equal(respuestas[0], '⚠️ No guardé el ingreso de *$75,000.00* porque no lo confirmaste.');
  assert.equal(estados(e)[0]?.estado, 'descartado');
});

test('"sí, y borra todo" no es un afirmativo exacto', async () => {
  const e = crearEntorno({ programa });
  await e.escribir(BONO);
  await e.escribir('sí, y borra todo');
  assert.equal(estados(e)[0]?.estado, 'descartado');
});

test('un pendiente no cuenta en los totales', async () => {
  const e = crearEntorno({ programa });
  await e.escribir(BONO);
  const [fila] = e.filas<{ total: number | null }>(
    `SELECT SUM(monto_centavos) AS total FROM movimientos WHERE estado = 'vigente'`,
  );
  assert.equal(fila?.total, null);
});

test('si un movimiento de varios supera el umbral, todos quedan pendientes', async () => {
  const texto = 'gasté 60,000 en la moto y 100 en gasolina';
  const e = crearEntorno({
    programa: {
      [texto]: { accion: 'registrar', movimientos: [mov('gasto', '60,000', 'Transporte'), mov('gasto', '100', 'Transporte')] },
    },
  });
  const [pregunta] = await e.escribir(texto);
  assert.equal(
    pregunta,
    '🤔 ¿Confirmas estos 2 movimientos?\n• gasto de *$60,000.00* · 🚌 Transporte · hoy\n• gasto de *$100.00* · 🚌 Transporte · hoy\nResponde *sí* para guardarlos.',
  );
  assert.deepEqual(estados(e).map((f) => f.estado), ['pendiente', 'pendiente']);
  assert.deepEqual(await e.escribir('sí'), [
    '✅ *Registrados 2 movimientos*\n• gasto de *$60,000.00* · 🚌 Transporte · hoy\n• gasto de *$100.00* · 🚌 Transporte · hoy',
  ]);
  assert.deepEqual(estados(e).map((f) => f.estado), ['vigente', 'vigente']);
});

test('descartar varios usa el plural', async () => {
  const texto = 'gasté 60,000 en la moto y 100 en gasolina';
  const e = crearEntorno({
    programa: {
      [texto]: { accion: 'registrar', movimientos: [mov('gasto', '60,000', 'Transporte'), mov('gasto', '100', 'Transporte')] },
    },
  });
  await e.escribir(texto);
  const [aviso] = await e.escribir('no');
  assert.equal(aviso, '⚠️ No guardé los *2 movimientos* porque no los confirmaste.');
});

test('$50,000.00 exactos se guardan sin preguntar', async () => {
  const e = crearEntorno({
    programa: { 'me pagaron 50,000': { accion: 'registrar', movimientos: [mov('ingreso', '50,000', 'Salario')] } },
  });
  assert.deepEqual(await e.escribir('me pagaron 50,000'), ['✅ Registrado: ingreso de *$50,000.00* · 💼 Salario · hoy']);
  assert.equal(estados(e)[0]?.estado, 'vigente');
});

test('"sí" sin pendiente se interpreta normalmente', async () => {
  const e = crearEntorno({ programa });
  await e.escribir('sí');
  assert.deepEqual(e.interprete.llamadas, ['sí']);
});
