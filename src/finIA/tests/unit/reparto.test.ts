// FR-018e: reparto proporcional de un ajuste (IVA o descuento general) en centavos exactos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { repartirProporcional } from '../../src/interprete/ticket.ts';

const suma = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test('la suma de las partes es exactamente el ajuste', () => {
  const montos = [100_000, 200_000, 5_039];
  const partes = repartirProporcional(montos, 6_007);
  assert.equal(suma(partes), 6_007);
  // floor: 1969, 3938, 99 (suman 6006); el centavo restante va al mayor residuo (.48 del segundo).
  assert.deepEqual(partes, [1_969, 3_939, 99]);
});

test('en empate de residuos, el remanente va por orden del ticket', () => {
  assert.deepEqual(repartirProporcional([100, 100, 100], 2), [1, 1, 0]);
  assert.deepEqual(repartirProporcional([100, 100, 100], 100), [34, 33, 33]);
});

test('un solo artículo recibe todo el ajuste', () => {
  assert.deepEqual(repartirProporcional([25_964], 4_036), [4_036]);
});

test('ajuste cero no cambia nada', () => {
  assert.deepEqual(repartirProporcional([1_000, 2_000], 0), [0, 0]);
});

test('montos grandes no pierden precisión (BigInt)', () => {
  const montos = [99_999_999, 88_888_888, 77_777_777];
  const ajuste = 99_999_999;
  const partes = repartirProporcional(montos, ajuste);
  assert.equal(suma(partes), ajuste);
  assert.ok(partes.every((p) => Number.isSafeInteger(p) && p >= 0));
});

test('muchos artículos pequeños siguen sumando exacto', () => {
  const montos = Array.from({ length: 40 }, (_, i) => 101 + i * 37);
  for (const ajuste of [1, 39, 40, 41, 6_007, 12_345]) {
    assert.equal(suma(repartirProporcional(montos, ajuste)), ajuste, `ajuste ${ajuste}`);
  }
});
