// US3: borrar un registro (FR-011, FR-012). El borrado es lógico: la fila se conserva.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, GRUPO } from '../dobles/fabrica.ts';

const CONF1 = `${GRUPO}:bot-confirmacion-1`;
const total = (e: ReturnType<typeof crearEntorno>) =>
  e.repo.totales({ tipo: 'gasto', desde: '2026-10-01', hasta: '2026-10-31' });
const estado = (e: ReturnType<typeof crearEntorno>, id: number) =>
  e.filas<{ estado: string }>('SELECT estado FROM movimientos WHERE id = ?', id)[0]!.estado;

test('escenario 2: citando la confirmación, "bórralo" lo borra y deja de contar', async () => {
  const e = crearEntorno({ programa: { 'bórralo': { accion: 'borrar' } } });
  const [id] = e.sembrar([
    { tipo: 'gasto', centavos: 18000, categoria: 'Comida', confirmacion: CONF1 },
    { tipo: 'gasto', centavos: 1000, categoria: 'Otros' },
  ]);
  assert.deepEqual(await e.escribir('bórralo', { citadoId: CONF1 }), ['🗑️ Borrado: gasto de *$180.00* · 🌮 Comida · hoy']);
  assert.equal(estado(e, id!), 'borrado');
  assert.deepEqual(total(e), { centavos: 1000, cantidad: 1 });
  assert.deepEqual(e.filas('SELECT accion, valor_anterior, valor_nuevo FROM cambios'), [
    { accion: 'borrar', valor_anterior: 'vigente', valor_nuevo: 'borrado' },
  ]);
  assert.equal(e.filas('SELECT 1 FROM movimientos').length, 2, 'la fila se conserva');
});

test('"borra el último" borra solo el más reciente', async () => {
  const e = crearEntorno({ programa: { 'borra el último': { accion: 'borrar' } } });
  const [primero, segundo] = e.sembrar([
    { tipo: 'gasto', centavos: 18000, categoria: 'Comida' },
    { tipo: 'gasto', centavos: 5000, categoria: 'Transporte' },
  ]);
  assert.deepEqual(await e.escribir('borra el último'), ['🗑️ Borrado: gasto de *$50.00* · 🚌 Transporte · hoy']);
  assert.equal(estado(e, primero!), 'vigente');
  assert.equal(estado(e, segundo!), 'borrado');
});

test('un movimiento borrado no se puede volver a borrar ni corregir', async () => {
  const e = crearEntorno({
    programa: {
      'bórralo': { accion: 'borrar' },
      'era 150': { accion: 'corregir', correccion: { campo: 'monto', nuevo_valor: '150' } },
    },
  });
  e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida', confirmacion: CONF1 }]);
  await e.escribir('bórralo', { citadoId: CONF1 });
  assert.deepEqual(await e.escribir('bórralo', { citadoId: CONF1 }), [
    '⚠️ No encontré qué borrar. Cita la confirmación del registro o escribe ```borra el último```',
  ]);
  assert.deepEqual(await e.escribir('era 150', { citadoId: CONF1 }), [
    '⚠️ No encontré qué corregir. Cita la confirmación del registro o escribe ```corrige el último …```',
  ]);
  assert.equal(e.filas('SELECT 1 FROM cambios').length, 1);
});

test('sin registros, borrar avisa y no cambia nada', async () => {
  const e = crearEntorno({ programa: { 'borra el último': { accion: 'borrar' } } });
  assert.deepEqual(await e.escribir('borra el último'), [
    '⚠️ No encontré qué borrar. Cita la confirmación del registro o escribe ```borra el último```',
  ]);
});

test('flujo completo: registrar, citar la confirmación real y borrar', async () => {
  const e = crearEntorno({
    programa: {
      'gasté 180 en tacos': {
        accion: 'registrar',
        movimientos: [{ tipo: 'gasto', monto_texto: '180', categoria: 'Comida', fecha: '2026-10-13' }],
      },
      'bórralo': { accion: 'borrar' },
    },
  });
  await e.escribir('gasté 180 en tacos');
  const confirmacion = e.idUltimaRespuesta()!;
  assert.deepEqual(await e.escribir('bórralo', { citadoId: confirmacion }), ['🗑️ Borrado: gasto de *$180.00* · 🌮 Comida · hoy']);
  assert.deepEqual(total(e), { centavos: 0, cantidad: 0 });
});
