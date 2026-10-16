// SQLite local con el módulo nativo node:sqlite (research R8, data-model.md).
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { PREDETERMINADAS } from '../dominio/categorias.ts';
import { UMBRAL_CONFIRMACION_CENTAVOS } from '../dominio/dinero.ts';

const VERSION_ESQUEMA = 2;

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

const MIGRACION_V2 = `
CREATE TABLE mensajes_procesados_v2 (
  mensaje_id   TEXT PRIMARY KEY,
  enviado_en   TEXT NOT NULL,
  resultado    TEXT NOT NULL CHECK (resultado IN ('registrado','pendiente','consulta','resumen','correccion',
                                                 'borrado','confirmado','rechazado','ignorado_antiguo',
                                                 'configuracion','ticket_esperando_fecha','ticket_propuesto',
                                                 'ticket_guardado','ticket_descartado','ticket_borrado',
                                                 'imagen_rechazada')),
  procesado_en TEXT NOT NULL
);
INSERT INTO mensajes_procesados_v2 SELECT mensaje_id, enviado_en, resultado, procesado_en FROM mensajes_procesados;
DROP TABLE mensajes_procesados;
ALTER TABLE mensajes_procesados_v2 RENAME TO mensajes_procesados;

CREATE TABLE tickets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  mensaje_origen_id   TEXT    NOT NULL UNIQUE REFERENCES mensajes_procesados (mensaje_id) DEFERRABLE INITIALLY DEFERRED,
  comercio            TEXT,
  fecha               TEXT    CHECK (fecha IS NULL OR fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  origen_fecha        TEXT    CHECK (origen_fecha IS NULL OR origen_fecha IN ('texto','ticket')),
  total_centavos      INTEGER NOT NULL CHECK (typeof(total_centavos) = 'integer' AND total_centavos > 0),
  propuesta           TEXT    NOT NULL,
  texto_foto          TEXT,
  estado              TEXT    NOT NULL CHECK (estado IN ('esperando_fecha','pendiente','guardado','descartado','borrado')),
  confirmacion_msg_id TEXT,
  creado_en           TEXT    NOT NULL,
  actualizado_en      TEXT    NOT NULL
);
CREATE INDEX tickets_confirmacion ON tickets (confirmacion_msg_id);

CREATE TABLE movimientos_v2 (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo                TEXT    NOT NULL CHECK (tipo IN ('gasto','ingreso')),
  monto_centavos      INTEGER NOT NULL CHECK (typeof(monto_centavos) = 'integer' AND monto_centavos > 0),
  categoria           TEXT    NOT NULL,
  fecha               TEXT    NOT NULL CHECK (fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  texto_original      TEXT    NOT NULL,
  mensaje_origen_id   TEXT    NOT NULL REFERENCES mensajes_procesados (mensaje_id) DEFERRABLE INITIALLY DEFERRED,
  indice_en_mensaje   INTEGER NOT NULL CHECK (indice_en_mensaje BETWEEN 0 AND 39),
  confirmacion_msg_id TEXT,
  estado              TEXT    NOT NULL CHECK (estado IN ('pendiente','vigente','borrado','descartado')),
  creado_en           TEXT    NOT NULL,
  actualizado_en      TEXT    NOT NULL,
  origen              TEXT    NOT NULL DEFAULT 'texto' CHECK (origen IN ('texto','imagen')),
  descripcion         TEXT,
  cantidad            TEXT,
  ticket_id           INTEGER REFERENCES tickets (id),
  UNIQUE (mensaje_origen_id, indice_en_mensaje)
);
INSERT INTO movimientos_v2 (id, tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
  indice_en_mensaje, confirmacion_msg_id, estado, creado_en, actualizado_en)
SELECT id, tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
  indice_en_mensaje, confirmacion_msg_id, estado, creado_en, actualizado_en FROM movimientos;
DROP TABLE movimientos;
ALTER TABLE movimientos_v2 RENAME TO movimientos;
CREATE INDEX movimientos_estado_fecha ON movimientos (estado, fecha);
CREATE INDEX movimientos_confirmacion ON movimientos (confirmacion_msg_id);
CREATE INDEX movimientos_ticket ON movimientos (ticket_id);

CREATE TABLE cambios_v2 (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  movimiento_id  INTEGER NOT NULL REFERENCES movimientos (id),
  accion         TEXT    NOT NULL CHECK (accion IN ('corregir','borrar','descartar','confirmar','borrar_ticket')),
  campo          TEXT    CHECK (campo IS NULL OR campo IN ('monto_centavos','categoria','fecha')),
  valor_anterior TEXT,
  valor_nuevo    TEXT,
  mensaje_id     TEXT    NOT NULL,
  creado_en      TEXT    NOT NULL
);
INSERT INTO cambios_v2 SELECT id, movimiento_id, accion, campo, valor_anterior, valor_nuevo, mensaje_id, creado_en FROM cambios;
DROP TABLE cambios;
ALTER TABLE cambios_v2 RENAME TO cambios;

CREATE TABLE categorias (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo   TEXT    NOT NULL CHECK (tipo IN ('gasto','ingreso')),
  nombre TEXT    NOT NULL COLLATE NOCASE,
  emoji  TEXT    NOT NULL,
  activa INTEGER NOT NULL DEFAULT 1 CHECK (activa IN (0, 1)),
  orden  INTEGER NOT NULL,
  UNIQUE (tipo, nombre)
);

CREATE TABLE espera (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  tipo       TEXT    NOT NULL CHECK (tipo IN ('config_categorias_gasto','config_umbral','config_categorias_ingreso',
                                              'ticket_fecha','ticket_confirmacion','borrar_ticket','registro_pendiente')),
  referencia TEXT,
  creado_en  TEXT    NOT NULL
);
`;

