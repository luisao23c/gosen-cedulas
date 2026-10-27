import { describe, expect, it } from 'vitest'
import {
  fechaDeLaReunion,
  formatearFecha,
  formatearFechaConDia,
  formatearHora,
  hoyISO,
  proximoCumpleanos,
} from '@/lib/fechas'
import {
  VENTANA_POR_DEFECTO,
  cumpleanosProximos,
  etiquetaFaltan,
  ventanaPedida,
} from '@/lib/cumpleanos'

/** Fecha local a mediodía: evita falsos fallos por la zona horaria de quien corre las pruebas. */
const local = (anio: number, mes: number, dia: number) => new Date(anio, mes - 1, dia, 12, 0, 0)

describe('hoyISO', () => {
  it('da AAAA-MM-DD con ceros', () => {
    expect(hoyISO(local(2026, 3, 5))).toBe('2026-03-05')
    expect(hoyISO(local(2026, 12, 31))).toBe('2026-12-31')
  })
})

describe('fechaDeLaReunion', () => {
  // 15 de octubre de 2026 es jueves (getDay() = 4)
  const jueves = local(2026, 10, 15)

  it('si hoy es el día de la reunión, es hoy', () => {
    expect(fechaDeLaReunion(4, jueves)).toBe('2026-10-15')
  })

  it('si no, la reunión más reciente que ya pasó', () => {
    expect(fechaDeLaReunion(0, jueves)).toBe('2026-10-11') // domingo anterior
    expect(fechaDeLaReunion(5, jueves)).toBe('2026-10-09') // viernes de la semana pasada
  })

  it('cruza el cambio de mes y de año', () => {
    expect(fechaDeLaReunion(1, local(2026, 1, 2))).toBe('2025-12-29') // lunes anterior al viernes 2 de enero
  })

  it('sin día fijo, o con un día inválido, es hoy', () => {
    expect(fechaDeLaReunion(null, jueves)).toBe('2026-10-15')
    expect(fechaDeLaReunion(9, jueves)).toBe('2026-10-15')
    expect(fechaDeLaReunion(-1, jueves)).toBe('2026-10-15')
  })
})

describe('formatearFecha / formatearFechaConDia', () => {
  it('fecha larga con año y vacío como raya', () => {
    expect(formatearFecha('2026-10-08')).toBe('Jueves 8 de octubre de 2026')
    expect(formatearFecha('2000-11-03')).toBe('Viernes 3 de noviembre de 2000')
    expect(formatearFecha('2026-10-08T00:00:00.000Z')).toBe('Jueves 8 de octubre de 2026')
    expect(formatearFecha(null)).toBe('—')
    expect(formatearFecha('')).toBe('—')
    expect(formatearFecha('basura')).toBe('—')
  })

  it('con el día de la semana; el año solo si no es el actual', () => {
    const anioActual = new Date().getFullYear()
    expect(formatearFechaConDia(`${anioActual}-10-08`)).toMatch(/^\w+ 8 de octubre$/)
    expect(formatearFechaConDia('2000-11-03')).toBe('Viernes 3 de noviembre de 2000')
  })

  it('la hora en formato de 12 horas', () => {
    expect(formatearHora('15:00')).toBe('3 p. m.')
    expect(formatearHora('09:30')).toBe('9:30 a. m.')
    expect(formatearHora('12:00')).toBe('12 p. m.')
    expect(formatearHora('00:05')).toBe('12:05 a. m.')
    expect(formatearHora('19:00:00')).toBe('7 p. m.')
    expect(formatearHora(null)).toBe('—')
  })

  it('una fecha ilegible se devuelve tal cual (no revienta)', () => {
    expect(formatearFechaConDia('no-es-fecha')).toBe('no-es-fecha')
  })
})

