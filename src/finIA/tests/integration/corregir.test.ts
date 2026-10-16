// US3: corregir monto, categoría o fecha (FR-011, FR-012).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, GRUPO } from '../dobles/fabrica.ts';

const corregir = (campo: string, nuevo_valor: string, pista?: Record<string, string>) => ({
  accion: 'corregir',
  correccion: { campo, nuevo_valor },
  ...(pista ? { pista } : {}),
});

const CONF1 = `${GRUPO}:bot-confirmacion-1`;
const CONF2 = `${GRUPO}:bot-confirmacion-2`;

const fila = (e: ReturnType<typeof crearEntorno>, id: number) =>
  e.filas<{ monto_centavos: number; categoria: string; fecha: string; estado: string }>(
    'SELECT monto_centavos, categoria, fecha, estado FROM movimientos WHERE id = ?',
    id,
  )[0]!;

test('escenario 1: citando la confirmación, "era 150" corrige el monto y muestra antes y después', async () => {
  const e = crearEntorno({ programa: { 'era 150': corregir('monto', '150') } });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida', confirmacion: CONF1 }]);
  assert.deepEqual(await e.escribir('era 150', { citadoId: CONF1 }), [
    'Corregido: gasto · Comida · hoy. Monto: $180.00 → $150.00',
  ]);
  assert.equal(fila(e, id!).monto_centavos, 15000);
  assert.deepEqual(e.filas('SELECT accion, campo, valor_anterior, valor_nuevo FROM cambios'), [
    { accion: 'corregir', campo: 'monto_centavos', valor_anterior: '18000', valor_nuevo: '15000' },
  ]);
  assert.deepEqual(e.filas(`SELECT resultado FROM mensajes_procesados WHERE mensaje_id LIKE '%usr%'`), [
    { resultado: 'correccion' },
  ]);
});

test('con dos gastos, citar el primero solo cambia el primero', async () => {
  const e = crearEntorno({ programa: { 'era 150': corregir('monto', '150') } });
  const [primero, segundo] = e.sembrar([
    { tipo: 'gasto', centavos: 18000, categoria: 'Comida', confirmacion: CONF1 },
    { tipo: 'gasto', centavos: 50000, categoria: 'Hogar', confirmacion: CONF2 },
  ]);
  await e.escribir('era 150', { citadoId: CONF1 });
  assert.equal(fila(e, primero!).monto_centavos, 15000);
  assert.equal(fila(e, segundo!).monto_centavos, 50000);
});

test('sin cita, "corrige el último a 150" cambia el vigente más reciente', async () => {
  const texto = 'corrige el último a 150';
  const e = crearEntorno({ programa: { [texto]: corregir('monto', '150') } });
  const [primero, segundo, borrado] = e.sembrar([
    { tipo: 'gasto', centavos: 18000, categoria: 'Comida' },
    { tipo: 'gasto', centavos: 50000, categoria: 'Hogar' },
    { tipo: 'gasto', centavos: 9900, categoria: 'Otros', estado: 'borrado' },
  ]);
  assert.deepEqual(await e.escribir(texto), ['Corregido: gasto · Hogar · hoy. Monto: $500.00 → $150.00']);
  assert.equal(fila(e, primero!).monto_centavos, 18000);
  assert.equal(fila(e, segundo!).monto_centavos, 15000);
  assert.equal(fila(e, borrado!).monto_centavos, 9900);
});

test('corregir la categoría', async () => {
  const e = crearEntorno({ programa: { 'cámbialo a Transporte': corregir('categoria', 'Transporte') } });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida', confirmacion: CONF1 }]);
  assert.deepEqual(await e.escribir('cámbialo a Transporte', { citadoId: CONF1 }), [
    'Corregido: gasto de $180.00 · hoy. Categoría: Comida → Transporte',
  ]);
  assert.equal(fila(e, id!).categoria, 'Transporte');
});

test('la categoría se acepta sin importar mayúsculas', async () => {
  const e = crearEntorno({ programa: { 'a transporte': corregir('categoria', 'transporte') } });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida' }]);
  await e.escribir('a transporte');
  assert.equal(fila(e, id!).categoria, 'Transporte');
});

test('una categoría que no pertenece al tipo se rechaza', async () => {
  const e = crearEntorno({ programa: { 'ponle Salario': corregir('categoria', 'Salario') } });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida' }]);
  assert.deepEqual(await e.escribir('ponle Salario'), [
    'No entendí el nuevo valor "Salario". No cambié nada.',
  ]);
  assert.equal(fila(e, id!).categoria, 'Comida');
});

