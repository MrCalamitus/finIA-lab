// US3 de la 002: registrar gastos desde la foto de un ticket (FR-016 a FR-023), escenarios 1–16.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, salidaTicket, mov } from '../dobles/fabrica.ts';

const TICKET = salidaTicket(
  [
    ['Leche entera 1 l', '57.00', 'Comida', '2 x'],
    ['Manzana gala', '36.00', 'Comida', '800 g'],
    ['Pan blanco', '15.00', 'Comida', '3 piezas'],
    ['Detergente líquido', '89.90', 'Hogar', '3 l', '10.00'],
    ['Huevo', '42.00', 'Comida', '12 piezas'],
  ],
  '229.90',
);

const PROPUESTA = [
  '🧾 *Ticket de Super La Esquina* · ayer _(fecha del ticket)_',
  '1. Leche entera 1 l (2 x) · *$57.00* · 🌮 Comida',
  '2. Manzana gala (800 g) · *$36.00* · 🌮 Comida',
  '3. Pan blanco (3 piezas) · *$15.00* · 🌮 Comida',
  '4. Detergente líquido (3 l) · *$79.90* · 🏠 Hogar · descuento *$10.00*',
  '5. Huevo (12 piezas) · *$42.00* · 🌮 Comida',
  '✅ Suman *$229.90*, igual que el total del ticket.',
  'Responde *sí* para guardar los 5.',
].join('\n');

function conTicket(salida: unknown = TICKET, programa: Record<string, unknown> = {}) {
  const e = crearEntorno({ programa });
  e.interprete.programarTicket(salida);
  return e;
}

const movimientos = (e: ReturnType<typeof crearEntorno>) =>
  e.filas<Record<string, unknown>>(
    'SELECT monto_centavos, categoria, fecha, origen, descripcion, cantidad, ticket_id, indice_en_mensaje, estado, confirmacion_msg_id FROM movimientos ORDER BY id',
  );

test('escenario 1: una foto produce la propuesta y no guarda nada todavía', async () => {
  const e = conTicket();
  assert.deepEqual(await e.escribir(null, { foto: true }), [PROPUESTA]);
  assert.equal(movimientos(e).length, 0);
  assert.equal(e.repo.espera()?.tipo, 'ticket_confirmacion');
  assert.deepEqual(e.filas('SELECT estado, total_centavos, fecha, origen_fecha FROM tickets'), [
    { estado: 'pendiente', total_centavos: 22990, fecha: '2026-10-12', origen_fecha: 'ticket' },
  ]);
  assert.equal(e.interprete.llamadas.length, 0, 'una foto no pasa por el intérprete de texto');
});

test('escenario 2: "sí" guarda un movimiento por artículo con descripción y cantidad', async () => {
  const e = conTicket();
  await e.escribir(null, { foto: true });
  const [r] = await e.escribir('sí');
  assert.equal(r, '✅ *Guardé el ticket de Super La Esquina* · 5 artículos · *$229.90* · ayer');
  const filas = movimientos(e);
  assert.equal(filas.length, 5);
  assert.deepEqual(filas[3], {
    monto_centavos: 7990,
    categoria: 'Hogar',
    fecha: '2026-10-12',
    origen: 'imagen',
    descripcion: 'Detergente líquido',
    cantidad: '3 l',
    ticket_id: 1,
    indice_en_mensaje: 3,
    estado: 'vigente',
    confirmacion_msg_id: e.idUltimaRespuesta(),
  });
  assert.deepEqual(e.filas('SELECT estado, confirmacion_msg_id FROM tickets'), [
    { estado: 'guardado', confirmacion_msg_id: e.idUltimaRespuesta() },
  ]);
  assert.equal(e.repo.espera(), null);
});

