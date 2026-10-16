// FR-010 y SC-003: ninguna respuesta deja símbolos de formato sueltos. Recorre una conversación
// que produce cada tipo de respuesta y revisa cada mensaje enviado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, mov, AHORA, salidaTicket } from '../dobles/fabrica.ts';

/** Quita los bloques monoespaciados (dentro no se interpreta formato). */
const sinBloques = (texto: string) => texto.replace(/```[\s\S]*?```/g, '');

function revisarFormato(texto: string) {
  assert.equal((texto.match(/```/g) ?? []).length % 2, 0, `bloque sin cerrar: ${texto}`);
  const fuera = sinBloques(texto);
  assert.equal((fuera.match(/\*/g) ?? []).length % 2, 0, `asterisco suelto: ${texto}`);
  assert.equal((fuera.match(/_/g) ?? []).length % 2, 0, `guion bajo suelto: ${texto}`);
  for (const [, contenido] of fuera.matchAll(/\*([^*]*)\*/g)) {
    assert.ok(contenido!.length > 0 && contenido!.trim() === contenido, `negrita vacía o con espacios: ${texto}`);
  }
  for (const monto of fuera.match(/-?\$[\d,]+\.\d{2}/g) ?? []) {
    assert.ok(fuera.includes(`*${monto}*`) || fuera.includes(`${monto} →`), `monto sin negrita: ${monto} en ${texto}`);
  }
}

test('SC-003: todas las respuestas tienen formato de WhatsApp válido', async () => {
  const e = crearEntorno({
    programa: {
      'gasté 180 en tacos': { accion: 'registrar', movimientos: [mov('gasto', '180', 'Comida')] },
      'gasté 50 en café y 200 en gasolina': {
        accion: 'registrar',
        movimientos: [mov('gasto', '50', 'Comida'), mov('gasto', '200', 'Transporte')],
      },
      'me pagaron 75,000': { accion: 'registrar', movimientos: [mov('ingreso', '75,000', 'Salario')] },
      'gasté 1 en *chicle*': { accion: 'registrar', movimientos: [mov('gasto', '1', 'Comida'), mov('gasto', 'mucho', 'Comida')] },
      '¿cuánto en comida?': { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes', categoria: 'Comida' } },
      '¿cuánto en salud?': { accion: 'consultar', consulta: { tipo: 'gasto', periodo: 'mes', categoria: 'Salud' } },
      '¿cómo voy?': { accion: 'consultar', consulta: { tipo: 'ambos', periodo: 'mes' } },
      resumen: { accion: 'resumen' },
      'era 150': { accion: 'corregir', correccion: { campo: 'monto', nuevo_valor: '150' } },
      'a transporte': { accion: 'corregir', correccion: { campo: 'categoria', nuevo_valor: 'Transporte' } },
      'era Salario': { accion: 'corregir', correccion: { campo: 'categoria', nuevo_valor: 'Salario' } },
      'era 60,000': { accion: 'corregir', correccion: { campo: 'monto', nuevo_valor: '60,000' } },
      'bórralo': { accion: 'borrar' },
    },
  });
  e.sembrar([{ tipo: 'gasto', centavos: 5_000, categoria: 'Ro*pa_' }]);
  const textos = [
    'gasté 180 en tacos', 'gasté 50 en café y 200 en gasolina', 'me pagaron 75,000', 'no',
    'gasté 1 en *chicle*', '¿cuánto en comida?', '¿cuánto en salud?', '¿cómo voy?', 'resumen',
    'era 150', 'a transporte', 'era Salario', 'era 60,000', 'bórralo', 'hola', 'a'.repeat(501),
  ];
  for (const texto of textos) await e.escribir(texto);
  e.interprete.noDisponible = true;
  await e.escribir('gasté 5');
  e.interprete.noDisponible = false;
  await e.escribir('gasté 1', { enviadoEn: new Date(AHORA.getTime() - 30 * 3_600_000) });

  assert.ok(e.canal.enviados.length >= textos.length);
  for (const { texto } of e.canal.enviados) revisarFormato(texto);
});

test('el resumen alinea los montos en un bloque monoespaciado y colorea el balance', async () => {
  const e = crearEntorno({ programa: { resumen: { accion: 'resumen' } } });
  e.sembrar([
    { tipo: 'gasto', centavos: 234_000, categoria: 'Comida' },
    { tipo: 'gasto', centavos: 60_000, categoria: 'Transporte' },
  ]);
  const [respuesta] = await e.escribir('resumen');
  assert.match(respuesta!, /🔴 Balance: \*-\$2,940\.00\*/);
  assert.match(respuesta!, /```Comida      \$2,340\.00\nTransporte    \$600\.00```/);
});

test('SC-003: las propuestas con IVA o descuento general también tienen formato válido', async () => {
  const e = crearEntorno();
  const propuestas = [
    salidaTicket([['MAGNA', '259.64', 'Transporte', '12.51']], '300.00', { subtotal_texto: '259.64', impuesto_texto: '40.36' }),
    salidaTicket([['A*', '60.00'], ['B_', '40.00']], '110.00', { subtotal_texto: '100.00', impuesto_texto: '16.00', descuento_general_texto: '6.00' }),
  ];
  for (const p of propuestas) {
    e.interprete.programarTicket(p);
    await e.escribir(null, { foto: true });
    await e.escribir('sí');
  }
  for (const { texto } of e.canal.enviados) revisarFormato(texto);
});
