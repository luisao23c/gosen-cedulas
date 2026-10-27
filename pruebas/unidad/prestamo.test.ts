import { describe, expect, it } from 'vitest'
import { SIGUIENTE_PASO_PERSONA, chipDeFase, fasePrestamo, type FasePrestamo } from '@/lib/prestamo'

const AHORA = '2026-10-15 10:00:00'

describe('fasePrestamo (se deduce de las marcas del registro)', () => {
  it('sin ninguna marca: el ministerio lo apartó y falta recogerlo', () => {
    expect(fasePrestamo({ recogidoEn: null, devolucionAvisadaEn: null, devueltoEn: null })).toBe('POR_RECOGER')
  })

  it('recogido: ya lo tiene quien lo lleva', () => {
    expect(fasePrestamo({ recogidoEn: AHORA, devolucionAvisadaEn: null, devueltoEn: null })).toBe('PRESTADO')
  })

  it('avisó la devolución: falta que el ministerio lo reciba', () => {
    expect(fasePrestamo({ recogidoEn: AHORA, devolucionAvisadaEn: AHORA, devueltoEn: null })).toBe('POR_REVISAR')
  })

  it('el ministerio lo recibió: se cierra', () => {
    expect(fasePrestamo({ recogidoEn: AHORA, devolucionAvisadaEn: AHORA, devueltoEn: AHORA })).toBe('DEVUELTO')
  })

  it('devuelto manda sobre cualquier otra marca (el ministerio puede cerrar sin aviso previo)', () => {
    expect(fasePrestamo({ recogidoEn: null, devolucionAvisadaEn: null, devueltoEn: AHORA })).toBe('DEVUELTO')
  })

  it('un aviso de devolución sin recogida registrada no regresa a «por recoger»', () => {
    expect(fasePrestamo({ recogidoEn: null, devolucionAvisadaEn: AHORA, devueltoEn: null })).toBe('POR_REVISAR')
  })
})

describe('chipDeFase', () => {
  it('cada fase tiene etiqueta en español y un tono', () => {
    const fases: FasePrestamo[] = ['POR_RECOGER', 'PRESTADO', 'POR_REVISAR', 'DEVUELTO']
    for (const fase of fases) {
      const chip = chipDeFase(fase)
      expect(chip.etiqueta.length).toBeGreaterThan(0)
      expect(['success', 'primary', 'warning', 'default']).toContain(chip.tono)
    }
  })

  it('lo que pide atención se marca en advertencia', () => {
    expect(chipDeFase('POR_RECOGER').tono).toBe('warning')
    expect(chipDeFase('POR_REVISAR').tono).toBe('warning')
  })

  it('devuelto en buen estado es éxito; con detalle o dañado, advertencia', () => {
    expect(chipDeFase('DEVUELTO', 'BUENO')).toEqual({ etiqueta: 'Devuelto · buen estado', tono: 'success' })
    expect(chipDeFase('DEVUELTO', 'CON_DETALLE').tono).toBe('warning')
    expect(chipDeFase('DEVUELTO', 'DANADO').tono).toBe('warning')
  })

  it('devuelto sin estado conocido no inventa uno', () => {
    expect(chipDeFase('DEVUELTO')).toEqual({ etiqueta: 'Devuelto', tono: 'success' })
    expect(chipDeFase('DEVUELTO', null).etiqueta).toBe('Devuelto')
  })
})

describe('SIGUIENTE_PASO_PERSONA', () => {
  it('hay una frase para cada fase', () => {
    for (const fase of ['POR_RECOGER', 'PRESTADO', 'POR_REVISAR', 'DEVUELTO'] as const) {
      expect(SIGUIENTE_PASO_PERSONA[fase]).toBeTruthy()
    }
  })
})
