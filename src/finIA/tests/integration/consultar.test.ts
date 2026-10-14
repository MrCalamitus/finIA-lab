// US2: consultas por periodo y categoría (FR-008, FR-009).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Sembrado } from '../dobles/fabrica.ts';

const consulta = (tipo: string, periodo: string, extra: Record<string, string> = {}) => ({
  accion: 'consultar',
  consulta: { tipo, periodo, ...extra },
});

/** 14 gastos de Comida en octubre que suman $2,340.00. */
function comidaDeOctubre(): Sembrado[] {
  const montos = [15000, 18000, 9990, 20010, 12000, 25000, 30000, 8000, 16000, 14000, 11000, 19000, 21000, 15000];
  const dias = ['01', '02', '03', '05', '06', '07', '08', '09', '10', '11', '12', '12', '13', '13'];
  return montos.map((centavos, i) => ({ tipo: 'gasto', centavos, categoria: 'Comida', fecha: `2026-10-${dias[i]}` }));
}

test('escenario 1: total de Comida del mes con número de gastos', async () => {
  const texto = '¿cuánto llevo gastado este mes en comida?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'mes', { categoria: 'Comida' }) } });
  e.sembrar([
    ...comidaDeOctubre(),
    { tipo: 'gasto', centavos: 50000, categoria: 'Transporte', fecha: '2026-10-05' },
    { tipo: 'gasto', centavos: 7000, categoria: 'Comida', fecha: '2026-09-30' },
    { tipo: 'ingreso', centavos: 1250000, categoria: 'Salario', fecha: '2026-10-01' },
  ]);
  assert.deepEqual(await e.escribir(texto), ['Comida en octubre: $2,340.00 (14 gastos)']);
  assert.deepEqual(e.filas('SELECT resultado FROM mensajes_procesados WHERE mensaje_id LIKE ?', '%usr%'), [
    { resultado: 'consulta' },
  ]);
});

test('escenario 2: gastos de la semana (lunes a domingo) sin incluir ingresos', async () => {
  const texto = '¿cuánto gasté esta semana?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'semana') } });
  e.sembrar([
    { tipo: 'gasto', centavos: 10000, categoria: 'Comida', fecha: '2026-10-11' }, // domingo anterior
    { tipo: 'gasto', centavos: 20000, categoria: 'Comida', fecha: '2026-10-12' }, // lunes
    { tipo: 'gasto', centavos: 30050, categoria: 'Transporte', fecha: '2026-10-13' },
    { tipo: 'ingreso', centavos: 999900, categoria: 'Salario', fecha: '2026-10-13' },
  ]);
  assert.deepEqual(await e.escribir(texto), ['Gastos esta semana: $500.50 (2 gastos)']);
});

test('escenario 3: periodo sin movimientos responde que no hay, sin cifras', async () => {
  const texto = '¿cuánto llevo gastado este mes en comida?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'mes', { categoria: 'Comida' }) } });
  e.sembrar([{ tipo: 'gasto', centavos: 7000, categoria: 'Comida', fecha: '2026-09-30' }]);
  assert.deepEqual(await e.escribir(texto), ['No hay gastos de Comida en octubre.']);
});

test('mes concreto y singular', async () => {
  const texto = '¿cuánto gané en septiembre?';
  const e = crearEntorno({ programa: { [texto]: consulta('ingreso', 'mes_concreto', { mes: '2026-09' }) } });
  e.sembrar([
    { tipo: 'ingreso', centavos: 980000, categoria: 'Salario', fecha: '2026-09-15' },
    { tipo: 'ingreso', centavos: 100, categoria: 'Otros', fecha: '2026-10-01' },
  ]);
  assert.deepEqual(await e.escribir(texto), ['Ingresos en septiembre: $9,800.00 (1 ingreso)']);
});

test('un mes de otro año lleva el año', async () => {
  const texto = '¿cuánto gasté en diciembre del año pasado?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'mes_concreto', { mes: '2025-12' }) } });
  e.sembrar([{ tipo: 'gasto', centavos: 100, categoria: 'Otros', fecha: '2025-12-24' }]);
  assert.deepEqual(await e.escribir(texto), ['Gastos en diciembre de 2025: $1.00 (1 gasto)']);
});

test('hoy', async () => {
  const texto = '¿cuánto gasté hoy?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'hoy') } });
  e.sembrar([
    { tipo: 'gasto', centavos: 4550, categoria: 'Comida', fecha: '2026-10-13' },
    { tipo: 'gasto', centavos: 1000, categoria: 'Comida', fecha: '2026-10-12' },
  ]);
  assert.deepEqual(await e.escribir(texto), ['Gastos hoy: $45.50 (1 gasto)']);
});

test('ingresos y gastos juntos', async () => {
  const texto = '¿cómo voy este mes?';
  const e = crearEntorno({ programa: { [texto]: consulta('ambos', 'mes') } });
  e.sembrar([
    { tipo: 'gasto', centavos: 18000, categoria: 'Comida' },
    { tipo: 'ingreso', centavos: 1250000, categoria: 'Salario' },
  ]);
  assert.deepEqual(await e.escribir(texto), [
    'Ingresos en octubre: $12,500.00 (1 ingreso)\nGastos en octubre: $180.00 (1 gasto)',
  ]);
});

test('ingresos y gastos juntos sin datos', async () => {
  const texto = '¿cómo voy este mes?';
  const e = crearEntorno({ programa: { [texto]: consulta('ambos', 'mes') } });
  assert.deepEqual(await e.escribir(texto), ['No hay movimientos en octubre.']);
});

test('pendientes, borrados y descartados no cuentan', async () => {
  const texto = '¿cuánto gasté hoy?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'hoy') } });
  e.sembrar([
    { tipo: 'gasto', centavos: 1000, categoria: 'Comida' },
    { tipo: 'gasto', centavos: 2000, categoria: 'Comida', estado: 'pendiente' },
    { tipo: 'gasto', centavos: 4000, categoria: 'Comida', estado: 'borrado' },
    { tipo: 'gasto', centavos: 8000, categoria: 'Comida', estado: 'descartado' },
  ]);
  // El pendiente se descarta con el mensaje siguiente (FR-005a) y tampoco cuenta.
  assert.deepEqual(await e.escribir(texto), [
    'No guardé el gasto de $20.00 porque no lo confirmaste.',
    'Gastos hoy: $10.00 (1 gasto)',
  ]);
});

test('una consulta no modifica movimientos', async () => {
  const texto = '¿cuánto gasté hoy?';
  const e = crearEntorno({ programa: { [texto]: consulta('gasto', 'hoy') } });
  e.sembrar([{ tipo: 'gasto', centavos: 1000, categoria: 'Comida' }]);
  const antes = e.filas('SELECT * FROM movimientos');
  await e.escribir(texto);
  assert.deepEqual(e.filas('SELECT * FROM movimientos'), antes);
});
