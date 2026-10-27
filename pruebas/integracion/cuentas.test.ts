import { afterAll, describe, expect, it } from 'vitest'
import { ROLES_BASE, todosLosPermisos } from '@/lib/auth/catalogo'
import { puede } from '@/lib/auth/permisos'
import { obtenerPool } from '@/lib/db/conexion'
import { listarRoles } from '@/lib/db/roles'
import { buscarCredencial, buscarPorId, contarAdministradoresActivos } from '@/lib/db/usuarios'
import { baseLista, crearCuentaDePrueba, crearMinisterioDePrueba, SUFIJO } from './base'

describe.skipIf(!baseLista)('cuentas y roles · contra MySQL', () => {
  afterAll(async () => {
    await obtenerPool().end()
    globalThis.__poolGosen = undefined
  })

  it('los roles base de la base coinciden con el catálogo (alcance y permisos)', async () => {
    const enBase = await listarRoles()
    for (const base of ROLES_BASE) {
      const rol = enBase.find((candidato) => candidato.nombre === base.nombre)
      expect(rol, `falta el rol «${base.nombre}» en la base`).toBeDefined()
      expect(rol!.alcance).toBe(base.alcance)
      if (base.esSistema) {
        expect(rol!.permisos.length).toBe(todosLosPermisos().length)
      } else {
        expect([...rol!.permisos].sort()).toEqual([...base.permisos].sort())
      }
    }
  })

  it('el rol Administrador es de sistema y existe al menos una cuenta activa con él', async () => {
    const admin = (await listarRoles()).find((rol) => rol.nombre === 'Administrador')
    expect(admin?.esSistema).toBe(true)
    expect(await contarAdministradoresActivos()).toBeGreaterThanOrEqual(1)
  })

  it('la sesión resuelve los permisos reales del rol y su ministerio', async () => {
    const ministerio = await crearMinisterioDePrueba('Sesion')
    const id = await crearCuentaDePrueba({ etiqueta: 'sesion', rol: 'Servidor de ministerio', ministerioId: ministerio })
    const usuario = await buscarPorId(id)

    expect(usuario).not.toBeNull()
    expect(usuario!.alcance).toBe('MINISTERIO')
    expect(usuario!.ministerioId).toBe(ministerio)
    expect(puede(usuario!, 'ver', 'evento', { ministerioId: ministerio })).toBe(true)
    expect(puede(usuario!, 'crear', 'prestamo', { ministerioId: ministerio })).toBe(false)
    expect(puede(usuario!, 'ver', 'evento', { ministerioId: ministerio + 1000 })).toBe(false)
  })

  it('una cuenta desactivada no inicia ni mantiene sesión', async () => {
    const id = await crearCuentaDePrueba({ etiqueta: 'inactiva', rol: 'Lobby', activo: false })
    expect(await buscarPorId(id)).toBeNull()
    expect(await buscarCredencial(`inactiva-${SUFIJO}@prueba.test`)).toBeNull()
  })

  it('el login busca el correo sin importar mayúsculas ni espacios y trae el hash', async () => {
    await crearCuentaDePrueba({ etiqueta: 'login', rol: 'Lobby' })
    const credencial = await buscarCredencial(`  LOGIN-${SUFIJO}@Prueba.Test `)
    expect(credencial).not.toBeNull()
    expect(credencial!.contrasenaHash).toBeTruthy()
    expect(await buscarCredencial('nadie@prueba.test')).toBeNull()
  })

  it('un correo no se puede repetir (índice único)', async () => {
    await crearCuentaDePrueba({ etiqueta: 'duplicada', rol: 'Lobby' })
    await expect(crearCuentaDePrueba({ etiqueta: 'duplicada', rol: 'Lobby' })).rejects.toThrow()
  })
})
