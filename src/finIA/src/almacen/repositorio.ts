// Acceso a datos. Solo consultas parametrizadas. Nunca se borran filas de movimientos:
// borrar = cambiar su estado (borrado lógico).
import type { DatabaseSync } from 'node:sqlite';
import { emojiPredeterminado } from '../dominio/categorias.ts';

export type Resultado =
  | 'registrado'
  | 'pendiente'
  | 'consulta'
  | 'resumen'
  | 'correccion'
  | 'borrado'
  | 'confirmado'
  | 'rechazado'
  | 'ignorado_antiguo'
  | 'configuracion'
  | 'ticket_esperando_fecha'
  | 'ticket_propuesto'
  | 'ticket_guardado'
  | 'ticket_descartado'
  | 'ticket_borrado'
  | 'imagen_rechazada';

export type TipoEspera =
  | 'config_categorias_gasto'
  | 'config_umbral'
  | 'config_categorias_ingreso'
  | 'ticket_fecha'
  | 'ticket_confirmacion'
  | 'borrar_ticket'
  | 'registro_pendiente';

export interface Espera {
  tipo: TipoEspera;
  referencia: string | null;
}

export type EstadoConfiguracion = 'pendiente' | 'pausada' | 'completa';

export interface Categoria {
  nombre: string;
  emoji: string;
  activa: boolean;
}

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
  origen: 'texto' | 'imagen';
  descripcion: string | null;
  cantidad: string | null;
  ticket_id: number | null;
}

export interface NuevoMovimiento {
  tipo: Tipo;
  montoCentavos: number;
  categoria: string;
  fecha: string;
}

export type EstadoTicket = 'esperando_fecha' | 'pendiente' | 'guardado' | 'descartado' | 'borrado';

export interface Ticket {
  id: number;
  mensaje_origen_id: string;
  comercio: string | null;
  fecha: string | null;
  origen_fecha: 'texto' | 'ticket' | null;
  total_centavos: number;
  /** JSON de la propuesta; se valida al leerlo (acciones/ticket.ts). */
  propuesta: string;
  texto_foto: string | null;
  estado: EstadoTicket;
  confirmacion_msg_id: string | null;
}

export interface NuevoTicket {
  mensajeOrigenId: string;
  comercio: string | null;
  fecha: string | null;
  origenFecha: 'texto' | 'ticket' | null;
  totalCentavos: number;
  propuesta: string;
  textoFoto: string | null;
  estado: EstadoTicket;
}

export interface CambiosTicket {
  fecha?: string | null;
  origen_fecha?: 'texto' | 'ticket' | null;
  estado?: EstadoTicket;
  propuesta?: string;
  confirmacion_msg_id?: string | null;
}

const COLUMNAS_TICKET = new Set(['fecha', 'origen_fecha', 'estado', 'propuesta', 'confirmacion_msg_id']);

export interface ArticuloGuardado {
  descripcion: string;
  cantidad: string | null;
  centavos: number;
  categoria: string;
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

