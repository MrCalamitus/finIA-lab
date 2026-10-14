// FR-016: la salida del intérprete se valida antes de guardar. Cada caso es una salida
// maliciosa o errónea del modelo; ninguno debe guardar nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';
import { TEXTOS } from '../../src/acciones/respuestas.ts';

const TEXTO = 'gasté 180 en tacos';

const ataques: Record<string, unknown> = {
  'monto negativo': { accion: 'registrar', movimientos: [mov('gasto', '-180', 'Comida')] },
  'monto cero': { accion: 'registrar', movimientos: [mov('gasto', '0', 'Comida')] },
  'monto que no está en el mensaje': { accion: 'registrar', movimientos: [mov('gasto', '18000', 'Comida')] },
  'monto inventado grande': { accion: 'registrar', movimientos: [mov('gasto', '180 mil', 'Comida')] },
  'categoría de ingreso en un gasto': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Salario')] },
  'categoría inexistente': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Casino')] },
  'fecha imposible': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida', '2026-02-30')] },
  'fecha futura': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida', '2026-10-14')] },
  'fecha de hace dos años': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida', '2024-10-13')] },
  'propiedad extra': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')], sql: 'DROP TABLE x' },
  'tipo inventado': { accion: 'registrar', movimientos: [{ ...mov('gasto', '180', 'Comida'), tipo: 'prestamo' }] },
  'JSON roto (texto)': 'Claro, aquí está: {accion: registrar',
  'monto numérico flotante': { accion: 'registrar', movimientos: [{ ...mov('gasto', '180', 'Comida'), monto_texto: 180.0000001 }] },
  'arreglo en vez de objeto': [{ accion: 'registrar' }],
};

for (const [nombre, salida] of Object.entries(ataques)) {
  test(`FR-016: ${nombre} → nada guardado y aviso`, async () => {
    const e = crearEntorno({ programa: { [TEXTO]: salida } });
    const respuestas = await e.escribir(TEXTO);
    assert.deepEqual(respuestas, [TEXTOS.noEntendido]);
    assert.equal(e.filas('SELECT 1 FROM movimientos').length, 0);
    assert.deepEqual(e.filas('SELECT resultado FROM mensajes_procesados'), [{ resultado: 'rechazado' }]);
  });
}
