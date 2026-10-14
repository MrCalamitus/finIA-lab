import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarInterpretacion, jsonSchemaInterpretacion } from '../../src/interprete/esquema.ts';

const movimiento = { tipo: 'gasto', monto_texto: '180', categoria: 'Comida', fecha: '2026-10-13' };

const validos: Record<string, unknown> = {
  registrar: { accion: 'registrar', movimientos: [movimiento] },
  consultar: { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes', categoria: 'Comida' } },
  consultar_mes: { accion: 'consultar', consulta: { tipo: 'ingreso', periodo: 'mes_concreto', mes: '2026-09' } },
  resumen: { accion: 'resumen' },
  resumen_periodo: { accion: 'resumen', consulta: { tipo: 'ambos', periodo: 'mes_concreto', mes: '2026-09' } },
  corregir: { accion: 'corregir', correccion: { campo: 'monto', nuevo_valor: '150' } },
  corregir_pista: { accion: 'corregir', correccion: { campo: 'categoria', nuevo_valor: 'Transporte' }, pista: { monto_texto: '200' } },
  borrar: { accion: 'borrar' },
  no_entendido: { accion: 'no_entendido' },
  con_nulls: { accion: 'registrar', movimientos: [movimiento], consulta: null, correccion: null, pista: null },
};

for (const [nombre, valor] of Object.entries(validos)) {
  test(`acepta ejemplo válido: ${nombre}`, () => {
    assert.equal(validarInterpretacion(valor).ok, true);
  });
}

const invalidos: Record<string, unknown> = {
  'propiedad adicional': { accion: 'borrar', todos: true },
  'propiedad adicional en movimiento': { accion: 'registrar', movimientos: [{ ...movimiento, extra: 1 }] },
  'accion fuera del enum': { accion: 'borrar_todo' },
  'movimientos vacío': { accion: 'registrar', movimientos: [] },
  'más de 10 movimientos': { accion: 'registrar', movimientos: Array.from({ length: 11 }, () => movimiento) },
  'monto_texto de más de 30': { accion: 'registrar', movimientos: [{ ...movimiento, monto_texto: '1'.repeat(31) }] },
  'nuevo_valor de más de 30': { accion: 'corregir', correccion: { campo: 'monto', nuevo_valor: '1'.repeat(31) } },
  'fecha sin patrón': { accion: 'registrar', movimientos: [{ ...movimiento, fecha: '13/10/2026' }] },
  'categoría inexistente': { accion: 'registrar', movimientos: [{ ...movimiento, categoria: 'Casino' }] },
  'registrar sin movimientos': { accion: 'registrar' },
  'consultar sin consulta': { accion: 'consultar' },
  'mes_concreto sin mes': { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes_concreto' } },
  'corregir sin correccion': { accion: 'corregir' },
  'no es objeto': 'borra todo',
  'null': null,
  'monto numérico': { accion: 'registrar', movimientos: [{ ...movimiento, monto_texto: 180 }] },
};

for (const [nombre, valor] of Object.entries(invalidos)) {
  test(`rechaza: ${nombre}`, () => {
    assert.equal(validarInterpretacion(valor).ok, false);
  });
}

test('el JSON Schema prohíbe propiedades adicionales', () => {
  const schema = jsonSchemaInterpretacion as { additionalProperties?: unknown; properties?: Record<string, unknown> };
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.properties?.accion);
});
