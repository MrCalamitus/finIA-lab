// FR-020 y FR-003: mensajes enviados mientras el asistente estaba apagado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AHORA, crearEntorno, mov } from '../dobles/fabrica.ts';

const HORA = 60 * 60 * 1000;
const hace = (horas: number) => new Date(AHORA.getTime() - horas * HORA);

/** Entorno instalado hace 10 días y "encendido" de nuevo en AHORA. */
function entornoReencendido(programa: Record<string, unknown> = {}) {
  const e = crearEntorno({ programa, ahora: hace(240) });
  e.fijarAhora(AHORA);
  return e;
}

test('un mensaje de hace 2 h se registra con su fecha de envío', async () => {
  // Enviado el lunes 12 a las 23:00; procesado el martes 13 a las 01:00.
  const enviado = new Date(2026, 9, 12, 23, 0, 0);
  const e = crearEntorno({
    programa: { 'gasté 30 en café': { accion: 'registrar', movimientos: [mov('gasto', '30', 'Comida', '2026-10-12')] } },
    ahora: hace(240),
  });
  e.fijarAhora(new Date(2026, 9, 13, 1, 0, 0));
  assert.deepEqual(await e.escribir('gasté 30 en café', { enviadoEn: enviado }), [
    'Registrado: gasto de $30.00 · Comida · ayer',
  ]);
  const [fila] = e.filas<{ fecha: string }>('SELECT fecha FROM movimientos');
  assert.equal(fila?.fecha, '2026-10-12');
  const [procesado] = e.filas<{ enviado_en: string }>('SELECT enviado_en FROM mensajes_procesados');
  assert.equal(procesado?.enviado_en, enviado.toISOString());
});

test('la fecha de envío se pasa al intérprete como referencia', async () => {
  const referencias: Date[] = [];
  const e2 = crearEntorno({
    ahora: hace(240),
    programa: (_texto: string, fecha: Date) => {
      referencias.push(fecha);
      return { accion: 'no_entendido' };
    },
  });
  e2.fijarAhora(AHORA);
  await e2.escribir('hola', { enviadoEn: hace(2) });
  assert.equal(referencias[0]?.getTime(), hace(2).getTime());
});

test('mensajes de más de 24 h se ignoran y se avisa una sola vez al vaciarse la cola', async () => {
  const e = entornoReencendido({ 'gasté 10': { accion: 'registrar', movimientos: [mov('gasto', '10', 'Otros')] } });
  e.manejador.recibir(e.mensaje('gasté 1', { enviadoEn: hace(30) }));
  e.manejador.recibir(e.mensaje('gasté 2', { enviadoEn: hace(48) }));
  e.manejador.recibir(e.mensaje('gasté 3', { enviadoEn: hace(25) }));
  e.manejador.recibir(e.mensaje('gasté 10', { enviadoEn: hace(1) }));
  await e.manejador.ocioso();
  assert.deepEqual(
    e.canal.enviados.map((m) => m.texto),
    [
      'Registrado: gasto de $10.00 · Otros · hoy',
      'Estuve apagado. Ignoré 3 mensajes de hace más de 24 h; reenvíalos si quieres registrarlos.',
    ],
  );
  assert.equal(e.interprete.llamadas.length, 1);
  const ignorados = e.filas(`SELECT 1 FROM mensajes_procesados WHERE resultado = 'ignorado_antiguo'`);
  assert.equal(ignorados.length, 3);
});

test('el aviso usa singular con un solo mensaje', async () => {
  const e = entornoReencendido();
  assert.deepEqual(await e.escribir('gasté 1', { enviadoEn: hace(30) }), [
    'Estuve apagado. Ignoré 1 mensaje de hace más de 24 h; reenvíalo si quieres registrarlo.',
  ]);
});

test('un mensaje anterior al primer arranque se ignora sin aviso', async () => {
  const e = crearEntorno();
  assert.deepEqual(await e.escribir('gasté 1', { enviadoEn: hace(1) }), []);
  assert.equal(e.interprete.llamadas.length, 0);
});

test('un mensaje antiguo ya ignorado no se vuelve a contar', async () => {
  const e = entornoReencendido();
  const viejo = e.mensaje('gasté 1', { enviadoEn: hace(30) });
  await e.entregar(viejo);
  assert.deepEqual(await e.entregar(viejo), []);
});
