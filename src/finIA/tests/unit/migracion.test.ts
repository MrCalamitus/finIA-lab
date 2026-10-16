// Migración v1 → v2 (data-model.md de la 002). La 001 no debe perder nada.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { migrar } from '../../src/almacen/db.ts';
import { crearRepositorio } from '../../src/almacen/repositorio.ts';

const AHORA = new Date(2026, 9, 13, 12, 0, 0);
const filas = (db: DatabaseSync, sql: string, ...p: (string | number)[]) =>
  db.prepare(sql).all(...p).map((f) => ({ ...f })) as Record<string, unknown>[];

/** Base en el esquema v1 con datos de la 001: un movimiento vigente, uno corregido y un pendiente. */
function baseV1() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON');
  migrar(db, AHORA, 1);
  const repo = crearRepositorio(db);
  repo.transaccion(() => {
    repo.marcarProcesado('g:1', AHORA, 'registrado');
    db.prepare(
      `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
         indice_en_mensaje, confirmacion_msg_id, estado, creado_en, actualizado_en)
       VALUES ('gasto', 18000, 'Comida', '2026-10-13', 'gasté 180 en tacos', 'g:1', 0, 'g:bot-1', 'vigente', 'x', 'x'),
              ('gasto', 5000, 'Ropa', '2026-10-13', 'gasté 50 en calcetines', 'g:1', 1, NULL, 'vigente', 'x', 'x')`,
    ).run();
    db.prepare(
      `INSERT INTO cambios (movimiento_id, accion, campo, valor_anterior, valor_nuevo, mensaje_id, creado_en)
       VALUES (1, 'corregir', 'monto_centavos', '20000', '18000', 'g:2', 'x')`,
    ).run();
    repo.marcarProcesado('g:3', AHORA, 'pendiente');
    db.prepare(
      `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
         indice_en_mensaje, estado, creado_en, actualizado_en)
       VALUES ('ingreso', 7500000, 'Salario', '2026-10-13', 'me pagaron 75,000', 'g:3', 0, 'pendiente', 'x', 'x')`,
    ).run();
  });
  repo.guardarEnviado('g:bot-1');
  return db;
}

test('v1 → v2 conserva movimientos, cambios, mensajes y sus ids', () => {
  const db = baseV1();
  const antes = filas(db, 'SELECT id, tipo, monto_centavos, categoria, fecha, estado, confirmacion_msg_id FROM movimientos ORDER BY id');
  migrar(db, AHORA);
  assert.deepEqual(
    filas(db, 'SELECT id, tipo, monto_centavos, categoria, fecha, estado, confirmacion_msg_id FROM movimientos ORDER BY id'),
    antes,
  );
  assert.deepEqual(filas(db, 'SELECT DISTINCT origen FROM movimientos'), [{ origen: 'texto' }]);
  assert.equal(filas(db, 'SELECT 1 FROM cambios').length, 1);
  assert.equal(filas(db, 'SELECT 1 FROM mensajes_procesados').length, 2);
  assert.equal(filas(db, 'SELECT 1 FROM mensajes_enviados').length, 1);
  assert.equal(crearRepositorio(db).leerEstado('version_esquema'), '2');
  assert.deepEqual(filas(db, 'PRAGMA foreign_key_check'), []);
});

test('v2 amplía las restricciones', () => {
  const db = baseV1();
  migrar(db, AHORA);
  const repo = crearRepositorio(db);
  repo.transaccion(() => {
    repo.marcarProcesado('g:10', AHORA, 'ticket_guardado');
    db.prepare(
      `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
         indice_en_mensaje, estado, origen, descripcion, cantidad, creado_en, actualizado_en)
       VALUES ('gasto', 100, 'Comida', '2026-10-13', '[ticket]', 'g:10', 39, 'vigente', 'imagen', 'Pan', '3 piezas', 'x', 'x')`,
    ).run();
  });
  assert.throws(() =>
    db.prepare(
      `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
         indice_en_mensaje, estado, creado_en, actualizado_en)
       VALUES ('gasto', 100, 'Comida', '2026-10-13', 'x', 'g:10', 40, 'vigente', 'x', 'x')`,
    ).run(),
  /CHECK/);
  assert.throws(() =>
    db.prepare(
      `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
         indice_en_mensaje, estado, origen, creado_en, actualizado_en)
       VALUES ('gasto', 100, 'Comida', '2026-10-13', 'x', 'g:10', 38, 'vigente', 'fax', 'x', 'x')`,
    ).run(),
  /CHECK/);
  for (const resultado of ['configuracion', 'ticket_esperando_fecha', 'ticket_propuesto', 'ticket_guardado', 'ticket_descartado', 'ticket_borrado', 'imagen_rechazada']) {
    repo.marcarProcesado(`g:r-${resultado}`, AHORA, resultado as never);
  }
  db.prepare(`INSERT INTO cambios (movimiento_id, accion, mensaje_id, creado_en) VALUES (1, 'borrar_ticket', 'g:11', 'x')`).run();
});

test('v2 siembra categorías, umbral y estado de configuración', () => {
  const db = baseV1();
  migrar(db, AHORA);
  const repo = crearRepositorio(db);
  assert.deepEqual(
    filas(db, `SELECT nombre, emoji FROM categorias WHERE tipo = 'gasto' ORDER BY orden`),
    [
      { nombre: 'Comida', emoji: '🌮' },
      { nombre: 'Transporte', emoji: '🚌' },
      { nombre: 'Hogar', emoji: '🏠' },
      { nombre: 'Servicios', emoji: '💡' },
      { nombre: 'Salud', emoji: '💊' },
      { nombre: 'Educación', emoji: '📚' },
      { nombre: 'Entretenimiento', emoji: '🎬' },
      { nombre: 'Ropa', emoji: '👕' },
      { nombre: 'Otros', emoji: '📦' },
    ],
  );
  assert.deepEqual(
    filas(db, `SELECT nombre, emoji FROM categorias WHERE tipo = 'ingreso' ORDER BY orden`),
    [
      { nombre: 'Salario', emoji: '💼' },
      { nombre: 'Honorarios', emoji: '🧾' },
      { nombre: 'Regalo', emoji: '🎁' },
      { nombre: 'Otros', emoji: '📦' },
    ],
  );
  assert.equal(repo.umbralCentavos(), 5_000_000);
  assert.equal(repo.estadoConfiguracion(), 'pendiente');
  assert.throws(() => db.prepare(`INSERT INTO categorias (tipo, nombre, emoji, orden) VALUES ('gasto', 'comida', '🏷️', 99)`).run(), /UNIQUE/);
});

test('un pendiente de la 001 queda como espera registro_pendiente', () => {
  const db = baseV1();
  migrar(db, AHORA);
  assert.deepEqual(crearRepositorio(db).espera(), { tipo: 'registro_pendiente', referencia: 'g:3' });
});

test('migrar dos veces no duplica nada', () => {
  const db = baseV1();
  migrar(db, AHORA);
  migrar(db, AHORA);
  assert.equal(filas(db, 'SELECT 1 FROM categorias').length, 13);
  assert.equal(filas(db, 'SELECT 1 FROM movimientos').length, 3);
  assert.equal(filas(db, 'SELECT 1 FROM espera').length, 1);
});

test('la tabla espera solo admite una fila', () => {
  const db = baseV1();
  migrar(db, AHORA);
  assert.throws(() => db.prepare(`INSERT INTO espera (id, tipo, creado_en) VALUES (2, 'ticket_fecha', 'x')`).run(), /CHECK/);
});
