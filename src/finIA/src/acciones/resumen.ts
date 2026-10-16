// US4: resumen como mensaje de texto en el grupo (FR-010). Por defecto, el mes actual.
import { rangoPeriodo } from '../dominio/fechas.ts';
import { consultaSinDatos, etiquetaPeriodo, resumen as textoResumen } from './respuestas.ts';
import type { FuncionAccion } from './tipos.ts';

export const resumen: FuncionAccion = ({ repo, interpretacion, ahora }) => {
  const periodo = interpretacion.consulta?.periodo ?? 'mes';
  const rango = rangoPeriodo(periodo, interpretacion.consulta?.mes, ahora);
  const etiqueta = etiquetaPeriodo(periodo, rango.desde, ahora);
  const datos = repo.resumen(rango);
  const respuesta = datos.cantidad === 0 ? consultaSinDatos('ambos', etiqueta, null) : textoResumen(datos, etiqueta);
  return { resultado: 'resumen', respuesta };
};
