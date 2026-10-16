import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parsearMonto,
  formatearMonto,
  digitosPresentes,
  UMBRAL_CONFIRMACION_CENTAVOS,
} from '../../src/dominio/dinero.ts';

test('parsearMonto convierte formatos comunes a centavos enteros', () => {
  assert.equal(parsearMonto('12,500'), 1_250_000);
  assert.equal(parsearMonto('12.5 mil'), 1_250_000);
  assert.equal(parsearMonto('$180'), 18_000);
  assert.equal(parsearMonto('180 pesos'), 18_000);
  assert.equal(parsearMonto('99.90'), 9_990);
  assert.equal(parsearMonto('1,234.56'), 123_456);
  assert.equal(parsearMonto('12 mil'), 1_200_000);
  assert.equal(parsearMonto('0.10'), 10);
  assert.equal(parsearMonto('99.9'), 9_990);
});

test('parsearMonto rechaza montos no válidos', () => {
  for (const texto of ['0', '-5', 'abc', '', '1.234', '0.00', '1,23', '12..5', '1e5', '999999999999999']) {
    assert.equal(parsearMonto(texto), null, `debería rechazar "${texto}"`);
  }
});

test('parsearMonto devuelve siempre enteros', () => {
  for (const texto of ['0.10', '0.20', '0.30', '1.01', '99.99', '19.99 mil']) {
    const centavos = parsearMonto(texto);
    assert.ok(centavos !== null && Number.isInteger(centavos), texto);
  }
  assert.equal(parsearMonto('0.30'), 30);
});

test('formatearMonto usa el formato $12,500.00', () => {
  assert.equal(formatearMonto(1_250_000), '$12,500.00');
  assert.equal(formatearMonto(18_000), '$180.00');
  assert.equal(formatearMonto(9_990), '$99.90');
  assert.equal(formatearMonto(5), '$0.05');
  assert.equal(formatearMonto(-123_456), '-$1,234.56');
});

test('digitosPresentes exige que el monto aparezca en el mensaje', () => {
  assert.equal(digitosPresentes('12.5 mil', 'me pagaron 12.5 mil'), true);
  assert.equal(digitosPresentes('12,500', 'me pagaron 12,500 de la quincena'), true);
  assert.equal(digitosPresentes('12500', 'me pagaron 12,500 de la quincena'), true);
  assert.equal(digitosPresentes('180', 'gasté $180 en tacos.'), true);
  assert.equal(digitosPresentes('500', 'gasté 50'), false);
  assert.equal(digitosPresentes('502', 'gasté 50 en café y 200 en gasolina'), false);
  assert.equal(digitosPresentes('abc', 'gasté 50'), false);
});

test('el umbral de confirmación es $50,000.00', () => {
  assert.equal(UMBRAL_CONFIRMACION_CENTAVOS, 5_000_000);
});
