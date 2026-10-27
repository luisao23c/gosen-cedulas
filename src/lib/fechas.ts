/**
 * Utilidades de fecha para la interfaz.
 * Las fechas del dominio viajan como ISO corto (AAAA-MM-DD) para que no las
 * mueva la zona horaria; aquí solo se dan formato o se calcula la edad.
 */

import { DIAS_SEMANA } from '@/types/domain'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const

/** Fecha de hoy como ISO corto (AAAA-MM-DD), en la zona horaria del equipo. */
export function hoyISO(ahora: Date = new Date()): string {
  const mes = String(ahora.getMonth() + 1).padStart(2, '0')
  const dia = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${mes}-${dia}`
}

/**
 * Fecha de la reunión de esta semana para una célula.
 *
 * Si hoy es el día de reunión, es hoy; si no, la reunión más reciente que ya
 * pasó (así el lunes la reunión del domingo está lista para pasar lista).
 * Sin día fijo, la reunión es hoy.
 */
export function fechaDeLaReunion(diaSemana: number | null, ahora: Date = new Date()): string {
  if (diaSemana == null || diaSemana < 0 || diaSemana > 6) return hoyISO(ahora)
  const diasAtras = (ahora.getDay() - diaSemana + 7) % 7
  const reunion = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() - diasAtras)
  return hoyISO(reunion)
}

function fechaLarga(fecha: string, conAnio: boolean): string {
  const partes = fecha.slice(0, 10).split('-').map(Number)
  if (partes.length !== 3 || partes.some((numero) => !Number.isFinite(numero))) return fecha
  const [anio, mes, dia] = partes
  const nombreDia = DIAS_SEMANA[new Date(anio, mes - 1, dia).getDay()]
  return `${nombreDia} ${dia} de ${MESES[mes - 1] ?? ''}${conAnio ? ` de ${anio}` : ''}`.trim()
}

/**
 * Fecha ISO corta → «Miércoles 8 de octubre» (para encabezar una reunión o un evento). El año solo
 * se añade cuando no es el actual: «Miércoles 3 de noviembre de 2027».
 */
export function formatearFechaConDia(fecha: string): string {
  const anio = Number(fecha.slice(0, 4))
  return fechaLarga(fecha, Number.isFinite(anio) && anio !== new Date().getFullYear())
}

/** Fecha ISO corta → «Miércoles 3 de noviembre de 2000» (siempre con año). Vacío → «—». */
export function formatearFecha(fecha: string | null | undefined): string {
  if (!fecha) return '—'
  const [anio, mes, dia] = fecha.slice(0, 10).split('-')
  if (!anio || !mes || !dia) return '—'
  return fechaLarga(fecha, true)
}

/** «15:00» → «3 p. m.» · «09:30» → «9:30 a. m.» · «00:00» → «12 a. m.». Vacío → «—». */
export function formatearHora(hora: string | null | undefined): string {
  if (!hora) return '—'
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  if (!Number.isFinite(horas) || !Number.isFinite(minutos)) return hora
  const sufijo = horas >= 12 ? 'p. m.' : 'a. m.'
  const enDoce = horas % 12 === 0 ? 12 : horas % 12
  return minutos === 0 ? `${enDoce} ${sufijo}` : `${enDoce}:${String(minutos).padStart(2, '0')} ${sufijo}`
}

/* ── Cumpleaños ─────────────────────────────────────────────── */

/** ¿El año es bisiesto? (regla gregoriana) */
function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0
}

/**
 * Día del cumpleaños ajustado: quien nació un 29 de febrero lo celebra el 28
 * cuando el año no es bisiesto (si no, su cumpleaños desaparecería dos de cada
 * cuatro años).
 */
function diaDelCumpleanos(mes: number, dia: number, anio: number): number {
  return mes === 2 && dia === 29 && !esBisiesto(anio) ? 28 : dia
}

/** Cumpleaños del año indicado, en milisegundos UTC a medianoche. */
function instanteCumpleanos(anio: number, mes: number, dia: number): number {
  return Date.UTC(anio, mes - 1, diaDelCumpleanos(mes, dia, anio))
}

/** Fecha ISO corta (AAAA-MM-DD) de un instante UTC. */
function isoDesdeUTC(instante: number): string {
  return new Date(instante).toISOString().slice(0, 10)
}

export interface ProximoCumpleanos {
  /** ISO corto (AAAA-MM-DD) del día en que cumple */
  fecha: string
  /** Días que faltan (0 = hoy) */
  dias: number
  /** Años que cumple en esa fecha */
  edad: number
}

/**
 * Próximo cumpleaños de una persona, ignorando el año de nacimiento.
 *
 * Todo se calcula en UTC a medianoche: contar días con fechas locales se rompe
 * en los cambios de horario de verano (el día antes del cambio no tiene 24 h).
 */
export function proximoCumpleanos(
  fechaNacimiento: string | null | undefined,
  ahora: Date = new Date(),
): ProximoCumpleanos | null {
  if (!fechaNacimiento) return null
  const partes = fechaNacimiento.slice(0, 10).split('-').map(Number)
  if (partes.length !== 3 || partes.some((numero) => !Number.isFinite(numero))) return null
  const [anioNacimiento, mes, dia] = partes

  const hoy = Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  let anio = ahora.getFullYear()
  let cuando = instanteCumpleanos(anio, mes, dia)
  if (cuando < hoy) {
    anio += 1
    cuando = instanteCumpleanos(anio, mes, dia)
  }

  return {
    fecha: isoDesdeUTC(cuando),
    dias: Math.round((cuando - hoy) / (24 * 60 * 60 * 1000)),
    edad: anio - anioNacimiento,
  }
}

/** Años cumplidos a día de hoy, o null si no hay fecha. */
export function calcularEdad(fecha: string | null | undefined): number | null {
  if (!fecha) return null
  const partes = fecha.slice(0, 10).split('-').map(Number)
  if (partes.length !== 3 || partes.some((numero) => !Number.isFinite(numero))) return null

  const [anio, mes, dia] = partes
  const hoy = new Date()
  let edad = hoy.getFullYear() - anio
  const cumpleEsteAnio = new Date(hoy.getFullYear(), mes - 1, dia)
  if (hoy < cumpleEsteAnio) edad -= 1
  return edad >= 0 ? edad : null
}
