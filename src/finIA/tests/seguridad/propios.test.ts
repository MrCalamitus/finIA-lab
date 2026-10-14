// SC-007 y FR-014: el asistente nunca responde a sus propios mensajes, ni siquiera tras reiniciar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, GRUPO } from '../dobles/fabrica.ts';
import { crearManejador } from '../../src/manejador.ts';

/** Intérprete que registra "gasté N" como gasto de N en Otros. */
const programa = (texto: string) => {
  const monto = /gasté (\d+)/.exec(texto)?.[1];
  return monto
    ? { accion: 'registrar', movimientos: [{ tipo: 'gasto', monto_texto: monto, categoria: 'Otros', fecha: '2026-10-13' }] }
    : { accion: 'no_entendido' };
};

test('SC-007: 50 interacciones con eco de WhatsApp producen exactamente 50 respuestas', async () => {
  const e = crearEntorno({ programa });
  e.canal.alEco = (eco) => e.manejador.recibir(eco);
  for (let i = 1; i <= 50; i++) {
    e.manejador.recibir(e.mensaje(`gasté ${i}`));
  }
  await e.manejador.ocioso();
  assert.equal(e.canal.enviados.length, 50);
  assert.equal(e.interprete.llamadas.length, 50);
  assert.ok(e.interprete.llamadas.every((t) => t.startsWith('gasté ')), 'el intérprete nunca vio una respuesta propia');
  assert.equal(e.filas('SELECT 1 FROM movimientos').length, 50);
});

test('tras reiniciar, las respuestas anteriores siguen sin procesarse', async () => {
  const e = crearEntorno({ programa });
  for (let i = 1; i <= 5; i++) await e.escribir(`gasté ${i}`);
  const respuestasPrevias = [...e.canal.enviados];

  // Nuevo manejador sobre la misma base, como tras reiniciar el proceso.
  const reiniciado = crearManejador({
    repo: e.repo,
    interprete: e.interprete,
    canal: e.canal,
    grupoJid: GRUPO,
    reloj: e.reloj,
    reintentos: { intentos: 1, esperaMs: 0 },
  });
  for (const r of respuestasPrevias) {
    reiniciado.recibir({ id: r.id, remoteJid: GRUPO, fromMe: true, texto: r.texto, citadoId: null, enviadoEn: e.reloj() });
  }
  await reiniciado.ocioso();
  assert.equal(e.canal.enviados.length, 5);
  assert.equal(e.interprete.llamadas.length, 5);
});
