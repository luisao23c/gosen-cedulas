import { describe, expect, it } from 'vitest'
import { DURACION_SEGUNDOS, crearToken, leerToken } from '@/lib/auth/token'
import { LARGO_MINIMO_SECRETO, SECRETO_DE_DESARROLLO, problemasDeEntorno, secretoSesion } from '@/lib/entorno'
import { POLITICA_LOGIN, estaBloqueado, ipDeCabeceras, mensajeDeBloqueo } from '@/lib/auth/limite'
import { clavesDeLogin } from '@/lib/auth/proteccion'
import { gastarTiempoDeVerificacion, hashContrasena, verificarContrasena } from '@/lib/auth/contrasenas'

const SECRETO = 'un-secreto-de-prueba-con-mas-de-treinta-y-dos-caracteres'
const AHORA = Date.UTC(2026, 9, 15, 12, 0, 0)

describe('token de sesión', () => {
  it('un token recién creado devuelve el id del usuario', () => {
    expect(leerToken(crearToken(42, SECRETO, AHORA), SECRETO, AHORA)).toBe(42)
  })

  it('caduca a los 7 días', () => {
    const token = crearToken(42, SECRETO, AHORA)
    const casi = AHORA + (DURACION_SEGUNDOS - 5) * 1000
    const despues = AHORA + (DURACION_SEGUNDOS + 5) * 1000
    expect(leerToken(token, SECRETO, casi)).toBe(42)
    expect(leerToken(token, SECRETO, despues)).toBeNull()
  })

  it('firmado con otro secreto no vale', () => {
    expect(leerToken(crearToken(42, 'otro-secreto-distinto-aunque-sea-largo-123456', AHORA), SECRETO, AHORA)).toBeNull()
  })

  it('cambiar el id para hacerse pasar por otra cuenta invalida la firma', () => {
    const [, caduca, firma] = crearToken(42, SECRETO, AHORA).split('.')
    expect(leerToken(`1.${caduca}.${firma}`, SECRETO, AHORA)).toBeNull()
  })

  it('alargar la caducidad invalida la firma', () => {
    const [id, , firma] = crearToken(42, SECRETO, AHORA).split('.')
    expect(leerToken(`${id}.99999999999.${firma}`, SECRETO, AHORA)).toBeNull()
  })

  it('basura, vacío y formas raras se rechazan sin lanzar errores', () => {
    for (const token of ['', 'abc', 'a.b', 'a.b.c.d', '..', '1.2.', 'x.y.z']) {
      expect(leerToken(token, SECRETO, AHORA)).toBeNull()
    }
  })
})

describe('secreto de sesión (falla cerrado en producción)', () => {
  const buenoDeProduccion = { NODE_ENV: 'production', SECRETO_SESION: SECRETO }

  it('en producción exige un secreto propio de 32+ caracteres', () => {
    expect(secretoSesion(buenoDeProduccion)).toBe(SECRETO)
    expect(() => secretoSesion({ NODE_ENV: 'production' })).toThrow(/SECRETO_SESION/)
    expect(() => secretoSesion({ NODE_ENV: 'production', SECRETO_SESION: '' })).toThrow()
    expect(() => secretoSesion({ NODE_ENV: 'production', SECRETO_SESION: 'x'.repeat(LARGO_MINIMO_SECRETO - 1) })).toThrow()
  })

  it('en producción rechaza el secreto de ejemplo que está en el repositorio', () => {
    expect(() => secretoSesion({ NODE_ENV: 'production', SECRETO_SESION: SECRETO_DE_DESARROLLO })).toThrow()
  })

  it('en desarrollo y en pruebas usa el de ejemplo si no hay otro', () => {
    expect(secretoSesion({ NODE_ENV: 'development' })).toBe(SECRETO_DE_DESARROLLO)
    expect(secretoSesion({ NODE_ENV: 'test' })).toBe(SECRETO_DE_DESARROLLO)
    expect(secretoSesion({ NODE_ENV: 'development', SECRETO_SESION: 'propio' })).toBe('propio')
  })

  it('el diagnóstico lista lo que está mal sin lanzar', () => {
    expect(problemasDeEntorno({ SECRETO_SESION: SECRETO, DB_CONTRASENA: 'real-y-larga', DB_HOST: '127.0.0.1' })).toEqual([])
    const malo = problemasDeEntorno({ DB_CONTRASENA: 'gosen_dev', DB_HOST: 'algo.aivencloud.com' })
    expect(malo).toHaveLength(3)
  })
})

