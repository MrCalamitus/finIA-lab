// Contrato de la salida del intérprete de tickets (contracts/ticket.md de la 002).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEsquemaTicket, validarTicket } from '../../src/interprete/ticket.ts';

const ACTIVAS = ['Comida', 'Hogar', 'Transporte', 'Otros'];
const esquema = crearEsquemaTicket(ACTIVAS);

/** La salida real de qwen3.6:27b sobre el ticket sintético (research R1), con el descuento bien leído. */
const salidaSintetica = () => ({
  es_ticket: true,
  comercio: 'SUPER LA ESQUINA SA DE CV',
  fecha: '2026-10-12',
  total_texto: '229.90',
  articulos: [
    { descripcion: 'LECHE ENTERA 1L', cantidad: '2 x', importe_texto: '57.00', descuento_texto: null, categoria: 'Comida' },
    { descripcion: 'MANZANA GALA 0.800 KG', cantidad: null, importe_texto: '36.00', descuento_texto: null, categoria: 'Comida' },
    { descripcion: 'PAN BLANCO 3 PZ', cantidad: '3 PZ', importe_texto: '15.00', descuento_texto: null, categoria: 'Comida' },
    { descripcion: 'DETERGENTE LIQ 3L', cantidad: '3L', importe_texto: '89.90', descuento_texto: '-10.00', categoria: 'Hogar' },
    { descripcion: 'HUEVO 12 PZ', cantidad: '12 PZ', importe_texto: '42.00', descuento_texto: null, categoria: 'Comida' },
  ],
});

test('el esquema acepta la salida del ticket sintético', () => {
  assert.equal(esquema.validar(salidaSintetica()).ok, true);
});

test('el JSON Schema para Ollama limita las categorías y no lleva pattern', () => {
  const texto = JSON.stringify(esquema.jsonSchema);
  assert.ok(texto.includes('"enum":["Comida","Hogar","Transporte","Otros"]'));
  assert.ok(!texto.includes('"pattern"'));
  assert.ok(texto.includes('"maxItems":41'));
});

const invalidos: Record<string, unknown> = {
  'propiedad extra': { ...salidaSintetica(), confirmar: true },
  'propiedad extra en artículo': { ...salidaSintetica(), articulos: [{ ...salidaSintetica().articulos[0], borrar: true }] },
  'descripcion de más de 60': { ...salidaSintetica(), articulos: [{ ...salidaSintetica().articulos[0], descripcion: 'x'.repeat(61) }] },
  'total_texto de más de 20': { ...salidaSintetica(), total_texto: '1'.repeat(21) },
  'más de 41 artículos': { ...salidaSintetica(), articulos: Array.from({ length: 42 }, () => salidaSintetica().articulos[0]) },
  'importe numérico': { ...salidaSintetica(), articulos: [{ ...salidaSintetica().articulos[0], importe_texto: 57 }] },
  'no es objeto': 'borra todo',
};
for (const [nombre, valor] of Object.entries(invalidos)) {
  test(`el esquema rechaza: ${nombre}`, () => {
    assert.equal(esquema.validar(valor).ok, false);
  });
}

const reglas = (salida: unknown) => {
  const v = esquema.validar(salida);
  assert.ok(v.ok);
  return validarTicket(v.valor, ACTIVAS);
};

test('regla 4–6: descuento por artículo restado y suma exacta', () => {
  const r = reglas(salidaSintetica());
  assert.ok(r.ok);
  assert.equal(r.ticket.totalCentavos, 22990);
  assert.deepEqual(r.ticket.articulos.map((a) => a.centavos), [5700, 3600, 1500, 7990, 4200]);
  assert.equal(r.ticket.articulos[3]!.descuentoCentavos, 1000);
  assert.equal(r.ticket.fechaTicket, '2026-10-12');
});

test('el descuento sin signo también se resta', () => {
  const s = salidaSintetica();
  s.articulos[3]!.descuento_texto = '10.00';
  const r = reglas(s);
  assert.ok(r.ok);
  assert.equal(r.ticket.articulos[3]!.centavos, 7990);
});

test('regla 1: no es ticket o sin artículos', () => {
  assert.deepEqual(reglas({ ...salidaSintetica(), es_ticket: false }), { ok: false, motivo: 'no_es_ticket' });
  assert.deepEqual(reglas({ ...salidaSintetica(), articulos: [] }), { ok: false, motivo: 'no_es_ticket' });
});

test('regla 2: más de 40 artículos', () => {
  const muchos = Array.from({ length: 41 }, () => ({ ...salidaSintetica().articulos[0]!, importe_texto: '1.00' }));
  assert.deepEqual(reglas({ ...salidaSintetica(), total_texto: '41.00', articulos: muchos }), { ok: false, motivo: 'mas_de_40' });
});

test('regla 3: sin total legible', () => {
  assert.deepEqual(reglas({ ...salidaSintetica(), total_texto: null }), { ok: false, motivo: 'sin_total' });
  assert.deepEqual(reglas({ ...salidaSintetica(), total_texto: 'TOTAL' }), { ok: false, motivo: 'sin_total' });
});

