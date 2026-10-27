import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  abrirPrestamo,
  borrarPrestamoAbierto,
  buscarPrestamo,
  cerrarPrestamo,
  listarPrestamos,
  marcarDevolucionAvisada,
  marcarRecogido,
  prestamoAbiertoDe,
  prestamoDeRegistro,
  tieneEquipoACargo,
} from '@/lib/db/prestamos'
import { listarEquipos, sincronizarEstatusEquipo, buscarEquipo } from '@/lib/db/equipos'
import { esMiembroDeMinisterio, listarMiembros } from '@/lib/db/ministerios'
import { fasePrestamo } from '@/lib/prestamo'
import { obtenerPool } from '@/lib/db/conexion'
import {
  baseLista,
  comoMinisterio,
  comoOrganizacion,
  comoRama,
  crearCuentaDePrueba,
  crearEquipoDePrueba,
  crearMinisterioDePrueba,
} from './base'

describe.skipIf(!baseLista)('préstamos · ciclo de vida contra MySQL', () => {
  let ministerio: number
  let otroMinisterio: number
  let encargado: number
  let servidor: number
  let ajeno: number
  let equipo: number

  beforeAll(async () => {
    ministerio = await crearMinisterioDePrueba('Cámaras')
    otroMinisterio = await crearMinisterioDePrueba('Sonido')
    encargado = await crearCuentaDePrueba({ etiqueta: 'encargado', rol: 'Encargado de ministerio', ministerioId: ministerio })
    servidor = await crearCuentaDePrueba({ etiqueta: 'servidor', rol: 'Servidor de ministerio', ministerioId: ministerio })
    ajeno = await crearCuentaDePrueba({ etiqueta: 'ajeno', rol: 'Servidor de ministerio', ministerioId: otroMinisterio })
    equipo = await crearEquipoDePrueba(ministerio, 'Cámara')
  })

  afterAll(async () => {
    await obtenerPool().end()
    globalThis.__poolGosen = undefined
  })

  it('los miembros de un ministerio son solo las cuentas activas de ese ministerio', async () => {
    const miembros = (await listarMiembros(ministerio)).map((miembro) => miembro.id)
    expect(miembros).toContain(encargado)
    expect(miembros).toContain(servidor)
    expect(miembros).not.toContain(ajeno)
    expect(await esMiembroDeMinisterio(servidor, ministerio)).toBe(true)
    expect(await esMiembroDeMinisterio(ajeno, ministerio)).toBe(false)
  })

  it('una cuenta desactivada ya no es miembro', async () => {
    const baja = await crearCuentaDePrueba({ etiqueta: 'baja', rol: 'Servidor de ministerio', ministerioId: ministerio, activo: false })
    expect(await esMiembroDeMinisterio(baja, ministerio)).toBe(false)
    expect((await listarMiembros(ministerio)).map((miembro) => miembro.id)).not.toContain(baja)
  })

  it('prestar sin entregar deja el préstamo «por recoger» y el equipo prestado', async () => {
    const id = await abrirPrestamo({
      equipoId: equipo,
      responsableId: servidor,
      asignadoAId: servidor,
      eventoId: null,
      estadoEntrega: 'BUENO',
      notas: null,
      registradoPorId: encargado,
      entregado: false,
    })
    await sincronizarEstatusEquipo(equipo)

    const prestamo = await buscarPrestamo(id, comoOrganizacion)
    expect(prestamo).not.toBeNull()
    expect(fasePrestamo(prestamo!)).toBe('POR_RECOGER')
    expect((await prestamoAbiertoDe(equipo))?.id).toBe(id)
    expect((await buscarEquipo(equipo, comoOrganizacion))?.estatus).toBe('PRESTADO')
    expect(await tieneEquipoACargo(servidor)).toBe(true)
    expect(await tieneEquipoACargo(ajeno)).toBe(false)

    // Ciclo completo
    expect(await marcarRecogido(id)).toBe(1)
    expect(await marcarRecogido(id)).toBe(0) // idempotente: ya estaba recogido
    expect(fasePrestamo((await buscarPrestamo(id, comoOrganizacion))!)).toBe('PRESTADO')

    expect(await marcarDevolucionAvisada(id, { estado: 'CON_DETALLE', notas: 'Le falta la tapa' })).toBe(1)
    expect(await marcarDevolucionAvisada(id, { estado: 'BUENO', notas: null })).toBe(0) // no se avisa dos veces
    const avisado = (await buscarPrestamo(id, comoOrganizacion))!
    expect(fasePrestamo(avisado)).toBe('POR_REVISAR')
    expect(avisado.estadoDevolucionAvisado).toBe('CON_DETALLE')

    // Avisar la devolución NO cierra el préstamo: el equipo sigue fuera hasta que el ministerio lo reciba
    expect((await prestamoAbiertoDe(equipo))?.id).toBe(id)

    await cerrarPrestamo(id, { estadoDevolucion: 'CON_DETALLE', notas: null, devueltoPorId: encargado })
    await sincronizarEstatusEquipo(equipo)
    const cerrado = (await buscarPrestamo(id, comoOrganizacion))!
    expect(fasePrestamo(cerrado)).toBe('DEVUELTO')
    expect(cerrado.estadoDevolucion).toBe('CON_DETALLE')
    expect(cerrado.notas).toBe('Le falta la tapa') // el cierre sin notas no borra las del aviso
    expect(await prestamoAbiertoDe(equipo)).toBeNull()
    expect((await buscarEquipo(equipo, comoOrganizacion))?.estatus).toBe('DISPONIBLE')
    expect(await tieneEquipoACargo(servidor)).toBe(false)
  })

  it('un préstamo cerrado ya no se puede recoger, avisar, cerrar de nuevo ni borrar', async () => {
    const id = await abrirPrestamo({
      equipoId: equipo, responsableId: servidor, asignadoAId: servidor, eventoId: null,
      estadoEntrega: 'BUENO', notas: null, registradoPorId: encargado, entregado: true,
    })
    await cerrarPrestamo(id, { estadoDevolucion: 'BUENO', notas: null, devueltoPorId: encargado })
    const antes = (await buscarPrestamo(id, comoOrganizacion))!

    expect(await marcarRecogido(id)).toBe(0)
    expect(await marcarDevolucionAvisada(id, { estado: 'DANADO', notas: 'intento' })).toBe(0)
    await cerrarPrestamo(id, { estadoDevolucion: 'DANADO', notas: 'intento', devueltoPorId: servidor })
    expect(await borrarPrestamoAbierto(id)).toBe(0)

    const despues = (await buscarPrestamo(id, comoOrganizacion))!
    expect(despues.estadoDevolucion).toBe('BUENO') // el registro histórico no cambió
    expect(despues.devueltoEn).toBe(antes.devueltoEn)
    expect(despues.notas).toBe(antes.notas)
  })

  it('avisar la devolución exige haber recogido el equipo', async () => {
    const id = await abrirPrestamo({
      equipoId: equipo, responsableId: servidor, asignadoAId: servidor, eventoId: null,
      estadoEntrega: 'BUENO', notas: null, registradoPorId: encargado, entregado: false,
    })
    expect(await marcarDevolucionAvisada(id, { estado: 'BUENO', notas: null })).toBe(0)
    expect(await borrarPrestamoAbierto(id)).toBe(1) // un préstamo abierto sí se puede deshacer
  })

  it('prestamoDeRegistro y buscarPrestamo apuntan al ministerio del equipo', async () => {
    const id = await abrirPrestamo({
      equipoId: equipo, responsableId: servidor, asignadoAId: servidor, eventoId: null,
      estadoEntrega: 'BUENO', notas: null, registradoPorId: encargado, entregado: true,
    })
    expect((await prestamoDeRegistro(id))?.ministerioId).toBe(ministerio)
    await cerrarPrestamo(id, { estadoDevolucion: 'BUENO', notas: null, devueltoPorId: encargado })
  })

  describe('alcance dentro del SQL', () => {
    let prestamoId: number
    let equipoAislado: number

    beforeAll(async () => {
      equipoAislado = await crearEquipoDePrueba(ministerio, 'Micrófono')
      prestamoId = await abrirPrestamo({
        equipoId: equipoAislado, responsableId: servidor, asignadoAId: servidor, eventoId: null,
        estadoEntrega: 'BUENO', notas: null, registradoPorId: encargado, entregado: true,
      })
    })

    it('el ministerio dueño y la organización lo ven', async () => {
      const propios = (await listarPrestamos(comoMinisterio(ministerio))).map((prestamo) => prestamo.id)
      expect(propios).toContain(prestamoId)
      const todos = (await listarPrestamos(comoOrganizacion)).map((prestamo) => prestamo.id)
      expect(todos).toContain(prestamoId)
    })

    it('OTRO ministerio no lo ve ni por listado ni por id', async () => {
      const ajenos = (await listarPrestamos(comoMinisterio(otroMinisterio))).map((prestamo) => prestamo.id)
      expect(ajenos).not.toContain(prestamoId)
      expect(await buscarPrestamo(prestamoId, comoMinisterio(otroMinisterio))).toBeNull()
    })

    it('un rol de rama o de célula no ve ningún préstamo (los ministerios son un eje aparte)', async () => {
      expect(await listarPrestamos(comoRama())).toEqual([])
      expect(await buscarPrestamo(prestamoId, comoRama())).toBeNull()
    })

    it('los equipos siguen la misma regla', async () => {
      const propios = (await listarEquipos(comoMinisterio(ministerio))).map((fila) => fila.id)
      expect(propios).toContain(equipoAislado)
      const ajenos = (await listarEquipos(comoMinisterio(otroMinisterio))).map((fila) => fila.id)
      expect(ajenos).not.toContain(equipoAislado)
      expect(await listarEquipos(comoRama())).toEqual([])
    })

    it('filtrar por persona trae lo que lleva o lo que tiene asignado', async () => {
      const delServidor = (await listarPrestamos(comoMinisterio(ministerio), { usuarioId: servidor })).map((fila) => fila.id)
      expect(delServidor).toContain(prestamoId)
      const delAjeno = await listarPrestamos(comoOrganizacion, { usuarioId: ajeno })
      expect(delAjeno.map((fila) => fila.id)).not.toContain(prestamoId)
    })
  })
})