describe('proximoCumpleanos', () => {
  it('hoy es hoy: 0 días y los años que cumple', () => {
    expect(proximoCumpleanos('1990-10-15', local(2026, 10, 15))).toEqual({
      fecha: '2026-10-15',
      dias: 0,
      edad: 36,
    })
  })

  it('si ya pasó este año, cuenta hacia el siguiente', () => {
    const resultado = proximoCumpleanos('1990-10-14', local(2026, 10, 15))
    expect(resultado?.fecha).toBe('2027-10-14')
    expect(resultado?.dias).toBe(364)
    expect(resultado?.edad).toBe(37)
  })

  it('cruza el fin de año', () => {
    const resultado = proximoCumpleanos('2000-01-03', local(2026, 12, 30))
    expect(resultado).toEqual({ fecha: '2027-01-03', dias: 4, edad: 27 })
  })

  it('el 29 de febrero se celebra el 28 en años no bisiestos y el 29 en los bisiestos', () => {
    expect(proximoCumpleanos('2000-02-29', local(2027, 2, 1))?.fecha).toBe('2027-02-28')
    expect(proximoCumpleanos('2000-02-29', local(2028, 2, 1))?.fecha).toBe('2028-02-29')
  })

  it('los días son correctos al cruzar el cambio de horario (cuenta en UTC)', () => {
    // Marzo 2026: en muchos países cambia la hora; la diferencia tiene que seguir siendo exacta
    expect(proximoCumpleanos('1990-03-31', local(2026, 3, 1))?.dias).toBe(30)
    expect(proximoCumpleanos('1990-11-10', local(2026, 10, 1))?.dias).toBe(40)
  })

  it('sin fecha o con una fecha ilegible, null', () => {
    expect(proximoCumpleanos(null)).toBeNull()
    expect(proximoCumpleanos(undefined)).toBeNull()
    expect(proximoCumpleanos('')).toBeNull()
    expect(proximoCumpleanos('abcd-ef-gh')).toBeNull()
  })
})

describe('ventanaPedida / etiquetaFaltan', () => {
  it('solo acepta las ventanas que la pantalla ofrece', () => {
    expect(ventanaPedida('7')).toBe(7)
    expect(ventanaPedida('90')).toBe(90)
    expect(ventanaPedida('10')).toBe(VENTANA_POR_DEFECTO)
    expect(ventanaPedida('x')).toBe(VENTANA_POR_DEFECTO)
    expect(ventanaPedida(undefined)).toBe(VENTANA_POR_DEFECTO)
    expect(ventanaPedida(null)).toBe(VENTANA_POR_DEFECTO)
  })

  it('Hoy · Mañana · En N días', () => {
    expect(etiquetaFaltan(0)).toBe('Hoy')
    expect(etiquetaFaltan(1)).toBe('Mañana')
    expect(etiquetaFaltan(12)).toBe('En 12 días')
  })
})

describe('cumpleanosProximos', () => {
  const ahora = local(2026, 10, 15)
  const personas = [
    { nombre: 'Ana', fechaNacimiento: '1990-10-20', nombreCelula: 'Roca' },
    { nombre: 'Beto', fechaNacimiento: '1985-10-15', nombreCelula: 'Roca' },
    { nombre: 'Carla', fechaNacimiento: '1992-12-30', nombreCelula: 'Aurora' },
    { nombre: 'Dani', fechaNacimiento: '1999-11-02', nombreCelula: 'Aurora' },
    { nombre: 'Sin fecha', fechaNacimiento: null, nombreCelula: 'Roca' },
  ]

  it('deja solo a quien cumple dentro de la ventana', () => {
    const nombres = cumpleanosProximos(personas, 30, ahora).map((entrada) => entrada.persona.nombre)
    expect(nombres).toEqual(['Dani', 'Beto', 'Ana'])
  })

  it('ordena por célula y luego por cercanía del día', () => {
    const resultado = cumpleanosProximos(personas, 90, ahora).map((entrada) => entrada.persona.nombre)
    // Aurora (Dani: 18 días, Carla: 76) antes que Roca (Beto: 0, Ana: 5)
    expect(resultado).toEqual(['Dani', 'Carla', 'Beto', 'Ana'])
  })

  it('una ventana corta deja fuera a los lejanos', () => {
    const resultado = cumpleanosProximos(personas, 7, ahora).map((entrada) => entrada.persona.nombre)
    expect(resultado).toEqual(['Beto', 'Ana'])
  })

  it('no incluye a quien no tiene fecha de nacimiento', () => {
    expect(cumpleanosProximos(personas, 90, ahora).some((entrada) => entrada.persona.nombre === 'Sin fecha')).toBe(false)
  })
})
