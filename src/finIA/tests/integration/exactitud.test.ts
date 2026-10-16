// SC-003: el 100 % de los totales consultados coincide al centavo con la suma de los movimientos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, type Sembrado } from '../dobles/fabrica.ts';
import { CATEGORIAS_GASTO } from '../../src/dominio/categorias.ts';
import { rangoPeriodo } from '../../src/dominio/fechas.ts';
import { formatearMonto } from '../../src/dominio/dinero.ts';

/** Generador pseudoaleatorio con semilla fija (mulberry32), para que la prueba sea repetible. */
function aleatorio(semilla: number) {
  return () => {
    semilla = (semilla + 0x6d2b79f5) | 0;
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('SC-003: 1,000 movimientos aleatorios; cada total coincide al centavo', async () => {
  const azar = aleatorio(20261013);
  const movimientos: Sembrado[] = Array.from({ length: 1000 }, () => {
    const dia = 1 + Math.floor(azar() * 13);
    const mes = azar() < 0.7 ? '10' : '09';
    return {
      tipo: 'gasto',
      centavos: 1 + Math.floor(azar() * 5_000_000),
      categoria: CATEGORIAS_GASTO[Math.floor(azar() * CATEGORIAS_GASTO.length)]!,
      fecha: `2026-${mes}-${String(dia).padStart(2, '0')}`,
    };
  });

  const consultas: { texto: string; periodo: string; mes?: string; categoria?: string }[] = [
    { texto: 'mes', periodo: 'mes' },
    { texto: 'semana', periodo: 'semana' },
    { texto: 'hoy', periodo: 'hoy' },
    { texto: 'septiembre', periodo: 'mes_concreto', mes: '2026-09' },
    ...CATEGORIAS_GASTO.map((categoria) => ({ texto: `mes ${categoria}`, periodo: 'mes', categoria })),
  ];

  const programa = Object.fromEntries(
    consultas.map((c) => [c.texto, { accion: 'consultar', consulta: { tipo: 'gasto', periodo: c.periodo, mes: c.mes, categoria: c.categoria } }]),
  );
  const e = crearEntorno({ programa });
  e.sembrar(movimientos);

  for (const c of consultas) {
    const { desde, hasta } = rangoPeriodo(c.periodo as 'mes', c.mes, e.reloj());
    const incluidos = movimientos.filter(
      (m) => m.fecha! >= desde && m.fecha! <= hasta && (!c.categoria || m.categoria === c.categoria),
    );
    const esperado = incluidos.reduce((suma, m) => suma + m.centavos, 0);
    const [respuesta] = await e.escribir(c.texto);
    assert.ok(Number.isSafeInteger(esperado));
    if (incluidos.length === 0) {
      assert.match(respuesta!, /^No hay/);
    } else {
      assert.ok(
        respuesta!.includes(`${formatearMonto(esperado)} (${incluidos.length} gasto`),
        `${c.texto}: esperaba ${formatearMonto(esperado)} en "${respuesta}"`,
      );
    }
  }
});
