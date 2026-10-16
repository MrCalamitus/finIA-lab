// FR-018d: posibles repetidos (research R6 de la 002).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { esPosibleRepetido, normalizar, primeraPalabraSignificativa } from '../../src/dominio/repetidos.ts';

const mov = (cambios: Record<string, unknown>) => ({
  fecha: '2026-10-12',
  monto_centavos: 2850,
  estado: 'vigente' as const,
  origen: 'texto' as const,
  descripcion: null,
  texto_original: 'gasté 28.50 en leche',
  ...cambios,
});

test('normalizar quita mayúsculas, acentos, espacios y símbolos', () => {
  assert.equal(normalizar('LECHE ENTERA 1L'), 'lecheentera1l');
  assert.equal(normalizar('Leche entera 1 l'), 'lecheentera1l');
  assert.equal(normalizar('Plátano, Ñame'), 'platanoname');
});

test('primeraPalabraSignificativa ignora unidades y palabras cortas', () => {
  assert.equal(primeraPalabraSignificativa('LECHE ENTERA 1L'), 'leche');
  assert.equal(primeraPalabraSignificativa('3 PZ PAN DULCE'), 'pan');
  assert.equal(primeraPalabraSignificativa('2 x KG manzana'), 'manzana');
  assert.equal(primeraPalabraSignificativa('1 l'), null);
});

test('ticket contra ticket: descripción equivalente, misma fecha y monto', () => {
  const art = { descripcion: 'LECHE ENTERA 1L', centavos: 2850, fecha: '2026-10-12' };
  const desdeTicket = mov({ origen: 'imagen', descripcion: 'Leche entera 1 l', texto_original: '[ticket]' });
  assert.equal(esPosibleRepetido(art, desdeTicket), true);
  assert.equal(esPosibleRepetido(art, { ...desdeTicket, descripcion: 'Leche' }), true, 'una contiene a la otra');
  assert.equal(esPosibleRepetido(art, { ...desdeTicket, monto_centavos: 2851 }), false);
  assert.equal(esPosibleRepetido(art, { ...desdeTicket, fecha: '2026-10-11' }), false);
  assert.equal(esPosibleRepetido(art, { ...desdeTicket, descripcion: 'Pan blanco' }), false);
  assert.equal(esPosibleRepetido(art, { ...desdeTicket, estado: 'borrado' as never }), false);
});

test('ticket contra gasto por texto: primera palabra significativa en el texto original', () => {
  const art = { descripcion: 'LECHE ENTERA 1L', centavos: 2850, fecha: '2026-10-12' };
  assert.equal(esPosibleRepetido(art, mov({})), true);
  assert.equal(esPosibleRepetido({ ...art, descripcion: 'PAN 3 PZ', centavos: 1500 }, mov({ monto_centavos: 1500, texto_original: 'gasté 15 en tacos' })), false);
  assert.equal(esPosibleRepetido(art, mov({ texto_original: 'gasté 28.50 en LÉCHE' })), true);
});