test('escenario 3: otra respuesta descarta el ticket con aviso y sigue su camino', async () => {
  const e = conTicket(TICKET, { 'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] } });
  await e.escribir(null, { foto: true });
  const respuestas = await e.escribir('gasté 180 en tacos');
  assert.deepEqual(respuestas, [
    '⚠️ No guardé el ticket de *$229.90* porque no lo confirmaste.',
    '✅ Registrado: gasto de *$180.00* · 🌮 Comida · hoy',
  ]);
  assert.deepEqual(e.filas('SELECT estado FROM tickets'), [{ estado: 'descartado' }]);
  assert.equal(movimientos(e).length, 1);
});

test('escenario 4 (FR-018c): la fecha escrita en el texto gana a la del ticket', async () => {
  const e = conTicket();
  const [r] = await e.escribir('súper de hoy', { foto: true });
  assert.match(r!, /^🧾 \*Ticket de Super La Esquina\* · hoy _\(fecha que escribiste\)_/);
  assert.doesNotMatch(r!, /Ignoré/, 'sin números fuera de la fecha no hay aviso');
});

test('escenario 5: sin total legible pide una foto más nítida', async () => {
  const e = conTicket(salidaTicket([['Pan', '15.00']], null));
  assert.deepEqual(await e.escribir(null, { foto: true }), [
    '⚠️ No pude leer el *total* del ticket. Envía una foto más nítida donde se vea el total.',
  ]);
  assert.equal(e.filas('SELECT 1 FROM tickets').length, 0);
  assert.deepEqual(e.filas(`SELECT resultado FROM mensajes_procesados`), [{ resultado: 'imagen_rechazada' }]);
});

test('escenario 6: si la suma no cuadra muestra ambas cifras y no propone nada', async () => {
  const e = conTicket(salidaTicket([['Pan', '15.00'], ['Leche', '28.50']], '53.50'));
  assert.deepEqual(await e.escribir(null, { foto: true }), [
    '⚠️ Los artículos suman *$43.50* pero el total del ticket es *$53.50*. Envía una foto más nítida donde se vea el total.',
  ]);
  assert.equal(e.repo.espera(), null);
});

test('escenario 7: una foto que no es ticket', async () => {
  const e = conTicket({ es_ticket: false, comercio: null, fecha: null, total_texto: null, articulos: [] });
  const [r] = await e.escribir(null, { foto: true });
  assert.match(r!, /^⚠️ No encontré un ticket en la imagen\./);
});

test('escenario 8: una salida ilegible del modelo sugiere escribir el gasto', async () => {
  const e = conTicket('esto no es JSON del ticket');
  const [r] = await e.escribir(null, { foto: true });
  assert.match(r!, /^⚠️ No pude leer bien el ticket\. .*```gasté 180 en tacos```$/);
});

test('escenarios 9 y 10: sin fecha pide la fecha; "ayer" completa la propuesta', async () => {
  const e = conTicket({ ...TICKET, fecha: null });
  assert.deepEqual(await e.escribir(null, { foto: true }), [
    '🤔 No encontré la fecha del ticket. Envía otra foto donde se vea o escríbela, por ejemplo ```12/10/2026``` o ```ayer```.',
  ]);
  assert.deepEqual(e.repo.espera(), { tipo: 'ticket_fecha', referencia: '1' });
  assert.deepEqual(e.filas('SELECT estado, fecha FROM tickets'), [{ estado: 'esperando_fecha', fecha: null }]);
  const [propuesta] = await e.escribir('ayer');
  assert.equal(propuesta, PROPUESTA.replace('_(fecha del ticket)_', '_(fecha que escribiste)_'));
  assert.equal(e.repo.espera()?.tipo, 'ticket_confirmacion');
});

test('FR-018c: una fecha impresa futura cuenta como no encontrada', async () => {
  const e = conTicket({ ...TICKET, fecha: '2026-12-25' });
  const [r] = await e.escribir(null, { foto: true });
  assert.match(r!, /^🤔 No encontré la fecha del ticket/);
});

test('FR-018c (U1): sin fecha, otra foto se procesa como ticket nuevo que sustituye al anterior', async () => {
  const e = conTicket({ ...TICKET, fecha: null });
  await e.escribir(null, { foto: true });
  e.interprete.programarTicket(TICKET);
  const [r] = await e.escribir(null, { foto: true });
  assert.equal(r, PROPUESTA);
  assert.deepEqual(e.filas('SELECT estado FROM tickets ORDER BY id'), [{ estado: 'descartado' }, { estado: 'pendiente' }]);
});

test('FR-018c: sin fecha, un texto que no es fecha descarta el ticket y se procesa', async () => {
  const e = conTicket({ ...TICKET, fecha: null });
  await e.escribir(null, { foto: true });
  const respuestas = await e.escribir('hola');
  assert.equal(respuestas[0], '⚠️ No guardé el ticket de *$229.90* porque no lo confirmaste.');
  assert.equal(respuestas.length, 2);
  assert.deepEqual(e.filas('SELECT estado FROM tickets'), [{ estado: 'descartado' }]);
});

test('escenarios 11 y 12: repetido contra otro ticket; "sin repetidos" guarda solo los no marcados', async () => {
  const e = conTicket();
  await e.escribir(null, { foto: true });
  await e.escribir('sí');
  e.interprete.programarTicket(salidaTicket([['LECHE ENTERA 1L', '57.00'], ['Chocolate', '20.00']], '77.00'));
  const [propuesta] = await e.escribir(null, { foto: true });
  assert.match(propuesta!, /1\. LECHE ENTERA 1L · \*\$57\.00\* · 🌮 Comida ⚠️ _posible repetido de: "Leche entera 1 l" del ticket del 12\/10_/);
  assert.match(propuesta!, /Responde \*sí\* para guardar los 2 o \*sin repetidos\* para guardar 1\.$/);
  const [r] = await e.escribir('sin repetidos');
  assert.match(r!, /1 artículo · \*\$20\.00\*/);
  assert.equal(movimientos(e).length, 6);
});

test('escenario 16: repetido contra un gasto escrito por texto', async () => {
  const e = conTicket(salidaTicket([['Leche', '28.50']], '28.50'));
  e.sembrar([{ tipo: 'gasto', centavos: 2850, categoria: 'Comida', fecha: '2026-10-12', texto: 'gasté 28.50 en leche' }]);
  const [propuesta] = await e.escribir(null, { foto: true });
  assert.match(propuesta!, /⚠️ _posible repetido de: gasto del 12\/10 "gasté 28\.50 en leche"_/);
});

test('"sin repetidos" cuando todos son repetidos no guarda nada', async () => {
  const e = conTicket();
  await e.escribir(null, { foto: true });
  await e.escribir('sí');
  const [propuesta] = await e.escribir(null, { foto: true });
  assert.match(propuesta!, /⚠️ Todos parecen repetidos\. Responde \*sí\* para guardarlos de todos modos o \*sin repetidos\* para no guardar nada\.$/);
  const [r] = await e.escribir('sin repetidos');
  assert.equal(r, '✅ No guardé nada: todos los artículos ya estaban registrados.');
  assert.equal(movimientos(e).length, 5);
});

test('escenario 15 (FR-020): productos o montos en el texto se ignoran y se avisa', async () => {
  const e = conTicket();
  const [r] = await e.escribir('ayer gasté 50 en café', { foto: true });
  assert.match(r!, /ℹ️ Ignoré los productos y montos del texto; solo uso los del ticket\./);
  assert.doesNotMatch(r!, /café/);
  assert.equal(e.interprete.llamadas.length, 0);
});

test('escenarios 13 y 14 (FR-020a): borrar el ticket citando su confirmación', async () => {
  const e = conTicket();
  await e.escribir(null, { foto: true });
  await e.escribir('sí');
  const confirmacion = e.idUltimaRespuesta()!;
  const [pregunta] = await e.escribir('borra el ticket', { citadoId: confirmacion });
  assert.equal(pregunta, '🤔 ¿Borro los *5 artículos* del ticket del 12/10 por *$229.90*? Responde *sí* para borrarlos.');
  assert.equal(e.filas(`SELECT 1 FROM movimientos WHERE estado = 'vigente'`).length, 5);
  const [r] = await e.escribir('sí');
  assert.equal(r, '🗑️ Borré el ticket del 12/10: 5 artículos por *$229.90*.');
  assert.equal(e.filas(`SELECT 1 FROM movimientos WHERE estado = 'borrado'`).length, 5);
  assert.equal(e.filas(`SELECT 1 FROM cambios WHERE accion = 'borrar_ticket'`).length, 5);
  assert.deepEqual(e.filas('SELECT estado FROM tickets'), [{ estado: 'borrado' }]);
});

test('FR-023: modelo de visión no disponible → nada guardado y aviso', async () => {
  const e = conTicket();
  e.interprete.ticketNoDisponible = true;
  assert.deepEqual(await e.escribir(null, { foto: true }), [
    '⚠️ No puedo leer imágenes en este momento. No guardé nada; inténtalo más tarde o escribe el gasto.',
  ]);
  assert.equal(e.filas('SELECT 1 FROM tickets').length, 0);
});

test('FR-021: una imagen rechazada por tipo o tamaño recibe aviso', async () => {
  const e = conTicket();
  assert.deepEqual(await e.escribir(null, { imagenRechazada: true }), ['⚠️ Solo puedo leer fotos JPG o PNG de hasta 5 MB.']);
  assert.equal(e.interprete.llamadasTicket, 0);
});

test('FR-018b: más de 40 artículos', async () => {
  const muchos = Array.from({ length: 41 }, () => ['Pan', '1.00'] as [string, string]);
  const e = conTicket(salidaTicket(muchos, '41.00'));
  assert.deepEqual(await e.escribir(null, { foto: true }), [
    '⚠️ El ticket tiene más de 40 artículos. Regístralo por partes o escríbelo a mano.',
  ]);
});

test('un ticket mayor al umbral pide una sola confirmación', async () => {
  const e = conTicket(salidaTicket([['Pantalla', '60,000.00', 'Hogar']], '60,000.00'));
  await e.escribir(null, { foto: true });
  await e.escribir('sí');
  assert.deepEqual(e.filas('SELECT monto_centavos, estado FROM movimientos'), [{ monto_centavos: 6_000_000, estado: 'vigente' }]);
});

test('los artículos guardados cuentan en consultas y resumen', async () => {
  const e = conTicket(TICKET, { resumen: { accion: 'resumen' } });
  await e.escribir(null, { foto: true });
  await e.escribir('sí');
  const [resumen] = await e.escribir('resumen');
  assert.match(resumen!, /💸 Gastos: \*\$229\.90\*/);
});

// --- FR-018e: cuadre con IVA desglosado y descuento general ---

test('gasolina: la propuesta muestra el IVA y "sí" guarda el monto con IVA', async () => {
  const e = conTicket(
    salidaTicket([['MAGNA', '259.64', 'Transporte', '12.51']], '$300.00', { subtotal_texto: '$259.64', impuesto_texto: '$40.36' }),
    { resumen: { accion: 'resumen' } },
  );
  const [propuesta] = await e.escribir(null, { foto: true });
  assert.match(propuesta!, /\n1\. MAGNA \(12\.51\) · \*\$300\.00\* · 🚌 Transporte\n/);
  assert.match(propuesta!, /✅ Suman \*\$259\.64\* \+ IVA \*\$40\.36\* = \*\$300\.00\*, igual que el total del ticket\. Repartí el IVA entre los artículos\./);
  await e.escribir('sí');
  assert.deepEqual(e.filas('SELECT monto_centavos, categoria FROM movimientos'), [{ monto_centavos: 30_000, categoria: 'Transporte' }]);
  const [resumen] = await e.escribir('resumen');
  assert.match(resumen!, /💸 Gastos: \*\$300\.00\*/);
});

test('descuento general: los movimientos suman exactamente el total del ticket', async () => {
  const e = conTicket(
    salidaTicket([['DUMPLINGS', '1,000.00'], ['RALLADOR', '2,000.00', 'Hogar'], ['CANELA', '50.39']], '2,990.32', {
      subtotal_texto: '3,050.39',
      descuento_general_texto: '60.07',
    }),
  );
  const [propuesta] = await e.escribir(null, { foto: true });
  assert.match(propuesta!, /✅ Suman \*\$3,050\.39\* − descuento \*\$60\.07\* = \*\$2,990\.32\*, igual que el total del ticket\. Repartí el descuento entre los artículos\./);
  await e.escribir('sí');
  const [fila] = e.filas<{ total: number }>('SELECT SUM(monto_centavos) AS total FROM movimientos');
  assert.equal(fila!.total, 299_032);
});

test('IVA y descuento a la vez aparecen en la misma línea', async () => {
  const e = conTicket(
    salidaTicket([['A', '60.00'], ['B', '40.00']], '110.00', { subtotal_texto: '100.00', impuesto_texto: '16.00', descuento_general_texto: '6.00' }),
  );
  const [propuesta] = await e.escribir(null, { foto: true });
  assert.match(propuesta!, /✅ Suman \*\$100\.00\* \+ IVA \*\$16\.00\* − descuento \*\$6\.00\* = \*\$110\.00\*, igual que el total del ticket\. Repartí el IVA y el descuento entre los artículos\./);
});
