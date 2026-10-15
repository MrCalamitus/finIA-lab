// US1: registrar uno o varios movimientos. Aplica las reglas 1–5 de contracts/interpretacion.md:
// el modelo propone, el código decide.
import type { NuevoMovimiento } from '../almacen/repositorio.ts';
import { categoriaValida } from '../dominio/categorias.ts';
import { digitosPresentes, parsearMonto } from '../dominio/dinero.ts';
import { validarFecha } from '../dominio/fechas.ts';
import type { MovimientoPropuesto } from '../interprete/esquema.ts';
import { rechazo, type FuncionAccion } from './tipos.ts';
import { preguntaConfirmacion, registrado, TEXTOS, variosConInvalido } from './respuestas.ts';

/** Devuelve el movimiento listo para guardar o null si incumple alguna regla. */
export function validarMovimiento(
  propuesto: MovimientoPropuesto,
  textoOriginal: string,
  fechaEnvio: Date,
  activas?: { gasto: readonly string[]; ingreso: readonly string[] },
): NuevoMovimiento | null {
  const montoCentavos = parsearMonto(propuesto.monto_texto);
  if (montoCentavos === null) return null;
  if (!digitosPresentes(propuesto.monto_texto, textoOriginal)) return null;
  if (!categoriaValida(propuesto.categoria, propuesto.tipo, activas?.[propuesto.tipo])) return null;
  if (!validarFecha(propuesto.fecha, fechaEnvio)) return null;
  return { tipo: propuesto.tipo, montoCentavos, categoria: propuesto.categoria, fecha: propuesto.fecha };
}

export const registrar: FuncionAccion = ({ repo, mensaje, interpretacion, ahora }) => {
  const propuestos = interpretacion.movimientos ?? [];
  const validos: NuevoMovimiento[] = [];
  const activas = {
    gasto: repo.categorias('gasto', { soloActivas: true }).map((c) => c.nombre),
    ingreso: repo.categorias('ingreso', { soloActivas: true }).map((c) => c.nombre),
  };
  for (const propuesto of propuestos) {
    const valido = validarMovimiento(propuesto, mensaje.texto, mensaje.enviadoEn, activas);
    // FR-002a: todo o nada.
    if (!valido) return rechazo(propuestos.length > 1 ? variosConInvalido(propuesto.monto_texto) : TEXTOS.noEntendido);
    validos.push(valido);
  }
  if (validos.length === 0) return rechazo(TEXTOS.noEntendido);

  // FR-005a: si alguno supera el umbral, todo el mensaje espera confirmación.
  const umbral = repo.umbralCentavos();
  const requiereConfirmacion = validos.some((m) => m.montoCentavos > umbral);
  const estado = requiereConfirmacion ? 'pendiente' : 'vigente';
  const ids = repo.insertarMovimientos(mensaje.id, mensaje.texto, validos, estado);
  const visibles = validos.map((m) => ({ tipo: m.tipo, monto_centavos: m.montoCentavos, categoria: m.categoria, fecha: m.fecha }));

  if (requiereConfirmacion) {
    // La confirmación es la espera activa (research R7 de la 002).
    repo.crearEspera('registro_pendiente', mensaje.id);
    return { resultado: 'pendiente', respuesta: preguntaConfirmacion(visibles, ahora) };
  }
  return { resultado: 'registrado', respuesta: registrado(visibles, ahora), confirmar: ids };
};
