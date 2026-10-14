import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  validarFecha,
  rangoPeriodo,
  formatearFechaRelativa,
  nombreMes,
  aIso,
} from '../../src/dominio/fechas.ts';

// Martes 13 de octubre de 2026, hora local.
const hoy = new Date(2026, 9, 13, 12, 0, 0);

test('aIso usa la fecha local', () => {
  assert.equal(aIso(hoy), '2026-10-13');
  assert.equal(aIso(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('validarFecha acepta fechas reales dentro del rango', () => {
  assert.equal(validarFecha('2026-10-13', hoy), true);
  assert.equal(validarFecha('2026-10-12', hoy), true);
  assert.equal(validarFecha('2025-10-12', hoy), true); // 366 días atrás
});

test('validarFecha rechaza fechas imposibles, futuras o muy viejas', () => {
  assert.equal(validarFecha('2026-02-30', hoy), false);
  assert.equal(validarFecha('2026-13-01', hoy), false);
  assert.equal(validarFecha('2026-10-14', hoy), false);
  assert.equal(validarFecha('2025-10-11', hoy), false);
  assert.equal(validarFecha('13/10/2026', hoy), false);
  assert.equal(validarFecha('', hoy), false);
});

test('rangoPeriodo resuelve hoy, semana, mes y mes concreto', () => {
  assert.deepEqual(rangoPeriodo('hoy', undefined, hoy), { desde: '2026-10-13', hasta: '2026-10-13' });
  assert.deepEqual(rangoPeriodo('semana', undefined, hoy), { desde: '2026-10-12', hasta: '2026-10-18' });
  assert.deepEqual(rangoPeriodo('mes', undefined, hoy), { desde: '2026-10-01', hasta: '2026-10-31' });
  assert.deepEqual(rangoPeriodo('mes_concreto', '2026-02', hoy), { desde: '2026-02-01', hasta: '2026-02-28' });
  assert.deepEqual(rangoPeriodo('mes_concreto', '2024-02', hoy), { desde: '2024-02-01', hasta: '2024-02-29' });
});

test('la semana va de lunes a domingo', () => {
  const domingo = new Date(2026, 9, 18, 9, 0, 0);
  assert.deepEqual(rangoPeriodo('semana', undefined, domingo), { desde: '2026-10-12', hasta: '2026-10-18' });
  const lunes = new Date(2026, 9, 12, 9, 0, 0);
  assert.deepEqual(rangoPeriodo('semana', undefined, lunes), { desde: '2026-10-12', hasta: '2026-10-18' });
});

test('rangoPeriodo con mes_concreto sin mes lanza error', () => {
  assert.throws(() => rangoPeriodo('mes_concreto', undefined, hoy));
});

test('formatearFechaRelativa devuelve hoy, ayer o dd/mm/aaaa', () => {
  assert.equal(formatearFechaRelativa('2026-10-13', hoy), 'hoy');
  assert.equal(formatearFechaRelativa('2026-10-12', hoy), 'ayer');
  assert.equal(formatearFechaRelativa('2026-10-01', hoy), '01/10/2026');
});

test('nombreMes en español', () => {
  assert.equal(nombreMes('2026-10'), 'octubre');
  assert.equal(nombreMes('2026-01'), 'enero');
  assert.equal(nombreMes('2026-09'), 'septiembre');
});
