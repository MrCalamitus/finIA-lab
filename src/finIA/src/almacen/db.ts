// SQLite local con el módulo nativo node:sqlite (research R8, data-model.md).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const VERSION_ESQUEMA = 1;

const MIGRACION_V1 = `
CREATE TABLE mensajes_procesados (
  mensaje_id   TEXT PRIMARY KEY,
  enviado_en   TEXT NOT NULL,
  resultado    TEXT NOT NULL CHECK (resultado IN ('registrado','pendiente','consulta','resumen','correccion',
                                                 'borrado','confirmado','rechazado','ignorado_antiguo')),
  procesado_en TEXT NOT NULL
);

CREATE TABLE movimientos (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo                TEXT    NOT NULL CHECK (tipo IN ('gasto','ingreso')),
  monto_centavos      INTEGER NOT NULL CHECK (typeof(monto_centavos) = 'integer' AND monto_centavos > 0),
  categoria           TEXT    NOT NULL,
  fecha               TEXT    NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  texto_original      TEXT    NOT NULL,
  -- Diferida: se comprueba al confirmar la transacción que también marca el mensaje.
  mensaje_origen_id   TEXT    NOT NULL REFERENCES mensajes_procesados (mensaje_id) DEFERRABLE INITIALLY DEFERRED,
  indice_en_mensaje   INTEGER NOT NULL CHECK (indice_en_mensaje BETWEEN 0 AND 9),
  confirmacion_msg_id TEXT,
  estado              TEXT    NOT NULL CHECK (estado IN ('pendiente','vigente','borrado','descartado')),
  creado_en           TEXT    NOT NULL,
  actualizado_en      TEXT    NOT NULL,
  UNIQUE (mensaje_origen_id, indice_en_mensaje)
);
CREATE INDEX movimientos_estado_fecha ON movimientos (estado, fecha);
CREATE INDEX movimientos_confirmacion ON movimientos (confirmacion_msg_id);

CREATE TABLE cambios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  movimiento_id  INTEGER NOT NULL REFERENCES movimientos (id),
  accion         TEXT    NOT NULL CHECK (accion IN ('corregir','borrar','descartar','confirmar')),
  campo          TEXT    CHECK (campo IS NULL OR campo IN ('monto_centavos','categoria','fecha')),
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  mensaje_id     TEXT    NOT NULL,
  creado_en      TEXT    NOT NULL
);

CREATE TABLE mensajes_enviados (
  mensaje_id TEXT PRIMARY KEY,
  enviado_en TEXT NOT NULL
);

CREATE TABLE estado (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
`;

/** Aplica las migraciones pendientes y registra `primer_arranque` solo la primera vez. */
export function migrar(db: DatabaseSync, ahora: Date): void {
  const existe = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'estado'`).get();
  if (!existe) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRACION_V1);
      db.prepare(`INSERT INTO estado (clave, valor) VALUES ('version_esquema', ?)`).run(String(VERSION_ESQUEMA));
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  db.prepare(`INSERT OR IGNORE INTO estado (clave, valor) VALUES ('primer_arranque', ?)`).run(ahora.toISOString());
}

/** Abre (o crea) la base en `ruta` (`:memory:` para pruebas) y la deja migrada. */
export function abrirBaseDeDatos(ruta: string, ahora: Date = new Date()): DatabaseSync {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA foreign_keys = ON');
  if (ruta !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
  migrar(db, ahora);
  return db;
}