    resultadoDe(mensajeId: string): Resultado | null {
      const fila = db.prepare('SELECT resultado FROM mensajes_procesados WHERE mensaje_id = ?').get(mensajeId) as
        | { resultado: Resultado }
        | undefined;
      return fila?.resultado ?? null;
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

    // --- Configuración, categorías y espera (002) ---

    categorias(tipo: Tipo, opciones: { soloActivas?: boolean } = {}): Categoria[] {
      const filas = db
        .prepare(
          `SELECT nombre, emoji, activa FROM categorias
           WHERE tipo = ? AND (? = 0 OR activa = 1) ORDER BY activa DESC, orden`,
        )
        .all(tipo, opciones.soloActivas ? 1 : 0) as { nombre: string; emoji: string; activa: number }[];
      return filas.map((f) => ({ nombre: f.nombre, emoji: f.emoji, activa: f.activa === 1 }));
    },

    /** Emoji de una categoría (activa o no); el genérico si no existe. */
    emojiDeCategoria(nombre: string, tipo: Tipo): string {
      const fila = db.prepare('SELECT emoji FROM categorias WHERE tipo = ? AND nombre = ?').get(tipo, nombre) as
        | { emoji: string }
        | undefined;
      return fila?.emoji ?? '🏷️';
    },

    /**
     * Deja activas exactamente `nombres` (en ese orden) para el tipo: desactiva las demás, reactiva
     * las que ya existían e inserta las nuevas. Nunca borra filas (FR-006b). Devuelve las activas de
     * antes, para mostrar "antes → ahora".
     */
    guardarCategorias(tipo: Tipo, nombres: readonly string[]): string[] {
      const anteriores = repo.categorias(tipo, { soloActivas: true }).map((c) => c.nombre);
      db.prepare('UPDATE categorias SET activa = 0 WHERE tipo = ?').run(tipo);
      const reactivar = db.prepare('UPDATE categorias SET activa = 1, orden = ? WHERE tipo = ? AND nombre = ?');
      const insertar = db.prepare('INSERT INTO categorias (tipo, nombre, emoji, activa, orden) VALUES (?, ?, ?, 1, ?)');
      nombres.forEach((nombre, orden) => {
        if (reactivar.run(orden, tipo, nombre).changes === 0) insertar.run(tipo, nombre, emojiPredeterminado(nombre, tipo), orden);
      });
      return anteriores;
    },

    umbralCentavos(): number {
      return Number(repo.leerEstado('umbral_centavos') ?? 5_000_000);
    },

    fijarUmbral(centavos: number): void {
      db.prepare(`INSERT INTO estado (clave, valor) VALUES ('umbral_centavos', ?)
                  ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`).run(String(centavos));
    },

    estadoConfiguracion(): EstadoConfiguracion {
      return (repo.leerEstado('configuracion') ?? 'pendiente') as EstadoConfiguracion;
    },

    fijarEstadoConfiguracion(valor: EstadoConfiguracion): void {
      db.prepare(`INSERT INTO estado (clave, valor) VALUES ('configuracion', ?)
                  ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor`).run(valor);
    },

    espera(): Espera | null {
      const fila = db.prepare('SELECT tipo, referencia FROM espera WHERE id = 1').get() as Espera | undefined;
      return fila ? { tipo: fila.tipo, referencia: fila.referencia } : null;
    },

    /** Crea la espera activa. Si ya había una, la reemplaza y la devuelve (research R7). */
    crearEspera(tipo: TipoEspera, referencia: string | null): Espera | null {
      const anterior = repo.espera();
      db.prepare(
        `INSERT INTO espera (id, tipo, referencia, creado_en) VALUES (1, ?, ?, ?)
         ON CONFLICT (id) DO UPDATE SET tipo = excluded.tipo, referencia = excluded.referencia,
           creado_en = excluded.creado_en`,
      ).run(tipo, referencia, ahora());
      return anterior;
    },

    cancelarEspera(): void {
      db.prepare('DELETE FROM espera WHERE id = 1').run();
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

    // --- Tickets (002, US3) ---

    crearTicket(t: NuevoTicket): number {
      const marca = ahora();
      const r = db
        .prepare(
          `INSERT INTO tickets (mensaje_origen_id, comercio, fecha, origen_fecha, total_centavos, propuesta,
             texto_foto, estado, creado_en, actualizado_en)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(t.mensajeOrigenId, t.comercio, t.fecha, t.origenFecha, t.totalCentavos, t.propuesta, t.textoFoto, t.estado, marca, marca);
      return Number(r.lastInsertRowid);
    },

    ticket(id: number): Ticket | null {
      return (db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as unknown as Ticket | undefined) ?? null;
    },

    ticketPorConfirmacion(confirmacionMsgId: string): Ticket | null {
      const fila = db.prepare('SELECT * FROM tickets WHERE confirmacion_msg_id = ?').get(confirmacionMsgId);
      return (fila as unknown as Ticket | undefined) ?? null;
    },

    actualizarTicket(id: number, cambios: CambiosTicket): void {
      const columnas = Object.keys(cambios).filter((c) => COLUMNAS_TICKET.has(c));
      if (columnas.length === 0) return;
      // Las columnas vienen de una lista cerrada, nunca de texto del usuario.
      const asignaciones = [...columnas.map((c) => `${c} = ?`), 'actualizado_en = ?'].join(', ');
      const valores = columnas.map((c) => cambios[c as keyof CambiosTicket] ?? null);
      db.prepare(`UPDATE tickets SET ${asignaciones} WHERE id = ?`).run(...valores, ahora(), id);
    },

    /** Inserta los artículos confirmados de un ticket como movimientos vigentes (FR-019). */
    guardarArticulosTicket(ticket: Ticket, articulos: readonly ArticuloGuardado[]): number[] {
      if (!ticket.fecha) throw new Error('El ticket no tiene fecha');
      const insertar = db.prepare(
        `INSERT INTO movimientos (tipo, monto_centavos, categoria, fecha, texto_original, mensaje_origen_id,
           indice_en_mensaje, estado, origen, descripcion, cantidad, ticket_id, creado_en, actualizado_en)
         VALUES ('gasto', ?, ?, ?, ?, ?, ?, 'vigente', 'imagen', ?, ?, ?, ?, ?)`,
      );
      const marca = ahora();
      const texto = ticket.texto_foto ?? '[ticket]';
      return articulos.map((a, indice) => {
        const r = insertar.run(a.centavos, a.categoria, ticket.fecha, texto, ticket.mensaje_origen_id, indice,
          a.descripcion, a.cantidad, ticket.id, marca, marca);
        return Number(r.lastInsertRowid);
      });
    },

    vigentesDeTicket(ticketId: number): Movimiento[] {
      return db
        .prepare(`SELECT * FROM movimientos WHERE ticket_id = ? AND estado = 'vigente' ORDER BY id`)
        .all(ticketId) as unknown as Movimiento[];
    },

    /** FR-020a: borrado lógico de los artículos vigentes de un ticket, con un cambio por artículo. */
    borrarTicket(ticketId: number, mensajeId: string): { cantidad: number; centavos: number } {
      const movimientos = repo.vigentesDeTicket(ticketId);
      const marca = ahora();
      const actualizar = db.prepare(`UPDATE movimientos SET estado = 'borrado', actualizado_en = ? WHERE id = ? AND estado = 'vigente'`);
      const registrar = db.prepare(
        `INSERT INTO cambios (movimiento_id, accion, valor_anterior, valor_nuevo, mensaje_id, creado_en)
         VALUES (?, 'borrar_ticket', 'vigente', 'borrado', ?, ?)`,
      );
      for (const m of movimientos) {
        actualizar.run(marca, m.id);
        registrar.run(m.id, mensajeId, marca);
      }
      repo.actualizarTicket(ticketId, { estado: 'borrado' });
      return { cantidad: movimientos.length, centavos: movimientos.reduce((s, m) => s + m.monto_centavos, 0) };
    },

    movimientosVigentesDeFecha(fecha: string): Movimiento[] {
      return db
        .prepare(`SELECT * FROM movimientos WHERE estado = 'vigente' AND fecha = ? ORDER BY id`)
        .all(fecha) as unknown as Movimiento[];
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
