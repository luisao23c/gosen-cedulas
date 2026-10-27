/**
 * ★ CATÁLOGO DE PERMISOS ★
 *
 * Lista cerrada de lo que PUEDE existir como permiso en el sistema: qué
 * recursos hay y qué acciones admite cada uno. Los ROLES (creados por los
 * administradores desde la interfaz) son combinaciones de estos permisos y
 * viven en la base de datos (tablas `rol` y `rol_permiso`).
 *
 * Este archivo no importa nada del proyecto a propósito: lo usan también los
 * scripts de base de datos (`scripts/*.mjs`), que no entienden el alias `@/`.
 *
 * Para añadir una capacidad nueva (p. ej. el recurso «integrante» cuando
 * exista su pantalla) se declara aquí y aparece sola en el editor de roles.
 */

/**
 * Recursos sobre los que se actúa.
 * Los cuatro primeros de la segunda tanda son del trabajo por ministerio
 * (equipos, préstamos y eventos de servicio) y `campo` del catálogo de campos
 * diferenciadores: viven en el mismo catálogo porque los roles son los mismos
 * para toda la aplicación.
 */
export const RECURSOS = [
  'rama',
  'celula',
  'integrante',
  'asistencia',
  'usuario',
  'rol',
  'ministerio',
  'equipo',
  'prestamo',
  'evento',
  'campo',
] as const
export type Recurso = (typeof RECURSOS)[number]

/** Acciones posibles. No todas aplican a todos los recursos (ver CATALOGO). */
export const ACCIONES = [
  'ver',
  'crear',
  'editar',
  'eliminar',
  'pasarLista',
  'asignar',
  'checar',
] as const
export type Accion = (typeof ACCIONES)[number]

/** Un permiso es «recurso:accion», p. ej. `celula:editar`. */
export type Permiso = `${Recurso}:${Accion}`

/**
 * Alcance de un rol: hasta dónde llegan sus permisos en la organización.
 *  · ORGANIZACION → toda la organización
 *  · RAMA         → solo la rama asignada a la cuenta
 *  · CELULA       → solo la célula asignada a la cuenta
 *  · MINISTERIO   → solo el ministerio asignado a la cuenta (equipos, préstamos
 *                   y eventos de servicio). Es un alcance aparte: los
 *                   ministerios cruzan las ramas, no cuelgan de una.
 */
export const ALCANCES = ['ORGANIZACION', 'RAMA', 'CELULA', 'MINISTERIO'] as const
export type Alcance = (typeof ALCANCES)[number]

export const ETIQUETAS_ALCANCE: Record<Alcance, string> = {
  ORGANIZACION: 'Toda la organización',
  RAMA: 'Una rama',
  CELULA: 'Una célula',
  MINISTERIO: 'Un ministerio',
}

/** Texto corto para listados («Su rama»). */
export const ALCANCE_CORTO: Record<Alcance, string> = {
  ORGANIZACION: 'Toda la organización',
  RAMA: 'Su rama',
  CELULA: 'Su célula',
  MINISTERIO: 'Su ministerio',
}

/** Explicación del alcance, para el editor de roles y el formulario de cuentas. */
export const DESCRIPCION_ALCANCE: Record<Alcance, string> = {
  ORGANIZACION: 'Ve y gestiona toda la organización.',
  RAMA: 'Solo ve y gestiona la rama que se asigne a cada cuenta.',
  CELULA: 'Solo ve y gestiona la célula que se asigne a cada cuenta.',
  MINISTERIO: 'Solo ve y gestiona el ministerio que se asigne a cada cuenta.',
}

/** Orden de amplitud: un rol no puede asignar alcances mayores que el propio. */
export const RANGO_ALCANCE: Record<Alcance, number> = {
  ORGANIZACION: 4,
  RAMA: 3,
  CELULA: 2,
  MINISTERIO: 1,
}

export const ETIQUETAS_ACCION: Record<Accion, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  pasarLista: 'Pasar lista',
  asignar: 'Asignar servidores',
  checar: 'Checar llegada',
}

