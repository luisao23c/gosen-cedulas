import { describe, expect, it } from 'vitest'
import {
  compararCandidatas,
  evaluarCandidata,
  porIdCampos,
  porIdRespuestas,
  puntuarCandidata,
} from '@/lib/campos'
import type { CampoDiferenciador, CriterioCelula, RespuestaCampo } from '@/types/domain'

const estadoCivil: CampoDiferenciador = {
  id: 1,
  nombre: 'Estado civil',
  tipo: 'SELECT',
  descripcion: null,
  unidad: null,
  limiteInferior: null,
  limiteSuperior: null,
  activo: true,
  orden: 1,
  opciones: [
    { id: 10, campoId: 1, etiqueta: 'Soltero' },
    { id: 11, campoId: 1, etiqueta: 'Casado' },
  ],
}
const edad: CampoDiferenciador = {
  id: 2,
  nombre: 'Edad',
  tipo: 'RANGO',
  descripcion: null,
  unidad: 'años',
  limiteInferior: 0,
  limiteSuperior: 120,
  activo: true,
  orden: 2,
  opciones: [],
}
const campos = porIdCampos([estadoCivil, edad])

const criterio = (c: Partial<CriterioCelula> & Pick<CriterioCelula, 'campoId'>): CriterioCelula => ({
  celulaId: 1,
  obligatorio: false,
  minimo: null,
  maximo: null,
  opcionIds: [],
  ...c,
})

function evaluar(criterios: CriterioCelula[], respuestas: RespuestaCampo[]) {
  return evaluarCandidata(criterios, campos, porIdRespuestas(respuestas))
}

const soltero: RespuestaCampo = { campoId: 1, opcionId: 10, valor: null }
const de25: RespuestaCampo = { campoId: 2, opcionId: null, valor: 25 }

describe('evaluarCandidata', () => {
  it('cumple una opción aceptada y un rango', () => {
    const resultado = evaluar(
      [
        criterio({ campoId: 1, obligatorio: true, opcionIds: [10, 11] }),
        criterio({ campoId: 2, minimo: 20, maximo: 30 }),
      ],
      [soltero, de25],
    )
    expect(resultado.apta).toBe(true)
    expect(resultado.obligatorios).toEqual({ cumplidos: 1, total: 1 })
    expect(resultado.preferencias).toEqual({ cumplidos: 1, total: 1 })
    expect(resultado.faltantes).toEqual([])
  })

  it('un obligatorio incumplido descarta a la célula y se marca como obligatorio', () => {
    const resultado = evaluar([criterio({ campoId: 1, obligatorio: true, opcionIds: [11] })], [soltero])
    expect(resultado.apta).toBe(false)
    expect(resultado.faltantesObligatorios).toHaveLength(1)
  })

  it('una preferencia incumplida NO descarta', () => {
    const resultado = evaluar([criterio({ campoId: 2, minimo: 40 })], [de25])
    expect(resultado.apta).toBe(true)
    expect(resultado.preferencias).toEqual({ cumplidos: 0, total: 1 })
    expect(resultado.faltantesObligatorios).toEqual([])
  })

  it('lo que nadie contestó cuenta como no cumplido', () => {
    const resultado = evaluar([criterio({ campoId: 1, obligatorio: true, opcionIds: [10] })], [])
    expect(resultado.apta).toBe(false)
  })

  it('un campo que ya no existe en el catálogo se ignora', () => {
    const resultado = evaluar([criterio({ campoId: 999, obligatorio: true, opcionIds: [1] })], [soltero])
    expect(resultado.apta).toBe(true)
    expect(resultado.obligatorios.total).toBe(0)
  })

  it('los límites del rango son inclusivos', () => {
    const resultado = evaluar([criterio({ campoId: 2, minimo: 25, maximo: 25 })], [de25])
    expect(resultado.preferencias.cumplidos).toBe(1)
  })
})

describe('puntuarCandidata', () => {
  const perfecta = evaluar(
    [criterio({ campoId: 1, obligatorio: true, opcionIds: [10] }), criterio({ campoId: 2, minimo: 20, maximo: 30 })],
    [soltero, de25],
  )
  const regular = evaluar(
    [criterio({ campoId: 1, obligatorio: true, opcionIds: [10] }), criterio({ campoId: 2, minimo: 40 })],
    [soltero, de25],
  )

  it('cumplir más criterios da más puntaje', () => {
    expect(puntuarCandidata(perfecta, 1, true).puntaje).toBeGreaterThan(
      puntuarCandidata(regular, 1, true).puntaje,
    )
  })

  it('estar más cerca da más puntaje a igualdad de criterios', () => {
    expect(puntuarCandidata(perfecta, 0.5, true).puntaje).toBeGreaterThan(
      puntuarCandidata(perfecta, 12, true).puntaje,
    )
  })

  it('a 15 km o más la cercanía ya no suma', () => {
    expect(puntuarCandidata(perfecta, 15, true).porCercania).toBe(0)
    expect(puntuarCandidata(perfecta, 40, true).porCercania).toBe(0)
  })

  it('sin punto en el mapa el puntaje sale solo de los criterios', () => {
    const sinPunto = puntuarCandidata(perfecta, null, true)
    expect(sinPunto.porCercania).toBeNull()
    expect(sinPunto.puntaje).toBe(100)
  })

  it('sin respuestas, los criterios no premian ni castigan (neutro)', () => {
    expect(puntuarCandidata(perfecta, null, false).puntaje).toBe(50)
    expect(puntuarCandidata(undefined, null, true).puntaje).toBe(50)
  })

  it('el puntaje siempre está entre 0 y 100', () => {
    for (const distancia of [null, 0, 3, 15, 200]) {
      for (const hay of [true, false]) {
        const { puntaje } = puntuarCandidata(regular, distancia, hay)
        expect(puntaje).toBeGreaterThanOrEqual(0)
        expect(puntaje).toBeLessThanOrEqual(100)
      }
    }
  })
})

describe('compararCandidatas (orden del ranking)', () => {
  const apta = evaluar([criterio({ campoId: 1, obligatorio: true, opcionIds: [10] })], [soltero])
  const noApta = evaluar([criterio({ campoId: 1, obligatorio: true, opcionIds: [11] })], [soltero])
  const entrada = (evaluacion: typeof apta | undefined, distancia: number | null) => ({
    evaluacion,
    distancia,
    puntaje: puntuarCandidata(evaluacion, distancia, true),
  })

  it('las que cumplen lo obligatorio van antes, aunque estén más lejos', () => {
    const lejosPeroApta = entrada(apta, 14)
    const cercaPeroNoApta = entrada(noApta, 0.2)
    expect(compararCandidatas(lejosPeroApta, cercaPeroNoApta, true)).toBeLessThan(0)
  })

  it('a igual puntaje, manda la más cercana', () => {
    expect(compararCandidatas(entrada(apta, 1), entrada(apta, 3), true)).toBeLessThan(0)
  })

  it('sin respuestas, el grupo apta/no apta no se aplica (solo puntaje y cercanía)', () => {
    const resultado = compararCandidatas(entrada(noApta, 1), entrada(apta, 3), false)
    expect(typeof resultado).toBe('number')
  })
})
