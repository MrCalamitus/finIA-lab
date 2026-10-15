// Fechas como texto YYYY-MM-DD en la zona horaria de la máquina (Assumptions de la spec).

export type Periodo = 'hoy' | 'semana' | 'mes' | 'mes_concreto';

export interface Rango {
  desde: string;
  hasta: string;
}

const MAX_DIAS_ATRAS = 366;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MES = /^(\d{4})-(\d{2})$/;

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

const dos = (n: number) => String(n).padStart(2, '0');

/** Fecha local → "YYYY-MM-DD". */
export function aIso(fecha: Date): string {
  return `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}`;
}

/** "YYYY-MM-DD" → Date local a mediodía (evita saltos por horario de verano), o null si no existe. */
export function deIso(iso: string): Date | null {
  const partes = ISO.exec(iso);
  if (!partes) return null;
  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const fecha = new Date(anio, mes - 1, dia, 12);
  if (fecha.getFullYear() !== anio || fecha.getMonth() !== mes - 1 || fecha.getDate() !== dia) return null;
  return fecha;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** Fecha real, no posterior a la fecha de envío y no más de 366 días atrás. */
export function validarFecha(iso: string, fechaEnvio: Date): boolean {
  if (!deIso(iso)) return false;
  const limiteSuperior = aIso(fechaEnvio);
  const limiteInferior = aIso(sumarDias(fechaEnvio, -MAX_DIAS_ATRAS));
  return iso >= limiteInferior && iso <= limiteSuperior;
}

function rangoDeMes(anio: number, mes: number): Rango {
  const ultimoDia = new Date(anio, mes, 0).getDate();
  return { desde: `${anio}-${dos(mes)}-01`, hasta: `${anio}-${dos(mes)}-${dos(ultimoDia)}` };
}

/** Resuelve un periodo a un rango de fechas. La semana va de lunes a domingo. */
export function rangoPeriodo(periodo: Periodo, mes: string | null | undefined, hoy: Date): Rango {
  switch (periodo) {
    case 'hoy':
      return { desde: aIso(hoy), hasta: aIso(hoy) };
    case 'semana': {
      const diasDesdeLunes = (hoy.getDay() + 6) % 7;
      const lunes = sumarDias(hoy, -diasDesdeLunes);
      return { desde: aIso(lunes), hasta: aIso(sumarDias(lunes, 6)) };
    }
    case 'mes':
      return rangoDeMes(hoy.getFullYear(), hoy.getMonth() + 1);
    case 'mes_concreto': {
      const partes = mes ? MES.exec(mes) : null;
      const numeroMes = Number(partes?.[2]);
      if (!partes || numeroMes < 1 || numeroMes > 12) throw new Error('mes_concreto requiere un mes YYYY-MM válido');
      return rangoDeMes(Number(partes[1]), numeroMes);
    }
  }
}

/** "hoy", "ayer" o "dd/mm/aaaa". */
export function formatearFechaRelativa(iso: string, hoy: Date): string {
  if (iso === aIso(hoy)) return 'hoy';
  if (iso === aIso(sumarDias(hoy, -1))) return 'ayer';
  const [anio, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${anio}`;
}

// --- 002: fecha escrita por el dueño (FR-018c, research R5) ---

const sinAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// "9 de octubre", "9 oct", "9 de octubre de 2025" (sobre texto en minúsculas y sin acentos).
const NOMBRES_MES =
  'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre|' +
  'ene|feb|mar|abr|may|jun|jul|ago|sept|sep|set|oct|nov|dic';
const MES_CON_NOMBRE = new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${NOMBRES_MES})\\b\\.?(?:\\s+(?:del?\\s+)?(\\d{4})\\b)?`);

function numeroDeMes(nombre: string): number {
  const prefijo = nombre === 'setiembre' || nombre === 'set' ? 'sep' : nombre.slice(0, 3);
  return ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'].indexOf(prefijo) + 1;
}

/** Fecha sin año: la de este año, o la del anterior si caería en el futuro ("25 de diciembre" en octubre). */
function sinAnio(dia: number, mes: number, hoy: Date): string | null {
  const iso = `${hoy.getFullYear()}-${dos(mes)}-${dos(dia)}`;
  if (!deIso(iso)) return null;
  return iso > aIso(hoy) ? `${hoy.getFullYear() - 1}-${dos(mes)}-${dos(dia)}` : iso;
}

/**
 * Busca una fecha escrita en el texto, en este orden: dd/mm/aaaa, "9 de octubre [de aaaa]", dd/mm,
 * "antier", "ayer", "hoy".
 * Devuelve la fecha ISO y el fragmento encontrado, o null. No valida rangos (usa `validarFecha`).
 */
export function fechaEscritaConCoincidencia(texto: string, hoy: Date): { iso: string; coincidencia: string } | null {
  const normal = sinAcentos(texto);
  const completa = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(normal);
  if (completa) {
    const iso = `${completa[3]}-${dos(Number(completa[2]))}-${dos(Number(completa[1]))}`;
    return deIso(iso) ? { iso, coincidencia: completa[0] } : null;
  }
  const conNombre = MES_CON_NOMBRE.exec(normal);
  if (conNombre) {
    const mes = numeroDeMes(conNombre[2]!);
    const dia = Number(conNombre[1]);
    const iso = conNombre[3] ? `${conNombre[3]}-${dos(mes)}-${dos(dia)}` : sinAnio(dia, mes, hoy);
    return iso && deIso(iso) ? { iso, coincidencia: conNombre[0] } : null;
  }
  const corta = /\b(\d{1,2})\/(\d{1,2})\b/.exec(normal);
  if (corta) {
    const iso = sinAnio(Number(corta[1]), Number(corta[2]), hoy);
    return iso ? { iso, coincidencia: corta[0] } : null;
  }
  const palabras: [string, number][] = [['antier', -2], ['ayer', -1], ['hoy', 0]];
  for (const [palabra, dias] of palabras) {
    if (new RegExp(`\\b${palabra}\\b`).test(normal)) return { iso: aIso(sumarDias(hoy, dias)), coincidencia: palabra };
  }
  return null;
}

export function leerFechaEscrita(texto: string, hoy: Date): string | null {
  return fechaEscritaConCoincidencia(texto, hoy)?.iso ?? null;
}

/** "2026-10" → "octubre". */
export function nombreMes(yyyyMm: string): string {
  const mes = Number(yyyyMm.slice(5, 7));
  return MESES[mes - 1] ?? yyyyMm;
}
