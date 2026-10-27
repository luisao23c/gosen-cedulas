#!/usr/bin/env node
/**
 * Crea (o recrea) la base de datos de desarrollo: esquema + datos de prueba.
 *
 *   npm run db:setup
 *
 * ⚠️  Borra las tablas existentes. Es una herramienta de DESARROLLO.
 * Usa la misma base de datos MySQL que la aplicación (ver .env.local).
 *
 * Para una base REAL (producción) define ADMIN_CONTRASENA (y opcionalmente ADMIN_EMAIL y
 * ADMIN_NOMBRE): en lugar de los datos de prueba crea solo ese administrador. Ver DESPLIEGUE.md.
 */

import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import mysql from 'mysql2/promise'
import { hashContrasena } from '../src/lib/auth/contrasenas.ts'
import { asegurarRolesBase } from './roles-base.mjs'

const RUTA = dirname(fileURLToPath(import.meta.url))

const REMOTA = process.env.DB_REMOTA === 'true'
const SSL = process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined

const CONFIG = {
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PUERTO ?? 3306),
  // MySQL propio: root crea la base y el usuario. Base remota: la cuenta que da el proveedor.
  user: REMOTA ? (process.env.DB_USUARIO ?? 'gosen') : (process.env.DB_USUARIO_ROOT ?? 'root'),
  password: REMOTA ? (process.env.DB_CONTRASENA ?? '') : (process.env.DB_CONTRASENA_ROOT ?? ''),
  database: process.env.DB_NOMBRE ?? 'gosen',
  ...(SSL ? { ssl: SSL } : {}),
}

const USUARIO_APP = process.env.DB_USUARIO ?? 'gosen'
const CLAVE_APP = process.env.DB_CONTRASENA ?? 'gosen_dev'

function log(...args) {
  console.log('[db:setup]', ...args)
}

/** ADMIN_CONTRASENA (instalación limpia) se valida ANTES de abrir ninguna conexión: así un error no deja el proceso colgado. */
function validarContrasenaAdmin(clave) {
  if (clave.length < 10 || !/\p{L}/u.test(clave) || !/\d/.test(clave)) {
    throw new Error('ADMIN_CONTRASENA necesita al menos 10 caracteres, con letras y números.')
  }
}

