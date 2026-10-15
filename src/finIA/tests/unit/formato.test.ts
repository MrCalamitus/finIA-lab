// FR-010 a FR-013: formato de WhatsApp (research R9 de la 002).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conEmoji, cursiva, escapar, mono, negrita, tablaAlineada } from '../../src/dominio/formato.ts';

test('negrita, cursiva y monoespaciado con la sintaxis de WhatsApp', () => {
  assert.equal(negrita('$180.00'), '*$180.00*');
  assert.equal(cursiva('fecha del ticket'), '_fecha del ticket_');
  assert.equal(mono('gasté 180 en tacos'), '```gasté 180 en tacos```');
});

test('escapar quita símbolos de formato y caracteres de control', () => {
  assert.equal(escapar('*Leche* _entera_ ~1L~ `x`'), 'Leche entera 1L x');
  assert.equal(escapar('pan\u0000\u0007 dulce\n\t'), 'pan dulce');
  assert.equal(escapar('  muchos    espacios  '), 'muchos espacios');
});

test('conEmoji usa el emoji predeterminado o el genérico', () => {
  assert.equal(conEmoji('Comida', 'gasto'), '🌮 Comida');
  assert.equal(conEmoji('Salario', 'ingreso'), '💼 Salario');
  assert.equal(conEmoji('Mascotas', 'gasto'), '🏷️ Mascotas');
  assert.equal(conEmoji('Mas*cotas_', 'gasto'), '🏷️ Mascotas');
  assert.equal(conEmoji('Ro*pa', 'gasto'), '👕 Ropa', 'escapada, vuelve a ser la predeterminada');
});

test('tablaAlineada rellena nombres y alinea montos a la derecha en un bloque monoespaciado', () => {
  assert.equal(
    tablaAlineada([
      ['Comida', '$2,340.00'],
      ['Transporte', '$600.00'],
      ['Educación', '$12.50'],
    ]),
    '```Comida      $2,340.00\nTransporte    $600.00\nEducación      $12.50```',
  );
});

test('tablaAlineada vacía no produce bloque', () => {
  assert.equal(tablaAlineada([]), '');
});
