// US4: resumen del periodo en un mensaje de texto (FR-010).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno } from '../dobles/fabrica.ts';

const programa = {
  resumen: { accion: 'resumen' },
  'resumen de septiembre': { accion: 'resumen', consulta: { tipo: 'ambos', periodo: 'mes_concreto', mes: '2026-09' } },
  'resumen de la semana': { accion: 'resumen', consulta: { tipo: 'ambos', periodo: 'semana' } },
};

test('escenario 1: "resumen" da ingresos, gastos, balance y gasto por categoría del mes', async () => {
  const e = crearEntorno({ programa });
  e.sembrar([
    { tipo: 'ingreso', centavos: 1_250_000, categoria: 'Salario', fecha: '2026-10-01' },
    { tipo: 'gasto', centavos: 234_000, categoria: 'Comida', fecha: '2026-10-05' },
    { tipo: 'gasto', centavos: 60_000, categoria: 'Transporte', fecha: '2026-10-06' },
    { tipo: 'gasto', centavos: 118_050, categoria: 'Hogar', fecha: '2026-10-07' },
    { tipo: 'gasto', centavos: 99_999, categoria: 'Comida', fecha: '2026-09-30' },
  ]);
  assert.deepEqual(await e.escribir('resumen'), [
    [
      '📊 *Resumen de octubre*',
      '💰 Ingresos: *$12,500.00*',
      '💸 Gastos: *$4,120.50*',
      '🟢 Balance: *$8,379.50*',
      '',
      '*Gasto por categoría*',
      '```Comida      $2,340.00',
      'Hogar       $1,180.50',
      'Transporte    $600.00```',
    ].join('\n'),
  ]);
  assert.deepEqual(e.filas(`SELECT resultado FROM mensajes_procesados WHERE mensaje_id LIKE '%usr%'`), [
    { resultado: 'resumen' },
  ]);
});

test('el balance negativo lleva signo', async () => {
  const e = crearEntorno({ programa });
  e.sembrar([
    { tipo: 'ingreso', centavos: 10_000, categoria: 'Regalo' },
    { tipo: 'gasto', centavos: 25_000, categoria: 'Ropa' },
  ]);
  const [respuesta] = await e.escribir('resumen');
  assert.match(respuesta!, /^🔴 Balance: \*-\$150\.00\*$/m);
});

test('escenario 2: "resumen de septiembre" solo incluye septiembre', async () => {
  const e = crearEntorno({ programa });
  e.sembrar([
    { tipo: 'gasto', centavos: 5_000, categoria: 'Comida', fecha: '2026-09-10' },
    { tipo: 'gasto', centavos: 7_000, categoria: 'Comida', fecha: '2026-10-10' },
  ]);
  assert.deepEqual(await e.escribir('resumen de septiembre'), [
    '📊 *Resumen de septiembre*\n💰 Ingresos: *$0.00*\n💸 Gastos: *$50.00*\n🔴 Balance: *-$50.00*\n\n*Gasto por categoría*\n```Comida  $50.00```',
  ]);
});

test('resumen de la semana', async () => {
  const e = crearEntorno({ programa });
  e.sembrar([
    { tipo: 'ingreso', centavos: 100_000, categoria: 'Honorarios', fecha: '2026-10-12' },
    { tipo: 'gasto', centavos: 7_000, categoria: 'Comida', fecha: '2026-10-11' },
  ]);
  assert.deepEqual(await e.escribir('resumen de la semana'), [
    '📊 *Resumen de esta semana*\n💰 Ingresos: *$1,000.00*\n💸 Gastos: *$0.00*\n🟢 Balance: *$1,000.00*',
  ]);
});

test('sin movimientos avisa que no hay', async () => {
  const e = crearEntorno({ programa });
  assert.deepEqual(await e.escribir('resumen'), ['📊 No hay movimientos en octubre.']);
});

test('solo cuentan los vigentes', async () => {
  const e = crearEntorno({ programa });
  e.sembrar([
    { tipo: 'gasto', centavos: 1_000, categoria: 'Comida' },
    { tipo: 'gasto', centavos: 2_000, categoria: 'Comida', estado: 'borrado' },
    { tipo: 'gasto', centavos: 4_000, categoria: 'Comida', estado: 'descartado' },
  ]);
  assert.deepEqual(await e.escribir('resumen'), [
    '📊 *Resumen de octubre*\n💰 Ingresos: *$0.00*\n💸 Gastos: *$10.00*\n🔴 Balance: *-$10.00*\n\n*Gasto por categoría*\n```Comida  $10.00```',
  ]);
});