async function main() {
  if (process.env.ADMIN_CONTRASENA) validarContrasenaAdmin(process.env.ADMIN_CONTRASENA)
  log('conectando a', `${CONFIG.host}:${CONFIG.port}`)

  // 1) Base de datos y usuario de la aplicación (solo en MySQL propio).
  // En una base GESTIONADA (Aiven, TiDB…; DB_REMOTA=true) no hay root ni se crean usuarios: la base
  // ya existe y se conecta con la cuenta del proveedor (DB_USUARIO/DB_CONTRASENA) por TLS (DB_SSL=true).
  if (!REMOTA) {
    const raiz = await mysql.createConnection({
      host: CONFIG.host,
      port: CONFIG.port,
      user: CONFIG.user,
      password: CONFIG.password,
    })
    await raiz.query(
      `CREATE DATABASE IF NOT EXISTS \`${CONFIG.database}\`
         CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    // MySQL trata `gosen@localhost` y `gosen@'%'` como cuentas DISTINTAS: hay que
    // crear y conceder en las dos, o la app conectándose por localhost se queda
    // sin privilegios (no puede ni crear tablas en las migraciones).
    for (const host of ["'%'", "'localhost'"]) {
      await raiz.query(`CREATE USER IF NOT EXISTS ?@${host} IDENTIFIED BY ?`, [
        USUARIO_APP,
        CLAVE_APP,
      ])
      await raiz.query(`GRANT ALL PRIVILEGES ON \`${CONFIG.database}\`.* TO ?@${host}`, [USUARIO_APP])
    }
    await raiz.query('FLUSH PRIVILEGES')
    await raiz.end()
    log('base de datos y usuario de la aplicación listos')
  }

  // 2) Esquema (el archivo trae DROP + CREATE, así que reinicia todo)
  const conexion = await mysql.createConnection({ ...CONFIG, multipleStatements: true })
  await conexion.query(`SET FOREIGN_KEY_CHECKS = 0`)
  const esquema = await readFile(join(RUTA, '..', 'src', 'lib', 'db', 'esquema.sql'), 'utf8')
  await conexion.query(esquema)
  await conexion.query(`SET FOREIGN_KEY_CHECKS = 1`)
  log(
    'esquema aplicado (rol, rol_permiso, rama, celula, integrante, reunion, usuario,' +
      ' ministerio, equipo, prestamo, evento, servidor_evento)',
  )

  // Roles base: salen del catálogo de permisos de la aplicación
  const roles = await asegurarRolesBase(conexion)
  const rolAdmin = roles.get('Administrador')
  const rolLiderRama = roles.get('Líder de rama')
  const rolLiderCelula = roles.get('Líder de célula')
  const rolLobby = roles.get('Lobby')
  const rolEncargadoMinisterio = roles.get('Encargado de ministerio')
  const rolServidorMinisterio = roles.get('Servidor de ministerio')
  log('roles base creados:', [...roles.keys()].join(', '))

  // 3a) Instalación limpia (producción): solo el administrador, con la contraseña que tú elijas.
  // Los datos de prueba de abajo crean cuentas con contraseñas CONOCIDAS (están en este archivo y en
  // el repositorio): en una base pública cualquiera podría entrar con ellas.
  if (process.env.ADMIN_CONTRASENA) {
    const clave = process.env.ADMIN_CONTRASENA
    const correo = (process.env.ADMIN_EMAIL ?? 'admin@gosen.local').trim().toLowerCase()
    await conexion.query(
      `INSERT INTO usuario (email, nombre, contrasena_hash, rol_id) VALUES (?, ?, ?, ?)`,
      [correo, process.env.ADMIN_NOMBRE ?? 'Administrador', await hashContrasena(clave), rolAdmin],
    )
    await conexion.end()
    log('')
    log(`Instalación limpia: un solo administrador (${correo}) con la contraseña de ADMIN_CONTRASENA.`)
    log('Sin datos de prueba. Crea ramas, células y cuentas desde la aplicación.')
    return
  }

  // 3b) Datos de prueba — reutiliza el hasheador de la aplicación
  const hashAdmin = await hashContrasena('Admin1234!')
  const hashLider = await hashContrasena('Lider1234!')

  const [ramas] = await conexion.query(
    `INSERT INTO rama (nombre, descripcion) VALUES (?, ?), (?, ?)`,
    [
      'Rama Norte',
      'Zona norte de la ciudad',
      'Rama Sur',
      'Zona sur de la ciudad',
    ],
  )
  const ramaNorte = ramas.insertId
  const ramaSur = ramas.insertId + 1

  // Cada célula con su punto en el mapa: el registro por ubicación (lobby)
  // ordena estas células por cercanía a donde vive la persona.
  const [celulas] = await conexion.query(
    `INSERT INTO celula (rama_id, nombre, dia_semana, hora, latitud, longitud, direccion) VALUES
       (?, 'Célula 1', 3, '19:00', 25.5439000, -103.4069000, 'Av. Hidalgo 200, Centro, Torreón, Coahuila'),
       (?, 'Célula 2', 5, '18:30', 25.5610000, -103.4300000, 'Blvd. Independencia 1200, Torreón Jardín, Torreón, Coahuila'),
       (?, 'Célula 3', 6, '17:00', 25.5250000, -103.4200000, 'Calzada Colón 800, Nueva Los Ángeles, Torreón, Coahuila')`,
    [ramaNorte, ramaNorte, ramaSur],
  )
  const celula1 = celulas.insertId
  const celula3 = celulas.insertId + 2

  await conexion.query(
    `INSERT INTO integrante
       (celula_id, nombre, apellido_paterno, apellido_materno, fecha_nacimiento,
        latitud, longitud, direccion, origen_ciudad, origen_estado,
        hizo_encuentro, fecha_encuentro, bautizado, fecha_bautizo, situacion, telefono)
     VALUES
       (?, 'María', 'Hernández', 'López', '1990-03-14', 25.5450000, -103.4100000,
        'Zaragoza 150, Centro, Torreón, Coahuila',
        'Saltillo', 'Coahuila', 1, '2015-06-20', 1, '2016-02-10', 'ACTIVO', '8710000000'),
       (?, 'José', 'Martínez', NULL, '1985-11-02', 25.5410000, -103.4020000,
        'Matamoros 400, Centro, Torreón, Coahuila',
        NULL, NULL, 0, NULL, 0, NULL, 'VISITANTE', NULL),
       (?, 'Ana', 'García', 'Ruiz', '2001-07-30', NULL, NULL, NULL,
        NULL, NULL, 1, '2019-09-15', 0, NULL, 'ACTIVO', NULL)`,
    [celula1, celula1, celula3],
  )

  // Ministerio de prueba: inventario, un préstamo abierto y un evento con
  // servidores asignados (para poder ver el módulo completo desde el inicio).
  const [ministerios] = await conexion.query(
    `INSERT INTO ministerio (nombre, descripcion) VALUES (?, ?)`,
    ['Cámaras', 'Equipo de cámaras: graba y transmite los servicios y eventos.'],
  )
  const ministerioCamaras = ministerios.insertId

  const [equipos] = await conexion.query(
    `INSERT INTO equipo (ministerio_id, nombre, descripcion, estatus) VALUES
       (?, 'Cámara principal', 'Cámara del púlpito, con su batería', 'DISPONIBLE'),
       (?, 'Tripié', NULL, 'DISPONIBLE'),
       (?, 'Micrófono de solapa', 'Se usa en las predicaciones', 'MANTENIMIENTO')`,
    [ministerioCamaras, ministerioCamaras, ministerioCamaras],
  )
  const equipoCamara = equipos.insertId

  const [usuarios] = await conexion.query(
    `INSERT INTO usuario (email, nombre, contrasena_hash, rol_id, rama_id, celula_id, ministerio_id) VALUES
       (?, 'Administrador',            ?, ?, NULL, NULL, NULL),
       (?, 'Líder de rama',            ?, ?, ?,    NULL, NULL),
       (?, 'Líder de célula',          ?, ?, ?,    ?,    NULL),
       (?, 'Lobby',                    ?, ?, NULL, NULL, NULL),
       (?, 'Encargado de cámaras',     ?, ?, NULL, NULL, ?),
       (?, 'Servidor de cámaras',      ?, ?, NULL, NULL, ?)`,
    [
      'admin@gosen.local', hashAdmin, rolAdmin,
      'norte@gosen.local', hashLider, rolLiderRama, ramaNorte,
      'celula1@gosen.local', hashLider, rolLiderCelula, ramaNorte, celula1,
      'lobby@gosen.local', hashLider, rolLobby,
      'camaras@gosen.local', hashLider, rolEncargadoMinisterio, ministerioCamaras,
      'servidor@gosen.local', hashLider, rolServidorMinisterio, ministerioCamaras,
    ],
  )
  const adminId = usuarios.insertId
  const liderRamaId = usuarios.insertId + 1
  const liderCelulaId = usuarios.insertId + 2
  const encargadoCamarasId = usuarios.insertId + 4
  const servidorCamarasId = usuarios.insertId + 5

  await conexion.query(`UPDATE ministerio SET encargado_id = ? WHERE id = ?`, [
    encargadoCamarasId,
    ministerioCamaras,
  ])

  // Préstamo abierto: la cámara salió con el encargado y está asignada al
  // servidor. `devuelto_en` queda en NULL hasta que alguien la reciba.
  await conexion.query(
    `INSERT INTO prestamo (equipo_id, responsable_id, asignado_a_id, recogido_en, estado_entrega, notas)
     VALUES (?, ?, ?, NOW(), 'BUENO', 'Sale para el culto del domingo')`,
    [equipoCamara, encargadoCamarasId, servidorCamarasId],
  )
  await conexion.query(`UPDATE equipo SET estatus = 'PRESTADO' WHERE id = ?`, [equipoCamara])

  // Evento del próximo domingo: los servidores tienen que estar 30 minutos
  // antes del servicio (con eso se sabe quién llegó a tiempo).
  const hoy = new Date()
  const diasAlDomingo = (7 - hoy.getDay()) % 7 || 7
  const domingo = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + diasAlDomingo)
  const fechaDomingo = `${domingo.getFullYear()}-${String(domingo.getMonth() + 1).padStart(2, '0')}-${String(domingo.getDate()).padStart(2, '0')}`

  const [eventos] = await conexion.query(
    `INSERT INTO evento
       (ministerio_id, nombre, descripcion, fecha, hora_llegada,
        latitud, longitud, direccion, creado_por_id)
     VALUES (?, 'Culto dominical', 'Transmisión en vivo del servicio', ?, '09:30',
             25.5439000, -103.4069000, 'Av. Hidalgo 200, Centro, Torreón, Coahuila', ?)`,
    [ministerioCamaras, fechaDomingo, encargadoCamarasId],
  )
  await conexion.query(
    `INSERT INTO servidor_evento (evento_id, usuario_id) VALUES (?, ?), (?, ?)`,
    [eventos.insertId, encargadoCamarasId, eventos.insertId, servidorCamarasId],
  )

  await conexion.query(`UPDATE rama SET lider_id = ? WHERE id = ?`, [liderRamaId, ramaNorte])
  await conexion.query(`UPDATE celula SET lider_id = ? WHERE id = ?`, [liderCelulaId, celula1])
  await conexion.query(`UPDATE celula SET lider_id = NULL WHERE id = ?`, [celula3])
  await conexion.query(`UPDATE rama SET lider_id = ? WHERE id = ? AND lider_id IS NULL`, [
    adminId,
    ramaSur,
  ])
  await conexion.end()

  log('')
  log('Datos de prueba creados. Cuentas para iniciar sesión:')
  log('  Administrador   admin@gosen.local      Admin1234!')
  log('  Líder de rama   norte@gosen.local      Lider1234!')
  log('  Líder de célula celula1@gosen.local    Lider1234!')
  log('  Lobby           lobby@gosen.local      Lider1234!')
  log('  Encargado min.  camaras@gosen.local    Lider1234!')
  log('  Servidor min.   servidor@gosen.local   Lider1234!')
  log('')
  log('⚠️  Solo para desarrollo. Cambia estas contraseñas antes de publicar.')
}

main().catch((error) => {
  console.error('[db:setup] error:', error.message)
  // Una conexión abierta mantendría el proceso vivo para siempre: se termina a la fuerza
  process.exit(1)
})
