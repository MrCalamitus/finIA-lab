// US2: totales por periodo y categoría (FR-008, FR-009). Solo lee; no escribe movimientos.
import { rangoPeriodo } from '../dominio/fechas.ts';
import { consulta as textoConsulta, consultaSinDatos, etiquetaPeriodo, TEXTOS, type LineaConsulta } from './respuestas.ts';
import { rechazo, type FuncionAccion } from './tipos.ts';

export const consultar: FuncionAccion = ({ repo, interpretacion, ahora }) => {
  const consulta = interpretacion.consulta;
  if (!consulta) return rechazo(TEXTOS.noEntendido);

  const rango = rangoPeriodo(consulta.periodo, consulta.mes, ahora);
  const etiqueta = etiquetaPeriodo(consulta.periodo, rango.desde, ahora);
  const categoria = consulta.categoria ?? null;
  const tipos = consulta.tipo === 'ambos' ? (['ingreso', 'gasto'] as const) : [consulta.tipo];

  const lineas: LineaConsulta[] = tipos.map((tipo) => ({ tipo, ...repo.totales({ tipo, ...rango, categoria }) }));
  const respuesta = lineas.every((l) => l.cantidad === 0)
    ? consultaSinDatos(consulta.tipo, etiqueta, categoria)
    : textoConsulta(lineas, etiqueta, categoria);

  return { resultado: 'consulta', respuesta };
};
