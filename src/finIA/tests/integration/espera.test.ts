// Una sola espera activa (research R7). El pendiente de la 001 vive ahora como espera.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov } from '../dobles/fabrica.ts';

const programa = {
  'me pagaron 75,000 de bono': { accion: 'registrar', movimientos: [mov('ingreso', '75,000', 'Salario')] },
  'me pagaron 80,000 de otro bono': { accion: 'registrar', movimientos: [mov('ingreso', '80,000', 'Salario')] },
};

test('un registro pendiente crea la espera registro_pendiente', async () => {
  const e = crearEntorno({ programa });
  await e.escribir('me pagaron 75,000 de bono');
  assert.deepEqual(e.repo.espera(), { tipo: 'registro_pendiente', referencia: `${e.mensaje(null).remoteJid}:usr-1` });
});

test('"sí" resuelve la espera y la elimina', async () => {
  const e = crearEntorno({ programa });
  await e.escribir('me pagaron 75,000 de bono');
  await e.escribir('sí');
  assert.equal(e.repo.espera(), null);
  assert.deepEqual(e.filas(`SELECT estado FROM movimientos`), [{ estado: 'vigente' }]);
});

test('otro mensaje cancela la espera con aviso y sigue el flujo', async () => {
  const e = crearEntorno({ programa });
  await e.escribir('me pagaron 75,000 de bono');
  const respuestas = await e.escribir('me pagaron 80,000 de otro bono');
  assert.equal(respuestas.length, 2, 'aviso del descarte + pregunta nueva');
  assert.deepEqual(e.repo.espera(), { tipo: 'registro_pendiente', referencia: `${e.mensaje(null).remoteJid}:usr-2` });
  assert.deepEqual(e.filas(`SELECT estado FROM movimientos ORDER BY id`), [{ estado: 'descartado' }, { estado: 'pendiente' }]);
});

test('crear una espera reemplaza la anterior y la devuelve', () => {
  const e = crearEntorno();
  assert.equal(e.repo.crearEspera('ticket_fecha', '1'), null);
  assert.deepEqual(e.repo.crearEspera('config_umbral', null), { tipo: 'ticket_fecha', referencia: '1' });
  assert.deepEqual(e.repo.espera(), { tipo: 'config_umbral', referencia: null });
  assert.equal(e.filas('SELECT 1 FROM espera').length, 1);
  e.repo.cancelarEspera();
  assert.equal(e.repo.espera(), null);
});
