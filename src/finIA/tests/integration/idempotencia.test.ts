// FR-006, SC-005, US1 escenario 5: un mismo mensaje nunca se registra dos veces.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';

const contar = (e: ReturnType<typeof crearEntorno>) =>
  (e.filas<{ n: number }>('SELECT COUNT(*) AS n FROM movimientos')[0]!).n;

test('SC-005: entregar 100 veces un mensaje produce un movimiento y una respuesta', async () => {
  const e = crearEntorno({
    programa: { 'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] } },
  });
  const m = e.mensaje('gasté 180 en tacos');
  for (let i = 0; i < 100; i++) e.manejador.recibir(m);
  await e.manejador.ocioso();
  assert.equal(contar(e), 1);
  assert.equal(e.canal.enviados.length, 1);
  assert.equal(e.interprete.llamadas.length, 1);
});

test('SC-005: un mensaje con dos movimientos entregado 100 veces produce exactamente dos', async () => {
  const texto = 'gasté 50 en café y 200 en gasolina';
  const e = crearEntorno({
    programa: {
      [texto]: { accion: 'registrar', movimientos: [mov('gasto', '50', 'Comida'), mov('gasto', '200', 'Transporte')] },
    },
  });
  const m = e.mensaje(texto);
  for (let i = 0; i < 100; i++) await e.entregar(m);
  assert.equal(contar(e), 2);
  assert.equal(e.canal.enviados.length, 1);
});

test('dos mensajes distintos con el mismo texto sí se registran ambos', async () => {
  const e = crearEntorno({
    programa: { 'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] } },
  });
  await e.escribir('gasté 180 en tacos');
  await e.escribir('gasté 180 en tacos');
  assert.equal(contar(e), 2);
});
