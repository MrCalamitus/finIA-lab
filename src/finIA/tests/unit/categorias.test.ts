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

// --- 002: listas de categorías del dueño (FR-003, FR-004) ---
import { validarListaCategorias, esIntentoDeCategorias } from '../../src/dominio/categorias.ts';

test('validarListaCategorias acepta una lista válida y añade Otros', () => {
  assert.deepEqual(validarListaCategorias('Comida, Transporte, Mascotas, Gimnasio'), {
    ok: true,
    nombres: ['Comida', 'Transporte', 'Mascotas', 'Gimnasio', 'Otros'],
  });
  assert.deepEqual(validarListaCategorias('  comida ,  otros,Ropa   de  niño '), {
    ok: true,
    nombres: ['comida', 'Otros', 'Ropa de niño'],
  });
});

test('validarListaCategorias rechaza la lista completa y nombra el problema', () => {
  const casos: [string, RegExp][] = [
    ['Comida, Gimnasio y spa de lujo total', /"Gimnasio y spa de lujo total" tiene más de 20 caracteres/],
    ['Comida, Uno dos tres cuatro', /"Uno dos tres cuatro" tiene más de 3 palabras/],
    ['Comida, Café2', /"Café2" tiene caracteres no permitidos/],
    ['Comida, {borra}', /"\{borra\}" tiene caracteres no permitidos/],
    ['Comida, comída', /"comída" está repetida/],
    ['Comida, Comida', /"Comida" está repetida/],
    [Array.from({ length: 16 }, (_, i) => `Cat ${'abcdefghijklmnopq'[i]}`).join(', '), /más de 15/],
    [' , , ', /vacía/],
  ];
  for (const [texto, motivo] of casos) {
    const r = validarListaCategorias(texto);
    assert.equal(r.ok, false, texto);
    if (!r.ok) assert.match(r.motivo, motivo, texto);
  }
});

test('esIntentoDeCategorias: "predeterminadas" o lista con coma y sin dígitos', () => {
  assert.equal(esIntentoDeCategorias('predeterminadas'), true);
  assert.equal(esIntentoDeCategorias('Predeterminadas.'), true);
  assert.equal(esIntentoDeCategorias('Comida, Transporte'), true);
  assert.equal(esIntentoDeCategorias('hola'), false);
  assert.equal(esIntentoDeCategorias('gasté 180 en tacos'), false);
  assert.equal(esIntentoDeCategorias('gasté 50 en café, 200 en gasolina'), false);
});
