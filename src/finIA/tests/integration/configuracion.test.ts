// US1 de la 002: configuración por chat (FR-001 a FR-009), escenarios 1–11 de la spec.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';

const PREGUNTA_1 = /⚙️ \*1\/2 · Categorías de gasto\*/;
const PREGUNTA_2 = /⚙️ \*2\/2 · Monto de confirmación\*/;

const programa = {
  'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] },
  'gasté 6,000 en el veterinario': { accion: 'registrar', movimientos: [mov('gasto', '6,000', 'Mascotas')] },
  'gasté 300 en calcetines': { accion: 'registrar', movimientos: [mov('gasto', '300', 'Ropa')] },
  '¿cuánto en ropa?': { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes', categoria: 'Ropa' } },
};

const activas = (e: ReturnType<typeof crearEntorno>, tipo: 'gasto' | 'ingreso') =>
  e.repo.categorias(tipo, { soloActivas: true }).map((c) => c.nombre);

test('escenario 1 (FR-001): el primer mensaje se procesa y después llega la bienvenida', async () => {
  const e = crearEntorno({ programa, configuracion: 'pendiente' });
  const [registro, bienvenida] = await e.escribir('gasté 180 en tacos');
  assert.equal(registro, '✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy');
  assert.match(bienvenida!, /^👋 \*¡Hola! Vamos a configurar tu asistente\.\*/);
  assert.match(bienvenida!, PREGUNTA_1);
  assert.match(bienvenida!, /Las predeterminadas son:\n🌮 Comida\n🚌 Transporte\n[\s\S]*\n📦 Otros\n/);
  assert.deepEqual(e.repo.espera(), { tipo: 'config_categorias_gasto', referencia: null });
});

test('escenarios 2 y 4: "predeterminadas" y luego "5,000" guardan la configuración', async () => {
  const e = crearEntorno({ programa, configuracion: 'pendiente' });
  await e.escribir('hola');
  const [r2] = await e.escribir('predeterminadas');
  assert.match(r2!, PREGUNTA_2);
  assert.match(r2!, /Ahora: \*\$50,000\.00\*/);
  const [r3] = await e.escribir('5,000');
  assert.match(r3!, /^✅ \*Configuración guardada\*/);
  assert.match(r3!, /💰 Umbral: \$50,000\.00 → \*\$5,000\.00\*/);
  assert.equal(e.repo.umbralCentavos(), 500_000);
  assert.equal(e.repo.estadoConfiguracion(), 'completa');
  assert.equal(e.repo.espera(), null);
  assert.equal(e.interprete.llamadas.filter((t) => t !== 'hola').length, 0, 'las respuestas no pasan por el modelo');
});

test('escenarios 3 y 5: categorías propias y umbral nuevo se usan al registrar', async () => {
  const e = crearEntorno({ programa });
  await e.escribir('configurar');
  const [r1] = await e.escribir('Comida, Transporte, Mascotas, Gimnasio');
  assert.match(r1!, /^✅ \*Categorías de gasto\*\nAntes: Comida, Transporte, .*, Otros\nAhora:\n🌮 Comida\n🚌 Transporte\n🏷️ Mascotas\n🏷️ Gimnasio\n📦 Otros\n/);
  assert.deepEqual(activas(e, 'gasto'), ['Comida', 'Transporte', 'Mascotas', 'Gimnasio', 'Otros']);
  await e.escribir('5,000');
  const [pregunta] = await e.escribir('gasté 6,000 en el veterinario');
  assert.match(pregunta!, /^🤔 ¿Confirmas gasto de \*\$6,000\.00\* · 🏷️ Mascotas · hoy\?/);
});

test('escenario 6: "configurar" muestra los valores actuales', async () => {
  const e = crearEntorno({ programa });
  const [r] = await e.escribir('Configurar.');
  assert.match(r!, PREGUNTA_1);
  assert.match(r!, /Ahora:\n🌮 Comida\n/);
  assert.doesNotMatch(r!, /👋/);
});

test('escenario 7: "ver configuración" muestra categorías y umbral', async () => {
  const e = crearEntorno({ programa });
  const [r] = await e.escribir('ver configuración');
  assert.match(r!, /^⚙️ \*Tu configuración\*/);
  assert.match(r!, /\*Gastos\*\n🌮 Comida\n[\s\S]*📦 Otros\n\n\*Ingresos\*\n💼 Salario\n🧾 Honorarios\n🎁 Regalo\n📦 Otros\n\n💰 Confirmo arriba de \*\$50,000\.00\*$/);
  assert.equal(e.interprete.llamadas.length, 0);
});

test('escenario 8: "configurar ingresos" cambia solo las de ingreso', async () => {
  const e = crearEntorno({ programa });
  const [pregunta] = await e.escribir('configurar ingresos');
  assert.match(pregunta!, /⚙️ \*Categorías de ingreso\*/);
  const [r] = await e.escribir('Salario, Ventas, Renta');
  assert.equal(r, '✅ *Categorías de ingreso*\nAntes: Salario, Honorarios, Regalo, Otros\nAhora:\n💼 Salario\n🏷️ Ventas\n🏷️ Renta\n📦 Otros');
  assert.deepEqual(activas(e, 'ingreso'), ['Salario', 'Ventas', 'Renta', 'Otros']);
  assert.equal(activas(e, 'gasto').length, 9);
  assert.equal(e.repo.espera(), null);
});

test('escenario 9: un intento no válido no guarda nada y vuelve a preguntar', async () => {
  const e = crearEntorno({ programa });
  await e.escribir('configurar');
  const [r1] = await e.escribir('Comida, Gimnasio y spa de lujo total');
  assert.match(r1!, /^⚠️ No pude usar esa lista: "Gimnasio y spa de lujo total" tiene más de 20 caracteres/);
  assert.match(r1!, PREGUNTA_1);
  assert.equal(activas(e, 'gasto').length, 9);
  await e.escribir('predeterminadas');
  const [r2] = await e.escribir('2,000,000');
  assert.match(r2!, /^⚠️ El monto debe estar entre \*\$100\.00\* y \*\$1,000,000\.00\*/);
  assert.match(r2!, PREGUNTA_2);
  assert.equal(e.repo.umbralCentavos(), 5_000_000);
  assert.deepEqual(e.repo.espera(), { tipo: 'config_umbral', referencia: null });
});

test('escenario 10 (FR-006a): un mensaje que no es respuesta pausa y se procesa', async () => {
  const e = crearEntorno({ programa, configuracion: 'pendiente' });
  await e.escribir('hola');
  const respuestas = await e.escribir('gasté 180 en tacos');
  assert.deepEqual(respuestas, [
    '⏸️ Pausé la configuración. Escribe *configurar* cuando quieras terminarla.',
    '✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy',
  ]);
  assert.equal(e.repo.estadoConfiguracion(), 'pausada');
  assert.equal(e.repo.espera(), null);
  assert.equal((await e.escribir('gasté 180 en tacos')).length, 1, 'pausada: no vuelve a dar la bienvenida');
});

test('escenario 11 (FR-006b): quitar una categoría conserva sus movimientos', async () => {
  const e = crearEntorno({ programa });
  e.sembrar([{ tipo: 'gasto', centavos: 30_000, categoria: 'Ropa' }]);
  await e.escribir('configurar');
  await e.escribir('Comida, Transporte');
  await e.escribir('predeterminadas');
  await e.escribir('5,000');
  assert.ok(!activas(e, 'gasto').includes('Ropa'));
  assert.deepEqual(e.filas(`SELECT categoria, estado FROM movimientos`), [{ categoria: 'Ropa', estado: 'vigente' }]);
  const [consulta] = await e.escribir('¿cuánto en ropa?');
  assert.match(consulta!, /\*\$300\.00\* · 1 gasto/);
  await e.escribir('gasté 300 en calcetines');
  assert.equal(e.filas('SELECT 1 FROM movimientos').length, 1, 'Ropa ya no se acepta para registros nuevos');
});

test('la bienvenida no reemplaza una confirmación pendiente', async () => {
  const e = crearEntorno({
    programa: { 'me pagaron 75,000': { accion: 'registrar', movimientos: [mov('ingreso', '75,000', 'Salario')] } },
    configuracion: 'pendiente',
  });
  const respuestas = await e.escribir('me pagaron 75,000');
  assert.equal(respuestas.length, 1);
  assert.equal(e.repo.espera()?.tipo, 'registro_pendiente');
  const [confirmado, bienvenida] = await e.escribir('sí');
  assert.match(confirmado!, /^✅ Registrado/);
  assert.match(bienvenida!, PREGUNTA_1);
});
