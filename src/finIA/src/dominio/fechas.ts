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

/** "2026-10" → "octubre". */
export function nombreMes(yyyyMm: string): string {
  const mes = Number(yyyyMm.slice(5, 7));
  return MESES[mes - 1] ?? yyyyMm;
}
