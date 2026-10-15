// US1 de la 002: configuración por chat. Todo se lee con reglas fijas, nunca con el modelo (FR-006):
// listas con `validarListaCategorias`, montos con `parsearMonto`. Cada pregunta es una espera.
import type { Repositorio } from '../almacen/repositorio.ts';
import {
  esIntentoDeCategorias,
  esPredeterminadas,
  PREDETERMINADAS,
  validarListaCategorias,
  type Tipo,
} from '../dominio/categorias.ts';
import { parsearMonto } from '../dominio/dinero.ts';
import { reconocerComando, type Comando } from './comandos.ts';
import { registrarManejadorEspera, type ManejadorEspera, type ResolucionEspera } from './espera.ts';
import {
  categoriasGuardadas,
  configuracionGuardada,
  configuracionPausada,
  listaNoValida,
  preguntaCategorias,
  preguntaUmbral,
  umbralFueraDeRango,
  verConfiguracion,
  type VistaConfiguracion,
} from './respuestas.ts';

/** FR-005: $100.00 a $1,000,000.00. */
export const UMBRAL_MINIMO = 10_000;
export const UMBRAL_MAXIMO = 100_000_000;

const activas = (repo: Repositorio, tipo: Tipo) => repo.categorias(tipo, { soloActivas: true }).map((c) => c.nombre);

function vista(repo: Repositorio): VistaConfiguracion {
  return { gastos: activas(repo, 'gasto'), ingresos: activas(repo, 'ingreso'), umbralCentavos: repo.umbralCentavos() };
}

/** Pregunta 1/2. Con bienvenida, la primera vez (FR-001); con los valores actuales, si no (FR-008). */
export function iniciarConfiguracion(repo: Repositorio, bienvenida: boolean): string {
  repo.crearEspera('config_categorias_gasto', null);
  return preguntaCategorias('gasto', activas(repo, 'gasto'), bienvenida);
}

/** Comandos de configuración. Devuelve la respuesta o null si el comando no es de configuración. */
export function ejecutarComandoConfiguracion(repo: Repositorio, comando: Comando): string | null {
  switch (comando) {
    case 'configurar':
      return iniciarConfiguracion(repo, false);
    case 'configurar_ingresos':
      repo.crearEspera('config_categorias_ingreso', null);
      return preguntaCategorias('ingreso', activas(repo, 'ingreso'), false);
    case 'ver_configuracion':
      return verConfiguracion(vista(repo));
    default:
      return null;
  }
}

/** FR-006a: un mensaje que no es intento de respuesta pausa la configuración y sigue su camino. */
function pausar(repo: Repositorio): ResolucionEspera {
  repo.cancelarEspera();
  if (repo.estadoConfiguracion() !== 'completa') repo.fijarEstadoConfiguracion('pausada');
  return { tipo: 'cancelada', aviso: configuracionPausada() };
}

const respuesta = (texto: string): ResolucionEspera => ({
  tipo: 'resuelta',
  resultado: { resultado: 'configuracion', respuesta: texto },
});

function manejadorCategorias(tipo: Tipo): ManejadorEspera {
  return ({ repo, mensaje }) => {
    const texto = mensaje.texto;
    // Otro comando ("configurar", "ver configuración"…) reemplaza la pregunta sin aviso.
    if (reconocerComando(texto)) {
      repo.cancelarEspera();
      return { tipo: 'cancelada', aviso: null };
    }
    if (!esIntentoDeCategorias(texto)) return pausar(repo);

    const lista = esPredeterminadas(texto)
      ? ({ ok: true, nombres: PREDETERMINADAS[tipo].map((c) => c.nombre) } as const)
      : validarListaCategorias(texto);
    if (!lista.ok) {
      // Intento no válido: no se guarda nada y se repite la pregunta (la espera sigue).
      return respuesta(`${listaNoValida(lista.motivo)}\n\n${preguntaCategorias(tipo, activas(repo, tipo), false)}`);
    }

    const antes = repo.guardarCategorias(tipo, lista.nombres);
    const guardadas = categoriasGuardadas(tipo, antes, activas(repo, tipo));
    if (tipo === 'ingreso') {
      repo.cancelarEspera();
      return respuesta(guardadas);
    }
    repo.crearEspera('config_umbral', null);
    return respuesta(`${guardadas}\n\n${preguntaUmbral(repo.umbralCentavos())}`);
  };
}

const manejadorUmbral: ManejadorEspera = ({ repo, mensaje }) => {
  const texto = mensaje.texto.trim();
  if (reconocerComando(texto)) {
    repo.cancelarEspera();
    return { tipo: 'cancelada', aviso: null };
  }
  const centavos = parsearMonto(texto);
  if (centavos === null) return pausar(repo);
  if (centavos < UMBRAL_MINIMO || centavos > UMBRAL_MAXIMO) {
    return respuesta(`${umbralFueraDeRango()}\n\n${preguntaUmbral(repo.umbralCentavos())}`);
  }
  const anterior = repo.umbralCentavos();
  repo.fijarUmbral(centavos);
  repo.fijarEstadoConfiguracion('completa');
  repo.cancelarEspera();
  return respuesta(configuracionGuardada(vista(repo), anterior));
};

registrarManejadorEspera('config_categorias_gasto', manejadorCategorias('gasto'));
registrarManejadorEspera('config_categorias_ingreso', manejadorCategorias('ingreso'));
registrarManejadorEspera('config_umbral', manejadorUmbral);
