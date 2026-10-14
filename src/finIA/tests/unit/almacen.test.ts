import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBaseDeDatos, migrar } from '../../src/almacen/db.ts';
import { crearRepositorio } from '../../src/almacen/repositorio.ts';

const AHORA = new Date(2026, 9, 13, 12, 0, 0);

function nuevaBase() {
  const db = abrirBaseDeDatos(':memory:', AHORA);
  return { db, repo: crearRepositorio(db) };
}

function insertarMovimiento(db: ReturnType<typeof nuevaBase>['db'], cambios: Record<string, unknown> = {}) {
  const fila = {
    tipo: 'gasto',
    monto_centavos: 18000,
    categoria: 'Comida',
    fecha: '2026-10-13',
    texto_original: 'gasté 180 en tacos',
    mensaje_origen_id: 'g:1',
    indice_en_mensaje: 0,
    estado: 'vigente',
    creado_en: AHORA.toISOString(),
    actualizado_en: AHORA.toISOString(),
    ...cambios,
  };
  db.prepare(
    `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
       indice_en_mensaje, estado, creado_en, actualizado_en)
     VALUES (:tipo, :monto_centavos, :categoria, :fecha, :texto_original, :mensaje_origen_id,
       :indice_en_mensaje, :estado, :creado_en, :actualizado_en)`,
  ).run(fila as never);
}

function prepararMensaje(repo: ReturnType<typeof nuevaBase>['repo'], id = 'g:1') {
  repo.marcarProcesado(id, AHORA, 'registrado');
}

test('las migraciones crean las 5 tablas', () => {
  const { db } = nuevaBase();
  const tablas = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all()
    .map((f) => (f as { name: string }).name);
  assert.deepEqual(tablas, ['cambios', 'estado', 'mensajes_enviados', 'mensajes_procesados', 'movimientos']);
});

test('guarda version_esquema y primer_arranque', () => {
  const { repo } = nuevaBase();
  assert.equal(repo.leerEstado('version_esquema'), '1');
  assert.equal(repo.primerArranque().toISOString(), AHORA.toISOString());
});

test('abrir de nuevo no cambia primer_arranque', () => {
  const db = abrirBaseDeDatos(':memory:', AHORA);
  const despues = new Date(2026, 9, 20);
  // Simula un segundo arranque sobre la misma base.
  migrar(db, despues);
  assert.equal(crearRepositorio(db).primerArranque().toISOString(), AHORA.toISOString());
});

test('mensajes_procesados no admite ids duplicados', () => {
  const { repo } = nuevaBase();
  repo.marcarProcesado('g:1', AHORA, 'registrado');
  assert.equal(repo.yaProcesado('g:1'), true);
  assert.equal(repo.yaProcesado('g:2'), false);
  assert.throws(() => repo.marcarProcesado('g:1', AHORA, 'registrado'));
});

test('mensajes_procesados rechaza resultados fuera de la lista', () => {
  const { repo } = nuevaBase();
  assert.throws(() => repo.marcarProcesado('g:1', AHORA, 'hackeado' as never));
});

test('mensajes_enviados recuerda las respuestas del asistente', () => {
  const { repo } = nuevaBase();
  assert.equal(repo.esEnviado('g:BOT1'), false);
  repo.guardarEnviado('g:BOT1');
  assert.equal(repo.esEnviado('g:BOT1'), true);
});

test('movimientos aplica sus restricciones', () => {
  const { db, repo } = nuevaBase();
  prepararMensaje(repo);
  insertarMovimiento(db);
  assert.throws(() => insertarMovimiento(db, { indice_en_mensaje: 1, monto_centavos: 0 }), /CHECK/);
  assert.throws(() => insertarMovimiento(db, { indice_en_mensaje: 1, monto_centavos: -100 }), /CHECK/);
  assert.throws(() => insertarMovimiento(db, { indice_en_mensaje: 1, tipo: 'prestamo' }), /CHECK/);
  assert.throws(() => insertarMovimiento(db, { indice_en_mensaje: 1, estado: 'oculto' }), /CHECK/);
  assert.throws(() => insertarMovimiento(db, { indice_en_mensaje: 10 }), /CHECK/);
  assert.throws(() => insertarMovimiento(db), /UNIQUE/);
  assert.throws(() => insertarMovimiento(db, { mensaje_origen_id: 'g:no-existe' }), /FOREIGN KEY/);
});

test('transaccion revierte todo si la función lanza', () => {
  const { repo } = nuevaBase();
  assert.throws(() =>
    repo.transaccion(() => {
      repo.marcarProcesado('g:1', AHORA, 'registrado');
      throw new Error('falla a la mitad');
    }),
  );
  assert.equal(repo.yaProcesado('g:1'), false);
});

test('transaccion confirma si la función termina', () => {
  const { repo } = nuevaBase();
  const valor = repo.transaccion(() => {
    repo.marcarProcesado('g:1', AHORA, 'registrado');
    return 42;
  });
  assert.equal(valor, 42);
  assert.equal(repo.yaProcesado('g:1'), true);
});
