import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  asignarTurnos,
  borrarLlegada,
  buscarEvento,
  cambiarFuncion,
  confirmarTurno,
  crearEvento,
  desactivarEvento,
  listarAsignables,
  listarEventos,
  listarMisTurnos,
  listarTurnos,
  quitarTurno,
  registrarLlegada,
  turnoDe,
} from '@/lib/db/eventos'
import { obtenerPool } from '@/lib/db/conexion'
import {
  baseLista,
  comoMinisterio,
  comoOrganizacion,
  comoRama,
  crearCuentaDePrueba,
  crearMinisterioDePrueba,
} from './base'

describe.skipIf(!baseLista)('eventos y turnos · contra MySQL', () => {
  let ministerio: number
  let otroMinisterio: number
  let encargado: number
  let servidorA: number
  let servidorB: number
  let ajeno: number
  let evento: number

  beforeAll(async () => {
    ministerio = await crearMinisterioDePrueba('Alabanza')
    otroMinisterio = await crearMinisterioDePrueba('Multimedia')
    encargado = await crearCuentaDePrueba({ etiqueta: 'enc-ev', rol: 'Encargado de ministerio', ministerioId: ministerio })
    servidorA = await crearCuentaDePrueba({ etiqueta: 'srv-a', rol: 'Servidor de ministerio', ministerioId: ministerio })
    servidorB = await crearCuentaDePrueba({ etiqueta: 'srv-b', rol: 'Servidor de ministerio', ministerioId: ministerio })
    ajeno = await crearCuentaDePrueba({ etiqueta: 'ajeno-ev', rol: 'Servidor de ministerio', ministerioId: otroMinisterio })
    evento = await crearEvento({
      ministerioId: ministerio,
      nombre: 'Culto de prueba',
      descripcion: null,
      fecha: '2030-01-06',
      horaLlegada: '09:30',
      latitud: 25.5439,
      longitud: -103.4069,
      direccion: 'Av. Hidalgo 200, Torreón',
      creadoPorId: encargado,
    })
  })

  afterAll(async () => {
    await obtenerPool().end()
    globalThis.__poolGosen = undefined
  })

  it('el evento se guarda con su fecha, su hora de llegada y su punto en el mapa', async () => {
    const guardado = await buscarEvento(evento, comoMinisterio(ministerio))
    expect(guardado?.fecha).toBe('2030-01-06')
    expect(guardado?.horaLlegada).toBe('09:30')
    expect(guardado?.ubicacion.latitud).toBeCloseTo(25.5439, 4)
    expect(guardado?.ubicacion.direccion).toBe('Av. Hidalgo 200, Torreón')
    expect(guardado?.activo).toBe(true)
  })

  it('el alcance de eventos va dentro del SQL', async () => {
    expect(await buscarEvento(evento, comoMinisterio(otroMinisterio))).toBeNull()
    expect(await buscarEvento(evento, comoRama())).toBeNull()
    expect(await buscarEvento(evento, comoOrganizacion)).not.toBeNull()
    expect((await listarEventos(comoMinisterio(ministerio))).map((fila) => fila.id)).toContain(evento)
    expect((await listarEventos(comoMinisterio(otroMinisterio))).map((fila) => fila.id)).not.toContain(evento)
    expect(await listarEventos(comoRama())).toEqual([])
  })

  it('asignar turnos no duplica a quien ya estaba y guarda su función', async () => {
    expect(await asignarTurnos(evento, [servidorA, servidorB], 'Cámara 1')).toBe(2)
    expect(await asignarTurnos(evento, [servidorA, servidorB], 'Otra cosa')).toBe(0)
    expect(await asignarTurnos(evento, [])).toBe(0)

    const turnos = await listarTurnos(evento)
    expect(turnos).toHaveLength(2)
    expect(turnos.every((turno) => turno.funcion === 'Cámara 1')).toBe(true) // el repetido no pisó la función
  })

  it('cambiar la función afecta solo a ese servidor', async () => {
    expect(await cambiarFuncion(evento, servidorB, 'Switcher')).toBe(1)
    expect((await turnoDe(evento, servidorB))?.funcion).toBe('Switcher')
    expect((await turnoDe(evento, servidorA))?.funcion).toBe('Cámara 1')
    expect(await cambiarFuncion(evento, ajeno, 'Intruso')).toBe(0) // quien no está asignado no se toca
  })

  it('confirmar y retirar la confirmación', async () => {
    expect(await confirmarTurno(evento, servidorA, true)).toBe(1)
    const confirmado = await turnoDe(evento, servidorA)
    expect(confirmado?.confirmado).toBe(true)
    expect(confirmado?.confirmadoEn).toBeTruthy()

    await confirmarTurno(evento, servidorA, false)
    const retirado = await turnoDe(evento, servidorA)
    expect(retirado?.confirmado).toBe(false)
    expect(retirado?.confirmadoEn).toBeNull()

    expect(await confirmarTurno(evento, ajeno, true)).toBe(0) // no existe ese turno
  })

  it('el resumen del evento cuenta turnos, confirmados y llegadas', async () => {
    await confirmarTurno(evento, servidorB, true)
    await registrarLlegada(evento, servidorB, {
      llegoEn: '2030-01-06 09:12:00',
      latitud: 25.544,
      longitud: -103.407,
      direccion: 'En la puerta',
      registradoPorId: encargado,
    })
    const resumen = (await listarEventos(comoMinisterio(ministerio))).find((fila) => fila.id === evento)
    expect(resumen?.totalServidores).toBe(2)
    expect(resumen?.confirmados).toBe(1)
    expect(resumen?.llegaron).toBe(1)
  })

  it('la hora de llegada se guarda como hora de reloj (no se desplaza por zona horaria)', async () => {
    const turno = await turnoDe(evento, servidorB)
    expect(turno?.llegoEn).toContain('09:12')
    expect(turno?.registradoPorId).toBe(encargado)
  })

  it('quien ya llegó no se puede quitar del evento (es la evidencia de que sirvió)', async () => {
    expect(await quitarTurno(evento, servidorB)).toBe(false)
    expect(await turnoDe(evento, servidorB)).not.toBeNull()

    await borrarLlegada(evento, servidorB) // al corregir la llegada sí puede salir
    expect((await turnoDe(evento, servidorB))?.llegoEn).toBeNull()
    expect(await quitarTurno(evento, servidorB)).toBe(true)
    expect(await turnoDe(evento, servidorB)).toBeNull()
  })

  it('«Mis turnos» trae el id del EVENTO (no el del turno) y el punto del evento (no el de la llegada)', async () => {
    // Regresión: el id y las coordenadas del turno pisaban a los del evento en la misma fila
    const mios = await listarMisTurnos(servidorA, { desde: '2030-01-01' })
    const fila = mios.find((candidata) => candidata.evento.id === evento)
    expect(fila, 'el evento debe salir con su propio id').toBeDefined()
    expect(fila!.turno.eventoId).toBe(evento)
    expect(fila!.turno.usuarioId).toBe(servidorA)
    expect(fila!.turno.id).not.toBe(fila!.evento.id)
    expect(fila!.evento.ubicacion.latitud).toBeCloseTo(25.5439, 4) // el del evento, aunque el turno no tenga llegada
    expect(fila!.turno.ubicacion.latitud).toBeNull()
  })

  it('«Mis turnos» muestra solo los de esa cuenta', async () => {
    const mios = await listarMisTurnos(servidorA, { desde: '2030-01-01' })
    expect(mios.map((fila) => fila.evento.id)).toContain(evento)
    const delAjeno = await listarMisTurnos(ajeno, { desde: '2030-01-01' })
    expect(delAjeno.map((fila) => fila.evento.id)).not.toContain(evento)
  })

  it('las cuentas asignables son las del ministerio y las de organización, nunca las de otro ministerio ni las dadas de baja', async () => {
    const baja = await crearCuentaDePrueba({ etiqueta: 'baja-ev', rol: 'Servidor de ministerio', ministerioId: ministerio, activo: false })
    const admin = await crearCuentaDePrueba({ etiqueta: 'admin-ev', rol: 'Administrador' })
    const ids = (await listarAsignables(ministerio)).map((cuenta) => cuenta.id)
    expect(ids).toContain(servidorA)
    expect(ids).toContain(admin)
    expect(ids).not.toContain(ajeno)
    expect(ids).not.toContain(baja)
  })

  it('un evento desactivado sale de «Mis turnos» y del listado normal, pero se conserva', async () => {
    const aparte = await crearEvento({
      ministerioId: ministerio, nombre: 'Se cancela', descripcion: null, fecha: '2030-02-03',
      horaLlegada: null, latitud: null, longitud: null, direccion: null, creadoPorId: encargado,
    })
    await asignarTurnos(aparte, [servidorA])
    await desactivarEvento(aparte)

    expect((await listarEventos(comoMinisterio(ministerio))).map((fila) => fila.id)).not.toContain(aparte)
    expect((await listarEventos(comoMinisterio(ministerio), { soloActivos: false })).map((fila) => fila.id)).toContain(aparte)
    expect((await listarMisTurnos(servidorA, { desde: '2030-01-01' })).map((fila) => fila.evento.id)).not.toContain(aparte)
  })
})
