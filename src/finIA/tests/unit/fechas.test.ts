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

// --- 002: fecha escrita por el dueño (FR-018c, research R5) ---
import { leerFechaEscrita } from '../../src/dominio/fechas.ts';

test('leerFechaEscrita reconoce hoy, ayer, antier, dd/mm y dd/mm/aaaa', () => {
  assert.equal(leerFechaEscrita('súper de ayer', hoy), '2026-10-12');
  assert.equal(leerFechaEscrita('fue antier', hoy), '2026-10-11');
  assert.equal(leerFechaEscrita('Hoy', hoy), '2026-10-13');
  assert.equal(leerFechaEscrita('AYER.', hoy), '2026-10-12');
  assert.equal(leerFechaEscrita('12/10', hoy), '2026-10-12');
  assert.equal(leerFechaEscrita('compra del 5/9/2026', hoy), '2026-09-05');
});

test('leerFechaEscrita: sin fecha o fecha imposible → null', () => {
  assert.equal(leerFechaEscrita('súper', hoy), null);
  assert.equal(leerFechaEscrita('31/02/2026', hoy), null);
  assert.equal(leerFechaEscrita('2 x 28.50', hoy), null);
});

test('leerFechaEscrita: dd/mm/aaaa tiene prioridad sobre las palabras', () => {
  assert.equal(leerFechaEscrita('ayer no, fue el 01/10/2026', hoy), '2026-10-01');
});