describe('límite de intentos de login', () => {
  it('bloquea al llegar al máximo por correo o por IP', () => {
    expect(estaBloqueado({ porCorreo: POLITICA_LOGIN.maxPorCorreo - 1, porIp: 0 })).toBe(false)
    expect(estaBloqueado({ porCorreo: POLITICA_LOGIN.maxPorCorreo, porIp: 0 })).toBe(true)
    expect(estaBloqueado({ porCorreo: 0, porIp: POLITICA_LOGIN.maxPorIp - 1 })).toBe(false)
    expect(estaBloqueado({ porCorreo: 0, porIp: POLITICA_LOGIN.maxPorIp })).toBe(true)
  })

  it('el mensaje dice cuánto esperar', () => {
    expect(mensajeDeBloqueo()).toContain(String(POLITICA_LOGIN.ventanaMinutos))
  })

  it('la IP sale del primer valor de x-forwarded-for y se valida', () => {
    const con = (cabeceras: Record<string, string>) => ({ get: (nombre: string) => cabeceras[nombre] ?? null })
    expect(ipDeCabeceras(con({ 'x-forwarded-for': '203.0.113.9, 10.0.0.1' }))).toBe('203.0.113.9')
    expect(ipDeCabeceras(con({ 'x-real-ip': '2001:db8::1' }))).toBe('2001:db8::1')
    expect(ipDeCabeceras(con({}))).toBeNull() // sin IP no se cuenta por IP (no se mezcla a todos en un contador)
    expect(ipDeCabeceras(con({ 'x-forwarded-for': "1.1.1.1'; DROP TABLE usuario;--" }))).toBeNull()
    expect(ipDeCabeceras(con({ 'x-forwarded-for': 'a'.repeat(200) }))).toBeNull()
  })

  it('las claves llevan prefijo para no confundir un correo con una IP', () => {
    expect(clavesDeLogin('ana@gosen.test', '203.0.113.9')).toEqual({ correo: 'c:ana@gosen.test', ip: 'i:203.0.113.9' })
    expect(clavesDeLogin('ana@gosen.test', null).ip).toBeNull()
  })
})

describe('contraseñas', () => {
  it('verifica la correcta y rechaza la incorrecta', async () => {
    const guardada = await hashContrasena('Clave-De-Prueba-1')
    expect(await verificarContrasena('Clave-De-Prueba-1', guardada)).toBe(true)
    expect(await verificarContrasena('Clave-De-Prueba-2', guardada)).toBe(false)
  })

  it('el hash no repite aunque la contraseña sea la misma (sal propia)', async () => {
    expect(await hashContrasena('Clave-De-Prueba-1')).not.toBe(await hashContrasena('Clave-De-Prueba-1'))
  })

  it('un hash dañado o con otro formato se rechaza sin lanzar', async () => {
    for (const almacenada of ['', 'texto', 'bcrypt$a$b$c$d$e', 'scrypt$x$y$z$a$b', 'scrypt$16384$8$1$$']) {
      expect(await verificarContrasena('lo-que-sea', almacenada)).toBe(false)
    }
  })

  it('el hash de mentira cuesta lo mismo que uno real (no delata si el correo existe)', async () => {
    const real = await hashContrasena('Clave-De-Prueba-1')
    const medir = async (trabajo: () => Promise<unknown>) => {
      const inicio = performance.now()
      await trabajo()
      return performance.now() - inicio
    }
    const conHashReal = await medir(() => verificarContrasena('otra', real))
    const conHashFalso = await medir(() => gastarTiempoDeVerificacion('otra'))
    // Mismo orden de magnitud (scrypt N=16384): sin el hash falso, el correo inexistente respondería casi al instante
    expect(conHashFalso).toBeGreaterThan(conHashReal * 0.3)
  })
})