test('corregir la fecha valida que sea real y no futura', async () => {
  const e = crearEntorno({
    programa: {
      'fue ayer': corregir('fecha', '2026-10-12'),
      'fue mañana': corregir('fecha', '2026-10-14'),
    },
  });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida' }]);
  assert.deepEqual(await e.escribir('fue mañana'), ['No entendí el nuevo valor "2026-10-14". No cambié nada.']);
  assert.equal(fila(e, id!).fecha, '2026-10-13');
  assert.deepEqual(await e.escribir('fue ayer'), ['Corregido: gasto de $180.00 · Comida. Fecha: hoy → ayer']);
  assert.equal(fila(e, id!).fecha, '2026-10-12');
});

test('el nuevo monto debe aparecer en el mensaje', async () => {
  const e = crearEntorno({ programa: { 'era menos': corregir('monto', '1') } });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida' }]);
  assert.deepEqual(await e.escribir('era menos'), ['No entendí el nuevo valor "1". No cambié nada.']);
  assert.equal(fila(e, id!).monto_centavos, 18000);
});

test('FR-011: corregir a más de $50,000.00 se rechaza y pide borrar y registrar de nuevo', async () => {
  const e = crearEntorno({ programa: { 'era 60,000': corregir('monto', '60,000') } });
  const [id] = e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida' }]);
  assert.deepEqual(await e.escribir('era 60,000'), [
    'No corregí: $60,000.00 supera $50,000.00. Borra el registro y regístralo de nuevo para confirmarlo.',
  ]);
  assert.equal(fila(e, id!).monto_centavos, 18000);
});

test('escenario 3: sin registros vigentes no se modifica nada y se avisa', async () => {
  const e = crearEntorno({ programa: { 'era 150': corregir('monto', '150') } });
  e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida', estado: 'borrado' }]);
  assert.deepEqual(await e.escribir('era 150'), [
    'No encontré qué corregir. Cita la confirmación del registro o escribe "corrige el último …".',
  ]);
  assert.equal(e.filas('SELECT 1 FROM cambios').length, 0);
});

test('citar un mensaje que no es una confirmación no modifica nada', async () => {
  const e = crearEntorno({ programa: { 'era 150': corregir('monto', '150') } });
  e.sembrar([{ tipo: 'gasto', centavos: 18000, categoria: 'Comida', confirmacion: CONF1 }]);
  assert.deepEqual(await e.escribir('era 150', { citadoId: `${GRUPO}:otro` }), [
    'No encontré qué corregir. Cita la confirmación del registro o escribe "corrige el último …".',
  ]);
  assert.equal(e.filas('SELECT 1 FROM cambios').length, 0);
});

test('una confirmación con dos movimientos sin pista pide precisar', async () => {
  const e = crearEntorno({ programa: { 'era 60': corregir('monto', '60') } });
  e.sembrar([
    { tipo: 'gasto', centavos: 5000, categoria: 'Comida', confirmacion: CONF1 },
    { tipo: 'gasto', centavos: 20000, categoria: 'Transporte', confirmacion: CONF1 },
  ]);
  assert.deepEqual(await e.escribir('era 60', { citadoId: CONF1 }), [
    'Esa confirmación tiene 2 movimientos. Dime cuál: el de $50.00 o el de $200.00.',
  ]);
  assert.equal(e.filas('SELECT 1 FROM cambios').length, 0);
});

test('con pista de monto se corrige el indicado', async () => {
  const texto = 'el de 50 era 60';
  const e = crearEntorno({ programa: { [texto]: corregir('monto', '60', { monto_texto: '50' }) } });
  const [cafe, gasolina] = e.sembrar([
    { tipo: 'gasto', centavos: 5000, categoria: 'Comida', confirmacion: CONF1 },
    { tipo: 'gasto', centavos: 20000, categoria: 'Transporte', confirmacion: CONF1 },
  ]);
  assert.deepEqual(await e.escribir(texto, { citadoId: CONF1 }), [
    'Corregido: gasto · Comida · hoy. Monto: $50.00 → $60.00',
  ]);
  assert.equal(fila(e, cafe!).monto_centavos, 6000);
  assert.equal(fila(e, gasolina!).monto_centavos, 20000);
});

test('con pista de categoría se corrige el indicado', async () => {
  const texto = 'la gasolina era 250';
  const e = crearEntorno({ programa: { [texto]: corregir('monto', '250', { categoria: 'Transporte' }) } });
  const [cafe, gasolina] = e.sembrar([
    { tipo: 'gasto', centavos: 5000, categoria: 'Comida', confirmacion: CONF1 },
    { tipo: 'gasto', centavos: 20000, categoria: 'Transporte', confirmacion: CONF1 },
  ]);
  await e.escribir(texto, { citadoId: CONF1 });
  assert.equal(fila(e, cafe!).monto_centavos, 5000);
  assert.equal(fila(e, gasolina!).monto_centavos, 25000);
});