interface DefinicionRecurso {
  etiqueta: string
  descripcion: string
  acciones: readonly Accion[]
}

/** Qué acciones admite cada recurso (y cómo se explica en el editor de roles). */
export const CATALOGO: Record<Recurso, DefinicionRecurso> = {
  rama: {
    etiqueta: 'Ramas',
    descripcion: 'Unidad superior de la organización.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  celula: {
    etiqueta: 'Células',
    descripcion: 'Grupos dentro de cada rama.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  integrante: {
    etiqueta: 'Integrantes',
    descripcion: 'Personas inscritas en una célula.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  asistencia: {
    etiqueta: 'Asistencia',
    descripcion: 'Pase de lista en cada reunión.',
    acciones: ['ver', 'pasarLista', 'editar'],
  },
  usuario: {
    etiqueta: 'Cuentas',
    descripcion: 'Cuentas de acceso a la aplicación.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  rol: {
    etiqueta: 'Roles y permisos',
    descripcion: 'Crear roles y decidir qué puede hacer cada uno.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  ministerio: {
    etiqueta: 'Ministerios',
    descripcion: 'Áreas de servicio de la iglesia (cámaras, alabanza, sonido…).',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  equipo: {
    etiqueta: 'Equipos',
    descripcion: 'Inventario de cada ministerio y el estatus de cada equipo.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  prestamo: {
    etiqueta: 'Préstamos',
    descripcion: 'Quién trae cada equipo, a quién se le asignó y en qué estado volvió.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
  evento: {
    etiqueta: 'Eventos de servicio',
    descripcion:
      'Fechas en las que sirve el ministerio: quién está asignado, quién confirmó y a qué hora llegó.',
    acciones: ['ver', 'crear', 'editar', 'eliminar', 'asignar', 'checar'],
  },
  campo: {
    etiqueta: 'Filtros',
    descripcion:
      'Preguntas del catálogo (estado civil, edad…) con las que cada célula dice a quién le sirve.',
    acciones: ['ver', 'crear', 'editar', 'eliminar'],
  },
}

/**
 * Permisos que SOLO pueden tener roles de alcance «toda la organización».
 * Gestionar cuentas o roles no tiene sentido (y es una vía de escalada de
 * privilegios) si el rol solo ve una rama o una célula.
 */
export const PERMISOS_SOLO_ORGANIZACION: ReadonlySet<string> = new Set<Permiso>([
  'usuario:crear',
  'usuario:editar',
  'usuario:eliminar',
  'rol:ver',
  'rol:crear',
  'rol:editar',
  'rol:eliminar',
  // El catálogo de ministerios y el alta de sus cuentas los lleva la
  // organización; dentro de un ministerio solo se ven sus propios datos.
  'ministerio:crear',
  'ministerio:editar',
  'ministerio:eliminar',
  // El catálogo de campos diferenciadores es de toda la organización: las
  // células solo declaran qué respuestas les sirven (con `campo:ver`).
  'campo:crear',
  'campo:editar',
  'campo:eliminar',
])

export function permiso(recurso: Recurso, accion: Accion): Permiso {
  return `${recurso}:${accion}`
}

/** Todos los permisos que existen en el catálogo. */
export function todosLosPermisos(): Permiso[] {
  return RECURSOS.flatMap((recurso) =>
    CATALOGO[recurso].acciones.map((accion) => permiso(recurso, accion)),
  )
}

const PERMISOS_CONOCIDOS: ReadonlySet<string> = new Set(todosLosPermisos())

export function esPermisoValido(texto: string): texto is Permiso {
  return PERMISOS_CONOCIDOS.has(texto)
}

export function esAlcanceValido(texto: string): texto is Alcance {
  return (ALCANCES as readonly string[]).includes(texto)
}

/** ¿Puede un rol con este alcance llevar este permiso? */
export function permisoCompatibleConAlcance(permisoTexto: string, alcance: Alcance): boolean {
  return alcance === 'ORGANIZACION' || !PERMISOS_SOLO_ORGANIZACION.has(permisoTexto)
}

/* ─────────────────────────────────────────────────────────────
   ROLES BASE
   Se crean al instalar (db:setup) o migrar (db:migrar-roles). Después son
   datos como cualquier otro: se pueden editar desde /panel/roles, salvo el
   Administrador, que está protegido para que la organización nunca se
   quede sin nadie capaz de gestionarla.
   ───────────────────────────────────────────────────────────── */

export interface RolBase {
  nombre: string
  descripcion: string
  alcance: Alcance
  /** Rol protegido: no se renombra, no se borra y siempre tiene todos los permisos. */
  esSistema: boolean
  permisos: Permiso[]
}

export const ROLES_BASE: RolBase[] = [
  {
    nombre: 'Administrador',
    descripcion: 'Gestiona toda la organización, las cuentas y los roles.',
    alcance: 'ORGANIZACION',
    esSistema: true,
    permisos: todosLosPermisos(),
  },
  {
    nombre: 'Líder de rama',
    descripcion: 'Gestiona las células e integrantes de su rama.',
    alcance: 'RAMA',
    esSistema: false,
    permisos: [
      'rama:ver',
      'celula:ver',
      'celula:crear',
      'celula:editar',
      'celula:eliminar',
      'integrante:ver',
      'integrante:crear',
      'integrante:editar',
      'asistencia:ver',
      'asistencia:pasarLista',
      'asistencia:editar',
      'usuario:ver',
    ],
  },
  {
    nombre: 'Líder de célula',
    descripcion: 'Gestiona los integrantes y el pase de lista de su célula.',
    alcance: 'CELULA',
    esSistema: false,
    permisos: [
      'rama:ver',
      'celula:ver',
      'integrante:ver',
      'integrante:crear',
      'integrante:editar',
      'asistencia:ver',
      'asistencia:pasarLista',
      'asistencia:editar',
    ],
  },
  {
    // Quien lleva un ministerio (cámaras, sonido, alabanza…): inventario,
    // préstamos, eventos y la lista de quién sirve en cada uno. Solo lo suyo.
    nombre: 'Encargado de ministerio',
    descripcion:
      'Lleva los equipos, los préstamos y los eventos de servicio de su ministerio, y arma la lista de quién sirve.',
    alcance: 'MINISTERIO',
    esSistema: false,
    permisos: [
      'ministerio:ver',
      'equipo:ver',
      'equipo:crear',
      'equipo:editar',
      'equipo:eliminar',
      'prestamo:ver',
      'prestamo:crear',
      'prestamo:editar',
      'prestamo:eliminar',
      'evento:ver',
      'evento:crear',
      'evento:editar',
      'evento:eliminar',
      'evento:asignar',
      'evento:checar',
    ],
  },
  {
    // Quien sirve en los eventos: ve lo suyo, confirma y marca su llegada.
    // Confirmar y checar el PROPIO turno no pide permiso: lo autoriza la
    // asignación (el servidor comprueba que el turno sea suyo). Por eso este
    // rol no lleva `evento:asignar` ni `evento:checar`.
    nombre: 'Servidor de ministerio',
    descripcion:
      'Ve los eventos de su ministerio, confirma su asistencia y marca su hora de llegada.',
    alcance: 'MINISTERIO',
    esSistema: false,
    permisos: ['ministerio:ver', 'equipo:ver', 'evento:ver'],
  },
  {
    // Quien recibe a la gente nueva: marca dónde vive y el sistema le ordena
    // las células por cercanía para que él decida en cuál se inscribe.
    // No edita ni da de baja: eso queda en manos de los líderes.
    nombre: 'Lobby',
    descripcion:
      'Registra personas nuevas: marca dónde viven y elige la célula más cercana entre las que se le proponen.',
    alcance: 'ORGANIZACION',
    esSistema: false,
    permisos: ['rama:ver', 'celula:ver', 'integrante:ver', 'integrante:crear'],
  },
]
