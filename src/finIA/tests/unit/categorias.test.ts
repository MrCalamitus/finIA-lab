import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_INGRESO,
  TODAS_LAS_CATEGORIAS,
  categoriaValida,
} from '../../src/dominio/categorias.ts';

test('listas fijas de categorías (data-model.md)', () => {
  assert.deepEqual(
    [...CATEGORIAS_GASTO],
    ['Comida', 'Transporte', 'Hogar', 'Servicios', 'Salud', 'Educación', 'Entretenimiento', 'Ropa', 'Otros'],
  );
  assert.deepEqual([...CATEGORIAS_INGRESO], ['Salario', 'Honorarios', 'Regalo', 'Otros']);
});

test('TODAS_LAS_CATEGORIAS no repite Otros', () => {
  assert.equal(TODAS_LAS_CATEGORIAS.filter((c) => c === 'Otros').length, 1);
  assert.equal(TODAS_LAS_CATEGORIAS.length, 12);
});

test('categoriaValida respeta el tipo', () => {
  assert.equal(categoriaValida('Comida', 'gasto'), true);
  assert.equal(categoriaValida('Salario', 'gasto'), false);
  assert.equal(categoriaValida('Salario', 'ingreso'), true);
  assert.equal(categoriaValida('Comida', 'ingreso'), false);
  assert.equal(categoriaValida('Otros', 'gasto'), true);
  assert.equal(categoriaValida('Otros', 'ingreso'), true);
  assert.equal(categoriaValida('Casino', 'gasto'), false);
});