/** Aplica las migraciones pendientes (hasta la versión `hasta`) y registra `primer_arranque` una vez. */
export function migrar(db: DatabaseSync, ahora: Date, hasta: number = VERSION_ESQUEMA): void {
  const existe = db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'estado'`).get();
  if (!existe) {
    enTransaccion(db, () => {
      db.exec(MIGRACION_V1);
      db.prepare(`INSERT INTO estado (clave, valor) VALUES ('version_esquema', '1')`).run();
    });
  }
  db.prepare(`INSERT OR IGNORE INTO estado (clave, valor) VALUES ('primer_arranque', ?)`).run(ahora.toISOString());

  if (hasta >= 2 && versionActual(db) < 2) migrarAV2(db, ahora);
}

function versionActual(db: DatabaseSync): number {
  const fila = db.prepare(`SELECT valor FROM estado WHERE clave = 'version_esquema'`).get() as { valor: string } | undefined;
  return Number(fila?.valor ?? 0);
}

function enTransaccion(db: DatabaseSync, fn: () => void): void {
  db.exec('BEGIN');
  try {
    fn();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/**
 * v1 → v2 (data-model.md de la 002). SQLite no permite cambiar un CHECK: las tablas se
 * reconstruyen (crear nueva, copiar, borrar la vieja, renombrar) con las llaves foráneas
 * desactivadas y se verifican al final.
 */
function migrarAV2(db: DatabaseSync, ahora: Date): void {
  db.exec('PRAGMA foreign_keys = OFF');
  try {
    enTransaccion(db, () => {
      db.exec(MIGRACION_V2);
      const insertar = db.prepare('INSERT INTO categorias (tipo, nombre, emoji, activa, orden) VALUES (?, ?, ?, 1, ?)');
      for (const tipo of ['gasto', 'ingreso'] as const) {
        PREDETERMINADAS[tipo].forEach((c, orden) => insertar.run(tipo, c.nombre, c.emoji, orden));
      }
      db.prepare(`INSERT OR IGNORE INTO estado (clave, valor) VALUES ('umbral_centavos', ?)`).run(
        String(UMBRAL_CONFIRMACION_CENTAVOS),
      );
      db.prepare(`INSERT OR IGNORE INTO estado (clave, valor) VALUES ('configuracion', 'pendiente')`).run();
      // El pendiente de la 001 (como mucho uno) pasa a ser la espera activa.
      db.prepare(
        `INSERT OR IGNORE INTO espera (id, tipo, referencia, creado_en)
         SELECT 1, 'registro_pendiente', mensaje_origen_id, ? FROM movimientos
         WHERE estado = 'pendiente' ORDER BY id DESC LIMIT 1`,
      ).run(ahora.toISOString());
      const errores = db.prepare('PRAGMA foreign_key_check').all();
      if (errores.length > 0) throw new Error(`La migración v2 dejó ${errores.length} llaves foráneas rotas`);
      db.prepare(`UPDATE estado SET valor = '2' WHERE clave = 'version_esquema'`).run();
    });
  } finally {
    db.exec('PRAGMA foreign_keys = ON');
  }
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