test('regla 4 y 6: un descuento ilegible ("io.oo") o una suma distinta no cuadran', () => {
  const s = salidaSintetica();
  s.articulos[3]!.descuento_texto = 'io.oo';
  assert.deepEqual(reglas(s), { ok: false, motivo: 'no_cuadra', sumaLeida: 23990, totalLeido: 22990 });
  assert.deepEqual(reglas({ ...salidaSintetica(), total_texto: '219.90' }), {
    ok: false,
    motivo: 'no_cuadra',
    sumaLeida: 22990,
    totalLeido: 21990,
  });
});

test('regla 5: un artículo que queda en cero o negativo no cuadra', () => {
  const s = salidaSintetica();
  s.articulos[0]!.descuento_texto = '57.00';
  s.total_texto = '172.90';
  const r = reglas(s);
  assert.equal(r.ok, false);
});

test('regla 7: categoría no activa → Otros', () => {
  const s = salidaSintetica();
  s.articulos[0]!.categoria = 'Casino';
  const r = reglas(s);
  assert.ok(r.ok);
  assert.equal(r.ticket.articulos[0]!.categoria, 'Otros');
});

test('regla 8: descripciones, cantidades y comercio sin símbolos de formato', () => {
  const s = salidaSintetica();
  s.comercio = '*SUPER* _ESQUINA_';
  s.articulos[0]!.descripcion = '*LECHE*\nENTERA';
  s.articulos[0]!.cantidad = '`2 x`';
  const r = reglas(s);
  assert.ok(r.ok);
  assert.equal(r.ticket.comercio, 'SUPER ESQUINA');
  assert.equal(r.ticket.articulos[0]!.descripcion, 'LECHE ENTERA');
  assert.equal(r.ticket.articulos[0]!.cantidad, '2 x');
});

// --- Hallazgos con tickets reales (eval 2026-10-14) ---

test('importes con la letra de impuesto que imprime el comercio ("93.00T", "275.18 A")', () => {
  const s = {
    ...salidaSintetica(),
    articulos: [
      { descripcion: 'PAN PREMIU', cantidad: 'x 1', importe_texto: '93.00T', descuento_texto: '8.00', categoria: 'Comida' },
      { descripcion: 'KLNX BOUTI', cantidad: null, importe_texto: '14.50A', descuento_texto: null, categoria: 'Hogar' },
      { descripcion: 'DUMPLINGS', cantidad: null, importe_texto: '275.18 A', descuento_texto: '15.34-A', categoria: 'Comida' },
    ],
    total_texto: '359.34',
  };
  const r = reglas(s);
  assert.ok(r.ok);
  assert.deepEqual(r.ticket.articulos.map((a) => a.centavos), [8500, 1450, 25984]);
});

test('una línea negativa cancela el último artículo igual ("97.08-A")', () => {
  const s = {
    ...salidaSintetica(),
    articulos: [
      { descripcion: 'ELOT S.MIG 3/220 G', cantidad: null, importe_texto: '97.08 A', descuento_texto: null, categoria: 'Comida' },
      { descripcion: 'CURCUMA', cantidad: null, importe_texto: '91.96 A', descuento_texto: null, categoria: 'Comida' },
      { descripcion: 'ELOT S.MIG 3/220 G', cantidad: null, importe_texto: '97.08 A', descuento_texto: null, categoria: 'Comida' },
      { descripcion: 'ELOT S.MIG 3/220 G', cantidad: null, importe_texto: '97.08-A', descuento_texto: null, categoria: 'Comida' },
    ],
    total_texto: '189.04',
  };
  const r = reglas(s);
  assert.ok(r.ok);
  assert.deepEqual(r.ticket.articulos.map((a) => [a.descripcion, a.centavos]), [
    ['ELOT S.MIG 3/220 G', 9708],
    ['CURCUMA', 9196],
  ]);
});

test('una línea negativa sin artículo igual que cancelar no cuadra', () => {
  const s = {
    ...salidaSintetica(),
    articulos: [
      { descripcion: 'PAN', cantidad: null, importe_texto: '10.00', descuento_texto: null, categoria: 'Comida' },
      { descripcion: 'DEVOLUCION LECHE', cantidad: null, importe_texto: '-28.50', descuento_texto: null, categoria: 'Comida' },
    ],
    total_texto: '10.00',
  };
  assert.equal(reglas(s).ok, false);
});

test('una letra suelta no convierte texto en monto', () => {
  const s = salidaSintetica();
  s.articulos[0]!.importe_texto = 'TOTAL';
  assert.equal(reglas(s).ok, false);
});

test('total e importes con espacios dentro del número ("563. 00", "$ 1 ,234.50")', () => {
  const s = {
    ...salidaSintetica(),
    articulos: [
      { descripcion: 'REGLA', cantidad: '1 PZA', importe_texto: '$ 1 ,234.50', descuento_texto: null, categoria: 'Hogar' },
      { descripcion: 'CUCH', cantidad: '1 PZA', importe_texto: '563. 00', descuento_texto: null, categoria: 'Hogar' },
    ],
    total_texto: '1,797. 50 T',
  };
  const r = reglas(s);
  assert.ok(r.ok);
  assert.equal(r.ticket.totalCentavos, 179_750);
});

