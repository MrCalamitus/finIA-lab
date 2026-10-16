// Acceso a datos. Solo consultas parametrizadas. Nunca se borran filas de movimientos:
// borrar = cambiar su estado (borrado lógico).
import type { DatabaseSync } from 'node:sqlite';

export type Resultado =
  | 'registrado'
  | 'pendiente'
  | 'consulta'
  | 'resumen'
  | 'correccion'
  | 'borrado'
  | 'confirmado'
  | 'rechazado'
  | 'ignorado_antiguo';

export type Tipo = 'gasto' | 'ingreso';
export type Estado = 'pendiente' | 'vigente' | 'borrado' | 'descartado';

export interface Movimiento {
  id: number;
  tipo: Tipo;
  monto_centavos: number;
  categoria: string;
  fecha: string;
  texto_original: string;
  mensaje_origen_id: string;
  indice_en_mensaje: number;
  confirmacion_msg_id: string | null;
  estado: Estado;
  creado_en: string;
  actualizado_en: string;
}

export interface NuevoMovimiento {
  tipo: Tipo;
  montoCentavos: number;
  categoria: string;
  fecha: string;
}

export function crearRepositorio(db: DatabaseSync) {
  const ahora = () => new Date().toISOString();
  let enTransaccion = false;

  const repo = {
    /** Ejecuta `fn` en una transacción. Si lanza, se revierte todo. No admite anidamiento. */
    transaccion<T>(fn: () => T): T {
      if (enTransaccion) return fn();
      db.exec('BEGIN IMMEDIATE');
      enTransaccion = true;
      try {
        const valor = fn();
        db.exec('COMMIT');
        return valor;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        enTransaccion = false;
      }
    },

    yaProcesado(mensajeId: string): boolean {
      return db.prepare('SELECT 1 FROM mensajes_procesados WHERE mensaje_id = ?').get(mensajeId) !== undefined;
    },

    marcarProcesado(mensajeId: string, enviadoEn: Date, resultado: Resultado): void {
      db.prepare(
        'INSERT INTO mensajes_procesados (mensaje_id, enviado_en, resultado, procesado_en) VALUES (?, ?, ?, ?)',
      ).run(mensajeId, enviadoEn.toISOString(), resultado, ahora());
    },

    esEnviado(mensajeId: string): boolean {
      return db.prepare('SELECT 1 FROM mensajes_enviados WHERE mensaje_id = ?').get(mensajeId) !== undefined;
    },

    guardarEnviado(mensajeId: string): void {
      db.prepare('INSERT OR IGNORE INTO mensajes_enviados (mensaje_id, enviado_en) VALUES (?, ?)').run(
        mensajeId,
        ahora(),
      );
    },

    leerEstado(clave: string): string | null {
      const fila = db.prepare('SELECT valor FROM estado WHERE clave = ?').get(clave) as { valor: string } | undefined;
      return fila?.valor ?? null;
    },

    primerArranque(): Date {
      const valor = repo.leerEstado('primer_arranque');
      if (!valor) throw new Error('La base no tiene primer_arranque; ¿se migró?');
      return new Date(valor);
    },

    // --- Consultas (US2) ---

    /** Suma y cuenta en SQL, con enteros, solo sobre movimientos vigentes (FR-009, SC-003). */
    totales(filtro: { tipo: Tipo; desde: string; hasta: string; categoria?: string | null }): {
      centavos: number;
      cantidad: number;
    } {
      const fila = db
        .prepare(
          `SELECT COALESCE(SUM(monto_centavos), 0) AS centavos, COUNT(*) AS cantidad
           FROM movimientos
           WHERE estado = 'vigente' AND tipo = ? AND fecha BETWEEN ? AND ?
             AND (? IS NULL OR categoria = ?)`,
        )
        .get(filtro.tipo, filtro.desde, filtro.hasta, filtro.categoria ?? null, filtro.categoria ?? null) as {
        centavos: number;
        cantidad: number;
      };
      return { centavos: fila.centavos, cantidad: fila.cantidad };
    },

    // --- Resumen (US4) ---

    /** Ingresos, gastos y gasto por categoría (de mayor a menor) sobre movimientos vigentes. */
    resumen(rango: { desde: string; hasta: string }): {
      ingresos: number;
      gastos: number;
      cantidad: number;
      porCategoria: { categoria: string; centavos: number }[];
    } {
      const ingresos = repo.totales({ tipo: 'ingreso', ...rango });
      const gastos = repo.totales({ tipo: 'gasto', ...rango });
      const porCategoria = db
        .prepare(
          `SELECT categoria, SUM(monto_centavos) AS centavos
           FROM movimientos
           WHERE estado = 'vigente' AND tipo = 'gasto' AND fecha BETWEEN ? AND ?
           GROUP BY categoria
           ORDER BY centavos DESC, categoria`,
        )
        .all(rango.desde, rango.hasta)
        .map((f) => ({ ...(f as { categoria: string; centavos: number }) }));
      return {
        ingresos: ingresos.centavos,
        gastos: gastos.centavos,
        cantidad: ingresos.cantidad + gastos.cantidad,
        porCategoria,
      };
    },

    // --- Corrección y borrado (US3) ---

    movimientosPorConfirmacion(confirmacionMsgId: string): Movimiento[] {
      return db
        .prepare('SELECT * FROM movimientos WHERE confirmacion_msg_id = ? ORDER BY indice_en_mensaje')
        .all(confirmacionMsgId) as unknown as Movimiento[];
    },

    ultimoVigente(): Movimiento | null {
      const fila = db.prepare(`SELECT * FROM movimientos WHERE estado = 'vigente' ORDER BY id DESC LIMIT 1`).get();
      return (fila as unknown as Movimiento | undefined) ?? null;
    },

    /** Cambia un campo de un movimiento vigente y registra el antes y el después. */
    actualizarCampo(
      id: number,
      campo: 'monto_centavos' | 'categoria' | 'fecha',
      valor: string | number,
      mensajeId: string,
    ): { anterior: string | number; nuevo: string | number } {
      const actual = db.prepare(`SELECT * FROM movimientos WHERE id = ? AND estado = 'vigente'`).get(id) as
        | Record<string, string | number>
        | undefined;
      if (!actual) throw new Error(`El movimiento ${id} no está vigente`);
      const marca = ahora();
      // `campo` viene de una unión cerrada, nunca de texto del usuario.
      db.prepare(`UPDATE movimientos SET ${campo} = ?, actualizado_en = ? WHERE id = ?`).run(valor, marca, id);
      db.prepare(
        `INSERT INTO cambios (movimiento_id, accion, campo, valor_anterior, valor_nuevo, mensaje_id, creado_en)
         VALUES (?, 'corregir', ?, ?, ?, ?, ?)`,
      ).run(id, campo, String(actual[campo]), String(valor), mensajeId, marca);
      return { anterior: actual[campo]!, nuevo: valor };
    },

    /** Borrado lógico de un movimiento vigente. */
    marcarBorrado(id: number, mensajeId: string): void {
      const marca = ahora();
      const r = db
        .prepare(`UPDATE movimientos SET estado = 'borrado', actualizado_en = ? WHERE id = ? AND estado = 'vigente'`)
        .run(marca, id);
      if (r.changes !== 1) throw new Error(`El movimiento ${id} no está vigente`);
      db.prepare(
        `INSERT INTO cambios (movimiento_id, accion, valor_anterior, valor_nuevo, mensaje_id, creado_en)
         VALUES (?, 'borrar', 'vigente', 'borrado', ?, ?)`,
      ).run(id, mensajeId, marca);
    },

    // --- Movimientos (US1) ---

    /** Todos los movimientos, en cualquier estado (para auditoría y evaluación). */
    movimientosEnTodosLosEstados(): Movimiento[] {
      return db.prepare('SELECT * FROM movimientos ORDER BY id').all() as unknown as Movimiento[];
    },

    movimientosDeMensaje(mensajeOrigenId: string): Movimiento[] {
      return db
        .prepare('SELECT * FROM movimientos WHERE mensaje_origen_id = ? ORDER BY indice_en_mensaje')
        .all(mensajeOrigenId) as unknown as Movimiento[];
    },

    /** Inserta los movimientos de un mensaje con índices 0..n-1. Devuelve sus ids. */
    insertarMovimientos(
      mensajeOrigenId: string,
      textoOriginal: string,
      movimientos: NuevoMovimiento[],
      estado: 'vigente' | 'pendiente',
    ): number[] {
      const insertar = db.prepare(
        `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
           indice_en_mensaje, estado, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      const marca = ahora();
      return movimientos.map((m, indice) => {
        const r = insertar.run(m.tipo, m.montoCentavos, m.categoria, m.fecha, textoOriginal, mensajeOrigenId, indice, estado, marca, marca);
        return Number(r.lastInsertRowid);
      });
    },

    asignarConfirmacion(ids: number[], confirmacionMsgId: string): void {
      const actualizar = db.prepare('UPDATE movimientos SET confirmacion_msg_id = ? WHERE id = ?');
      for (const id of ids) actualizar.run(confirmacionMsgId, id);
    },

    /** Movimientos pendientes de confirmar, agrupados por su mensaje (como mucho uno a la vez). */
    pendienteActual(): { mensajeOrigenId: string; movimientos: Movimiento[] } | null {
      const fila = db
        .prepare(`SELECT mensaje_origen_id FROM movimientos WHERE estado = 'pendiente' ORDER BY id DESC LIMIT 1`)
        .get() as { mensaje_origen_id: string } | undefined;
      if (!fila) return null;
      const movimientos = repo.movimientosDeMensaje(fila.mensaje_origen_id).filter((m) => m.estado === 'pendiente');
      return { mensajeOrigenId: fila.mensaje_origen_id, movimientos };
    },

    /** Pasa a `nuevoEstado` todos los pendientes y registra el cambio. Devuelve los movimientos. */
    resolverPendientes(nuevoEstado: 'vigente' | 'descartado', mensajeCambioId: string): Movimiento[] {
      const pendientes = db
        .prepare(`SELECT * FROM movimientos WHERE estado = 'pendiente' ORDER BY id`)
        .all() as unknown as Movimiento[];
      const marca = ahora();
      const actualizar = db.prepare(
        `UPDATE movimientos SET estado = ?, actualizado_en = ? WHERE id = ? AND estado = 'pendiente'`,
      );
      const registrar = db.prepare(
        `INSERT INTO cambios (movimiento_id, accion, valor_anterior, valor_nuevo, mensaje_id, creado_en)
         VALUES (?, ?, 'pendiente', ?, ?, ?)`,
      );
      for (const m of pendientes) {
        actualizar.run(nuevoEstado, marca, m.id);
        registrar.run(m.id, nuevoEstado === 'vigente' ? 'confirmar' : 'descartar', nuevoEstado, mensajeCambioId, marca);
      }
      return pendientes.map((m) => ({ ...m, estado: nuevoEstado, actualizado_en: marca }));
    },
  };
  return repo;
}

export type Repositorio = ReturnType<typeof crearRepositorio>;
