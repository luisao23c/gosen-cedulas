import { afterAll, describe, expect, it } from 'vitest'
import { anotarFallo, contarFallos, olvidarFallos } from '@/lib/db/intentos'
import { anotarFalloDeLogin, clavesDeLogin, loginBloqueado, olvidarFallosDeLogin } from '@/lib/auth/proteccion'
import { POLITICA_LOGIN } from '@/lib/auth/limite'
import { ejecutar, obtenerPool } from '@/lib/db/conexion'
import { baseLista, SUFIJO } from './base'

describe.skipIf(!baseLista)('límite de intentos de login · contra MySQL', () => {
  afterAll(async () => {
    await obtenerPool().end()
    globalThis.__poolGosen = undefined
  })

  it('cuenta solo los fallos de esa clave dentro de la ventana', async () => {
    const clave = `c:cuenta-${SUFIJO}@prueba.test`
    expect(await contarFallos(clave, 15)).toBe(0)

    await anotarFallo([clave, clave])
    await anotarFallo([`c:otra-${SUFIJO}@prueba.test`])
    expect(await contarFallos(clave, 15)).toBe(2)

    // Un fallo de hace una hora ya no cuenta en una ventana de 15 minutos
    await ejecutar(`INSERT INTO intento_login (clave, creado_en) VALUES (?, NOW() - INTERVAL 60 MINUTE)`, [clave])
    expect(await contarFallos(clave, 15)).toBe(2)
    expect(await contarFallos(clave, 120)).toBe(3)
  })

  it('olvidar los fallos deja la clave en cero', async () => {
    const clave = `c:olvido-${SUFIJO}@prueba.test`
    await anotarFallo([clave])
    await olvidarFallos(clave)
    expect(await contarFallos(clave, 15)).toBe(0)
  })

  it('anotar sin claves no hace nada', async () => {
    await expect(anotarFallo([])).resolves.toBeUndefined()
  })

  it('se bloquea al llegar al máximo de fallos del correo y se desbloquea al iniciar sesión bien', async () => {
    const claves = clavesDeLogin(`bloqueo-${SUFIJO}@prueba.test`, null)
    expect(await loginBloqueado(claves)).toBe(false)

    for (let intento = 1; intento < POLITICA_LOGIN.maxPorCorreo; intento++) {
      await anotarFalloDeLogin(claves)
      expect(await loginBloqueado(claves), `tras ${intento} fallos aún no debe bloquear`).toBe(false)
    }
    await anotarFalloDeLogin(claves)
    expect(await loginBloqueado(claves)).toBe(true)

    await olvidarFallosDeLogin(claves)
    expect(await loginBloqueado(claves)).toBe(false)
  })

  it('otro correo no se ve afectado por los fallos de este', async () => {
    const culpable = clavesDeLogin(`culpable-${SUFIJO}@prueba.test`, null)
    for (let intento = 0; intento < POLITICA_LOGIN.maxPorCorreo; intento++) await anotarFalloDeLogin(culpable)
    expect(await loginBloqueado(culpable)).toBe(true)
    expect(await loginBloqueado(clavesDeLogin(`inocente-${SUFIJO}@prueba.test`, null))).toBe(false)
  })

  it('muchos fallos desde la misma IP bloquean aunque los correos sean distintos', async () => {
    const ip = `198.51.100.${Number.parseInt(SUFIJO.slice(-2), 36) % 250}`
    await ejecutar(`DELETE FROM intento_login WHERE clave = ?`, [`i:${ip}`])
    for (let intento = 0; intento < POLITICA_LOGIN.maxPorIp; intento++) {
      await anotarFalloDeLogin(clavesDeLogin(`robot${intento}-${SUFIJO}@prueba.test`, ip))
    }
    expect(await loginBloqueado(clavesDeLogin(`nuevo-${SUFIJO}@prueba.test`, ip))).toBe(true)
    expect(await loginBloqueado(clavesDeLogin(`nuevo-${SUFIJO}@prueba.test`, null))).toBe(false)
    await ejecutar(`DELETE FROM intento_login WHERE clave = ?`, [`i:${ip}`])
  })
})
