// US3: corregir monto, categoría o fecha de un movimiento vigente (FR-011, FR-012).
import { digitosPresentes, formatearMonto, parsearMonto } from '../dominio/dinero.ts';
import { formatearFechaRelativa, validarFecha } from '../dominio/fechas.ts';
import { resolverObjetivo } from './objetivo.ts';
import {
  citaAmbigua,
  corregido,
  montoCorregidoAlto,
  sinCoincidencia,
  TEXTOS,
  valorNoValido,
} from './respuestas.ts';
import { rechazo, type FuncionAccion } from './tipos.ts';

export const corregir: FuncionAccion = ({ repo, mensaje, interpretacion, ahora }) => {
  const correccion = interpretacion.correccion;
  if (!correccion) return rechazo(TEXTOS.noEntendido);

  const objetivo = resolverObjetivo(repo, mensaje.citadoId, interpretacion.pista);
  if (objetivo.tipo === 'ninguno') return rechazo(sinCoincidencia('corregir'));
  if (objetivo.tipo === 'ambiguo') return rechazo(citaAmbigua(objetivo.movimientos));
  const movimiento = objetivo.movimiento;
  const valor = correccion.nuevo_valor;

  if (correccion.campo === 'monto') {
    const centavos = parsearMonto(valor);
    if (centavos === null || !digitosPresentes(valor, mensaje.texto)) return rechazo(valorNoValido(valor));
    // FR-011: un monto alto debe pasar por la confirmación de FR-005a; aquí no se aplica.
    const umbral = repo.umbralCentavos();
    if (centavos > umbral) {
      return rechazo(montoCorregidoAlto(centavos, umbral));
    }
    repo.actualizarCampo(movimiento.id, 'monto_centavos', centavos, mensaje.id);
    return {
      resultado: 'correccion',
      respuesta: corregido(movimiento, 'monto_centavos', formatearMonto(movimiento.monto_centavos), formatearMonto(centavos), ahora),
    };
  }

  if (correccion.campo === 'categoria') {
    // FR-006b: solo categorías activas.
    const lista = repo.categorias(movimiento.tipo, { soloActivas: true }).map((c) => c.nombre);
    const categoria = lista.find((c) => c.toLowerCase() === valor.trim().toLowerCase());
    if (!categoria) return rechazo(valorNoValido(valor));
    repo.actualizarCampo(movimiento.id, 'categoria', categoria, mensaje.id);
    return {
      resultado: 'correccion',
      respuesta: corregido({ ...movimiento, categoria }, 'categoria', movimiento.categoria, categoria, ahora),
    };
  }

  if (!validarFecha(valor, mensaje.enviadoEn)) return rechazo(valorNoValido(valor));
  repo.actualizarCampo(movimiento.id, 'fecha', valor, mensaje.id);
  return {
    resultado: 'correccion',
    respuesta: corregido(
      movimiento,
      'fecha',
      formatearFechaRelativa(movimiento.fecha, ahora),
      formatearFechaRelativa(valor, ahora),
      ahora,
    ),
  };
};