test('un total negativo no se acepta', () => {
  assert.deepEqual(reglas({ ...salidaSintetica(), total_texto: '-229.90' }), { ok: false, motivo: 'sin_total' });
});

// --- FR-018e: cuadre con IVA desglosado y descuento general ---

const lineas = (...importes: string[]) =>
  importes.map((importe_texto, i) => ({
    descripcion: `ARTICULO ${'ABCDEFGH'[i]}`,
    cantidad: null,
    importe_texto,
    descuento_texto: null,
    categoria: 'Comida',
  }));

const ticket = (importes: string[], extra: Record<string, unknown>) => ({ ...salidaSintetica(), articulos: lineas(...importes), ...extra });

test('ticket 8 (gasolina): Σ + IVA = total, con subtotal impreso igual a Σ', () => {
  const r = reglas(ticket(['259.64'], { subtotal_texto: '$259.64', impuesto_texto: '$40.36', total_texto: '$300.00' }));
  assert.ok(r.ok);
  assert.deepEqual(r.ticket.articulos.map((a) => [a.centavos, a.centavosLeidos]), [[30_000, 25_964]]);
  assert.deepEqual(r.ticket.ajuste, { impuestoCentavos: 4_036, descuentoGeneralCentavos: 0 });
});

test('ticket 9 (gasolina): 535.34 + 83.22 = 618.56', () => {
  const r = reglas(ticket(['535.34'], { subtotal_texto: '535.34', impuesto_texto: '83.22', total_texto: '618.56' }));
  assert.ok(r.ok);
  assert.equal(r.ticket.articulos[0]!.centavos, 61_856);
});

test('ticket 10 (Costco): Σ − descuento general = total, repartido proporcionalmente', () => {
  const r = reglas(ticket(['1,000.00', '2,000.00', '50.39'], {
    subtotal_texto: '3,050.39',
    descuento_general_texto: '60.07-',
    total_texto: '2,990.32',
  }));
  assert.ok(r.ok);
  assert.deepEqual(r.ticket.articulos.map((a) => a.centavos), [98_031, 196_061, 4_940]);
  assert.equal(r.ticket.articulos.reduce((s, a) => s + a.centavos, 0), 299_032);
  assert.deepEqual(r.ticket.ajuste, { impuestoCentavos: 0, descuentoGeneralCentavos: 6_007 });
});

test('IVA y descuento general a la vez', () => {
  const r = reglas(ticket(['60.00', '40.00'], {
    subtotal_texto: '100.00',
    impuesto_texto: '16.00',
    descuento_general_texto: '6.00',
    total_texto: '110.00',
  }));
  assert.ok(r.ok);
  assert.deepEqual(r.ticket.articulos.map((a) => a.centavos), [6_600, 4_400]);
  assert.deepEqual(r.ticket.ajuste, { impuestoCentavos: 1_600, descuentoGeneralCentavos: 600 });
});

test('sin subtotal impreso, o con subtotal distinto de Σ, no hay cuadre', () => {
  assert.equal(reglas(ticket(['259.64'], { impuesto_texto: '40.36', total_texto: '300.00' })).ok, false);
  assert.equal(reglas(ticket(['259.64'], { subtotal_texto: '260.00', impuesto_texto: '40.36', total_texto: '300.00' })).ok, false);
});

test('un IVA o descuento que no cierra al centavo no cuadra', () => {
  const r = reglas(ticket(['259.64'], { subtotal_texto: '259.64', impuesto_texto: '40.35', total_texto: '300.00' }));
  assert.deepEqual(r, { ok: false, motivo: 'no_cuadra', sumaLeida: 25_964, totalLeido: 30_000 });
});

test('un ajuste que deja un artículo en cero no cuadra', () => {
  const r = reglas(ticket(['100.00', '0.50'], { subtotal_texto: '100.50', descuento_general_texto: '100.00', total_texto: '0.50' }));
  assert.equal(r.ok, false);
});

test('si Σ ya es el total, el IVA impreso se ignora (precios con impuestos, como Walmart)', () => {
  const r = reglas(ticket(['93.00', '565.50'], { subtotal_texto: '649.03', impuesto_texto: '9.47', total_texto: '658.50' }));
  assert.ok(r.ok);
  assert.equal(r.ticket.ajuste, null);
  assert.deepEqual(r.ticket.articulos.map((a) => a.centavos), [9_300, 56_550]);
});

test('el esquema acepta los campos nuevos y el JSON Schema los ofrece a Ollama', () => {
  assert.equal(esquema.validar({ ...salidaSintetica(), subtotal_texto: null, impuesto_texto: null, descuento_general_texto: null }).ok, true);
  const texto = JSON.stringify(esquema.jsonSchema);
  for (const campo of ['subtotal_texto', 'impuesto_texto', 'descuento_general_texto']) assert.ok(texto.includes(campo));
  assert.equal(esquema.validar({ ...salidaSintetica(), impuesto_texto: '1'.repeat(21) }).ok, false);
});
