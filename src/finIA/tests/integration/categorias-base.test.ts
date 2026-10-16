// FR-006b y FR-007: categorías y umbral salen de la base, no del código.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';
import { crearEsquemaInterpretacion } from '../../src/interprete/esquema.ts';

function desactivar(e: ReturnType<typeof crearEntorno>, nombre: string) {
  e.db.prepare(`UPDATE categorias SET activa = 0 WHERE tipo = 'gasto' AND nombre = ?`).run(nombre);
}

test('una categoría desactivada no se acepta en registros nuevos', async () => {
  const e = crearEntorno({ programa: { 'gasté 300 en calcetines': { accion: 'registrar', movimientos: [mov('gasto', '300', 'Ropa')] } } });
  desactivar(e, 'Ropa');
  await e.escribir('gasté 300 en calcetines');
  assert.equal(e.filas('SELECT 1 FROM movimientos').length, 0);
});

test('una categoría desactivada sigue contando en consultas', async () => {
  const texto = '¿cuánto gasté en ropa este mes?';
  const e = crearEntorno({ programa: { [texto]: { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes', categoria: 'Ropa' } } } });
  e.sembrar([{ tipo: 'gasto', centavos: 30000, categoria: 'Ropa' }]);
  desactivar(e, 'Ropa');
  const [respuesta] = await e.escribir(texto);
  assert.match(respuesta!, /\$300\.00/);
});

test('el JSON Schema solo ofrece categorías activas para registrar, pero todas para consultar', () => {
  const e = crearEntorno();
  desactivar(e, 'Ropa');
  const esquema = crearEsquemaInterpretacion({
    gasto: e.repo.categorias('gasto', { soloActivas: true }).map((c) => c.nombre),
    ingreso: e.repo.categorias('ingreso', { soloActivas: true }).map((c) => c.nombre),
    todas: e.repo.categorias('gasto').concat(e.repo.categorias('ingreso')).map((c) => c.nombre),
  });
  const texto = JSON.stringify(esquema.jsonSchema);
  const movimiento = JSON.stringify((esquema.jsonSchema as { properties: Record<string, unknown> }).properties.movimientos);
  assert.ok(!movimiento.includes('"Ropa"'));
  assert.ok(texto.includes('"Ropa"'), 'la consulta sí la admite');
  assert.equal(esquema.validar({ accion: 'registrar', movimientos: [mov('gasto', '1', 'Ropa')] }).ok, false);
  assert.equal(esquema.validar({ accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes', categoria: 'Ropa' } }).ok, true);
});

test('el umbral se lee de la base', async () => {
  const e = crearEntorno({
    programa: {
      'gasté 6,000 en la renta': { accion: 'registrar', movimientos: [mov('gasto', '6,000', 'Hogar')] },
      'gasté 5,000 en la luz': { accion: 'registrar', movimientos: [mov('gasto', '5,000', 'Servicios')] },
    },
  });
  e.repo.fijarUmbral(500_000);
  await e.escribir('gasté 5,000 en la luz');
  await e.escribir('gasté 6,000 en la renta');
  assert.deepEqual(e.filas('SELECT monto_centavos, estado FROM movimientos ORDER BY id'), [
    { monto_centavos: 500_000, estado: 'vigente' },
    { monto_centavos: 600_000, estado: 'pendiente' },
  ]);
});
