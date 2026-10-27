/**
 * Servicio: utilidades del trabajo por evento (puntualidad y horas).
 *
 * Cómo se manejan las horas aquí (importante):
 *  · Las horas de reloj de pared (cuándo llegó alguien, cuándo hay que estar)
 *    viajan como texto y NO se convierten de zona horaria. Guardar un
 *    `DateTime` de MySQL y leerlo con `toISOString()` devuelve el mismo reloj
 *    de pared que se escribió, así que «llegó a las 09:32» se ve igual en la
 *    base, en el teléfono y en la computadora, sin sorpresas de UTC ni de
 *    horario de verano.
 *  · Al escribir se manda texto `AAAA-MM-DD HH:MM:SS`; al leer se usa
 *    `aInstante()` (ISO de reloj de pared, terminado en Z para dejarlo claro).
 */

import { formatearHora } from '@/lib/fechas'

/** Texto `AAAA-MM-DDTHH:MM` (input datetime-local) → `AAAA-MM-DD HH:MM:SS` para MySQL. */
export function instanteParaSQL(valor: string): string {
  const limpio = valor.trim().replace('T', ' ')
  return limpio.length === 16 ? `${limpio}:00` : limpio
}

/** Valor de MySQL (Date o texto) → ISO de reloj de pared (`...Z`). */
export function aInstante(valor: Date | string | null | undefined): string | null {
  if (valor == null) return null
  if (valor instanceof Date) return valor.toISOString()
  const texto = String(valor).replace(' ', 'T')
  return texto.endsWith('Z') ? texto : `${texto}Z`
}

/** ISO de reloj de pared → «HH:MM». */
export function horaDeInstante(valor: string | null | undefined): string | null {
  if (!valor) return null
  const hora = valor.slice(11, 16)
  return /^\d{2}:\d{2}$/.test(hora) ? hora : null
}

/** ISO de reloj de pared → «AAAA-MM-DD». */
export function fechaDeInstante(valor: string | null | undefined): string | null {
  if (!valor) return null
  const fecha = valor.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null
}

/** «AAAA-MM-DD» + «HH:MM» → ISO de reloj de pared (`AAAA-MM-DDTHH:MM`). */
export function instanteDe(fecha: string, hora: string): string {
  return `${fecha}T${hora.slice(0, 5)}`
}

const aMinutos = (hora: string): number => {
  const [horas, minutos] = hora.slice(0, 5).split(':').map(Number)
  return horas * 60 + minutos
}

/**
 * Minutos de diferencia entre la hora en que alguien llegó y la hora a la que
 * tenía que estar. Positivo = llegó tarde; negativo = llegó antes.
 * Devuelve null si falta algún dato (sin hora de llegada no se opina).
 */
export function minutosDeDiferencia(
  llegoEn: string | null | undefined,
  fechaEvento: string,
  horaLlegada: string | null | undefined,
): number | null {
  if (!llegoEn || !horaLlegada) return null
  const llegada = horaDeInstante(llegoEn)
  if (!llegada) return null

  // Solo se comparan horas del mismo día: si la llegada quedó registrada otro
  // día (o el evento se pasó de medianoche), comparar daría un disparate.
  if (fechaDeInstante(llegoEn) !== fechaEvento) return null

  return aMinutos(llegada) - aMinutos(horaLlegada)
}

export interface Puntualidad {
  /** Llegó a la hora o antes */
  puntual: boolean
  /** Minutos de retraso (0 si llegó a tiempo o antes) */
  minutosTarde: number
}

/** ¿Llegó a tiempo? null cuando todavía no hay llegada o falta la hora del evento. */
export function puntualidadDe(
  llegoEn: string | null | undefined,
  fechaEvento: string,
  horaLlegada: string | null | undefined,
): Puntualidad | null {
  const diferencia = minutosDeDiferencia(llegoEn, fechaEvento, horaLlegada)
  if (diferencia == null) return null
  return { puntual: diferencia <= 0, minutosTarde: Math.max(0, diferencia) }
}

/** Texto corto para la interfaz: «A tiempo», «Llegó 12 min tarde», «Sin registrar». */
export function etiquetaLlegada(
  llegoEn: string | null | undefined,
  fechaEvento: string,
  horaLlegada: string | null | undefined,
): string {
  const horaCruda = horaDeInstante(llegoEn)
  if (!horaCruda) return 'Sin registrar'
  const hora = formatearHora(horaCruda)
  const puntualidad = puntualidadDe(llegoEn, fechaEvento, horaLlegada)
  if (!puntualidad) return `Llegó ${hora}`
  if (puntualidad.puntual) return `A tiempo · ${hora}`
  return `${puntualidad.minutosTarde} min tarde · ${hora}`
}

/** Texto del tono con el que se pinta la llegada en los listados. */
export function tonoDeLlegada(
  llegoEn: string | null | undefined,
  fechaEvento: string,
  horaLlegada: string | null | undefined,
): 'success' | 'warning' | 'default' {
  const puntualidad = puntualidadDe(llegoEn, fechaEvento, horaLlegada)
  if (!puntualidad) return 'default'
  return puntualidad.puntual ? 'success' : 'warning'
}
