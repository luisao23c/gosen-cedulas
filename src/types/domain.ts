/**
 * Tipos del dominio del proyecto.
 * Regla: aquí viven los tipos de negocio; no se duplican en cada feature.
 */

import type { Alcance } from '@/lib/auth/catalogo'

export type { Alcance }

/**
 * Rol: un conjunto de permisos con un alcance. Los crean los administradores
 * desde la interfaz (tabla `rol`); ya no es una lista fija en el código.
 */
export interface Rol {
  id: number
  nombre: string
  descripcion: string | null
  alcance: Alcance
  /** Rol protegido (Administrador): siempre tiene todos los permisos */
  esSistema: boolean
  /** Permisos «recurso:accion» que concede el rol */
  permisos: string[]
}

/** Rol con cuántas cuentas lo usan, para el listado de roles. */
export interface RolConUso extends Rol {
  totalUsuarios: number
}

/** Cuenta tal como se muestra en listados (sin la lista de permisos). */
export interface UsuarioListado {
  id: number
  email: string
  nombre: string
  rolId: number
  rolNombre: string
  alcance: Alcance
  /** Su rol es el protegido de sistema (Administrador) */
  esAdmin: boolean
  /** Rama asignada cuando el rol tiene alcance RAMA */
  ramaId: number | null
  /** Célula asignada cuando el rol tiene alcance CELULA */
  celulaId: number | null
  /** Ministerio asignado cuando el rol tiene alcance MINISTERIO */
  ministerioId: number | null
  activo: boolean
}

/**
 * Usuario autenticable, con los permisos efectivos de su rol ya resueltos.
 * Una persona NO es un usuario: puede no tener cuenta.
 */
export interface Usuario extends UsuarioListado {
  /** Permisos efectivos «recurso:accion» (ver lib/auth/permisos.ts) */
  permisos: string[]
}

/** Unidad superior de la organización. Tiene varias células. */
export interface Rama {
  id: number
  nombre: string
  descripcion: string | null
  /** Usuario líder de la rama (rol con alcance de rama u organización) */
  liderId: number | null
  activa: boolean
  creadoEn: string
}

/**
 * Punto marcado en el mapa. La dirección la aporta el geocodificador inverso
 * cuando el servicio responde; las coordenadas son lo que siempre se guarda.
 */
export interface Ubicacion {
  latitud: number | null
  longitud: number | null
  direccion: string | null
}

/** Unidad operativa dentro de una rama. Sus integrantes se le pasan lista. */
export interface Celula {
  id: number
  ramaId: number
  nombre: string
  /** Usuario líder de la célula (rol con alcance de célula) */
  liderId: number | null
  /** 0 = domingo … 6 = sábado. null sin día fijo */
  diaSemana: number | null
  /** Hora de reunión en formato HH:MM */
  hora: string | null
  /** Dónde se reúne: punto del mapa + dirección aproximada */
  ubicacion: Ubicacion
  activa: boolean
  creadoEn: string
}

/**
 * Situación de un integrante dentro de su célula.
 * Es la pertenencia, no confundir con el estado de «de dónde es».
 */
export const SITUACIONES = ['ACTIVO', 'VISITANTE', 'INACTIVO', 'EGRESADO'] as const
export type SituacionIntegrante = (typeof SITUACIONES)[number]

export const ETIQUETAS_SITUACION: Record<SituacionIntegrante, string> = {
  ACTIVO: 'Activo',
  VISITANTE: 'Visitante',
  INACTIVO: 'Inactivo',
  EGRESADO: 'Egresado',
}

/** De dónde es: dos campos para poder agrupar por estado. */
export interface OrigenIntegrante {
  ciudad: string | null
  estado: string | null
}

/**
 * Persona inscrita en una célula. NO es una cuenta de acceso
 * (esa es `Usuario`): puede existir sin saber usar la aplicación.
 */
export interface Integrante {
  id: number
  /** Un integrante pertenece a UNA sola célula a la vez */
  celulaId: number
  nombre: string
  apellidoPaterno: string
  apellidoMaterno: string | null
  /** Fecha ISO (YYYY-MM-DD); se usa para cumpleaños, ignorando el año */
  fechaNacimiento: string | null
  /** Dónde vive: punto del mapa + dirección aproximada */
  ubicacion: Ubicacion
  origen: OrigenIntegrante
  hizoEncuentro: boolean
  fechaEncuentro: string | null
  bautizado: boolean
  fechaBautizo: string | null
  situacion: SituacionIntegrante
  telefono: string | null
  notas: string | null
  creadoEn: string
  actualizadoEn: string | null
}

/* ── Asistencia ─────────────────────────────────────────────── */

/** Cómo le fue a un integrante en una reunión. */
export const ESTADOS_ASISTENCIA = ['PRESENTE', 'AUSENTE', 'TARDANZA', 'JUSTIFICADO'] as const
export type EstadoAsistencia = (typeof ESTADOS_ASISTENCIA)[number]

export const ETIQUETAS_ASISTENCIA: Record<EstadoAsistencia, string> = {
  PRESENTE: 'Presente',
  AUSENTE: 'Ausente',
  TARDANZA: 'Tardanza',
  JUSTIFICADO: 'Justificado',
}

/** Reunión de una célula en una fecha concreta (una por día y célula). */
export interface Reunion {
  id: number
  celulaId: number
  /** Fecha ISO corta (AAAA-MM-DD) */
  fecha: string
  creadoEn: string
}

/** Asistencia de un integrante a una reunión. */
export interface Asistencia {
  integranteId: number
  estado: EstadoAsistencia
}

/** Nombre completo listo para mostrar y buscar. */
export function nombreCompleto(integrante: Pick<Integrante, 'nombre' | 'apellidoPaterno' | 'apellidoMaterno'>): string {
  return [integrante.nombre, integrante.apellidoPaterno, integrante.apellidoMaterno]
    .filter((parte): parte is string => Boolean(parte))
    .join(' ')
}

/* ── Ministerio: equipos, préstamos y eventos de servicio ──────
   Un ministerio (cámaras, alabanza, sonido…) cruza las ramas: por eso su
   alcance es aparte y no cuelga de una rama ni de una célula.
   ────────────────────────────────────────────────────────────── */

/** Área de servicio de la iglesia. */
export interface Ministerio {
  id: number
  nombre: string
  descripcion: string | null
  /** Cuenta que lleva el ministerio */
  encargadoId: number | null
  activo: boolean
  creadoEn: string
}

/** En qué estado está un equipo del inventario. */
export const ESTATUS_EQUIPO = [
  'DISPONIBLE',
  'PRESTADO',
  'MANTENIMIENTO',
  'BAJA',
] as const
export type EstatusEquipo = (typeof ESTATUS_EQUIPO)[number]

export const ETIQUETAS_ESTATUS_EQUIPO: Record<EstatusEquipo, string> = {
  DISPONIBLE: 'Disponible',
  PRESTADO: 'Prestado',
  MANTENIMIENTO: 'En mantenimiento',
  BAJA: 'Fuera de servicio',
}

/** Un equipo del inventario de un ministerio. */
export interface Equipo {
  id: number
  ministerioId: number
  nombre: string
  descripcion: string | null
  estatus: EstatusEquipo
  /** Hay un préstamo sin devolver (se deduce del historial, no se guarda aparte) */
  prestado: boolean
  creadoEn: string
}

/** Cómo salió o cómo volvió un equipo. */
export const CONSERVACIONES = ['BUENO', 'CON_DETALLE', 'DANADO'] as const
export type ConservacionEquipo = (typeof CONSERVACIONES)[number]

export const ETIQUETAS_CONSERVACION: Record<ConservacionEquipo, string> = {
  BUENO: 'Buen estado',
  CON_DETALLE: 'Con algún detalle',
  DANADO: 'Dañado',
}

/**
 * Préstamo de un equipo: quién lo trae, a quién se le asignó, cuándo salió y
 * cuándo y cómo volvió. Mientras `devueltoEn` sea null, el equipo está fuera.
 */
export interface Prestamo {
  id: number
  equipoId: number
  ministerioId: number
  /** Quién trae el equipo (responde por él) */
  responsableId: number
  /** A quién se le asignó el equipo; puede ser la misma persona */
  asignadoAId: number | null
  /** Evento para el que sale el equipo (opcional) */
  eventoId: number | null
  /** Cuándo salió y cuándo volvió (ISO con hora) */
  prestadoEn: string
  /** Cuándo confirmó quien lo lleva que ya lo recogió (null = todavía por recoger) */
  recogidoEn: string | null
  /** Cuándo avisó quien lo trae que ya lo devolvió (falta que el ministerio lo reciba) */
  devolucionAvisadaEn: string | null
  /** Cómo dice quien lo trae que lo devuelve */
  estadoDevolucionAvisado: ConservacionEquipo | null
  devueltoEn: string | null
  /** Cómo salió y cómo volvió */
  estadoEntrega: ConservacionEquipo
  estadoDevolucion: ConservacionEquipo | null
  notas: string | null
  /** Cuenta que registró el préstamo */
  registradoPorId: number | null
  /* Nombres resueltos por JOIN, solo para pintar listados */
  nombreEquipo?: string | null
  nombreResponsable?: string | null
  nombreAsignado?: string | null
  nombreMinisterio?: string | null
  nombreEvento?: string | null
}

/** Evento en el que sirve el ministerio (culto, campaña, boda…). */
export interface Evento {
  id: number
  ministerioId: number
  nombre: string
  descripcion: string | null
  /** Fecha ISO corta (AAAA-MM-DD) */
  fecha: string
  /** Hora a la que deben estar (HH:MM); sirve para saber si llegaron a tiempo */
  horaLlegada: string | null
  /** Dónde tienen que estar: punto del mapa + dirección */
  ubicacion: Ubicacion
  activo: boolean
  creadoEn: string
  nombreMinisterio?: string | null
}

/**
 * Turno: un servidor asignado a un evento.
 * `confirmado` es «sí voy»; `llegoEn` es «ya estoy aquí», con el punto donde se
 * marcó. Confirmar y checar el propio turno no piden permiso: lo autoriza la
 * asignación (el servidor comprueba que el turno sea tuyo).
 */
export interface TurnoEvento {
  id: number
  eventoId: number
  usuarioId: number
  /** Rol que cumple en este evento («Cámara 1», «Switcher»); null = sin definir */
  funcion: string | null
  confirmado: boolean
  confirmadoEn: string | null
  /** A qué hora llegó (ISO con hora) */
  llegoEn: string | null
  /** Dónde marcó la llegada (punto del mapa + dirección) */
  ubicacion: Ubicacion
  /** Quién registró la llegada: él mismo o el encargado del evento */
  registradoPorId: number | null
  /** Nombre del servidor, resuelto por JOIN para los listados */
  nombreUsuario?: string | null
}

/* ── Campos diferenciadores de las células ────────────────────────── */

/** Forma de la respuesta de un campo del catálogo. */
export const TIPOS_CAMPO = ['SELECT', 'RANGO'] as const
export type TipoCampo = (typeof TIPOS_CAMPO)[number]

export const ETIQUETAS_TIPO_CAMPO: Record<TipoCampo, string> = {
  SELECT: 'Opciones para elegir',
  RANGO: 'Número dentro de un rango',
}

/** Una opción elegible de un campo SELECT («Soltero», «Casado»…). */
export interface OpcionCampo {
  id: number
  campoId: number
  etiqueta: string
}

/** Campo del catálogo: la pregunta con la que una célula dice a quién le sirve. */
export interface CampoDiferenciador {
  id: number
  nombre: string
  tipo: TipoCampo
  descripcion: string | null
  /** Solo RANGO: qué mide («años», «cm»…) */
  unidad: string | null
  /** Solo RANGO: límites admitidos al responder */
  limiteInferior: number | null
  limiteSuperior: number | null
  activo: boolean
  orden: number
  /** Solo SELECT */
  opciones: OpcionCampo[]
}

/** Qué respondió una persona a un campo (Lobby o ficha del integrante). */
export interface RespuestaCampo {
  campoId: number
  /** Para SELECT */
  opcionId: number | null
  /** Para RANGO */
  valor: number | null
}

/** Qué respuestas le sirven a una célula sobre un campo. */
export interface CriterioCelula {
  celulaId: number
  campoId: number
  /** Si no se cumple, la célula no se recomienda */
  obligatorio: boolean
  /** Solo RANGO: intervalo admitido (null = sin límite por ese lado) */
  minimo: number | null
  maximo: number | null
  /** Solo SELECT: opciones aceptadas */
  opcionIds: number[]
}

/** Resultado de comparar una candidata contra las respuestas de la persona. */
export interface EvaluacionCelula {
  celulaId: number
  /** ¿Cumple todos los criterios obligatorios? */
  apta: boolean
  obligatorios: { cumplidos: number; total: number }
  preferencias: { cumplidos: number; total: number }
  /** Etiquetas de lo que cumple y de lo que le falta (el motivo de la recomendación) */
  cumplidos: string[]
  faltantes: string[]
  /** De los que faltan, los que son OBLIGATORIOS (son los que la descartan) */
  faltantesObligatorios: string[]
}

/** Puntaje de recomendación de una célula para una persona (ver `puntuarCandidata`). */
export interface PuntajeCandidata {
  /** 0–100: qué tan bien le queda la célula (criterios + cercanía) */
  puntaje: number
  /** 0–1: fracción de criterios cumplidos (las obligatorias pesan el doble) */
  porCriterios: number
  /** 0–1: qué tan cerca está (1 = a la vuelta, 0 = muy lejos); null si no hay punto */
  porCercania: number | null
}

/** Días de la semana en español indexados igual que `diaSemana`. */
export const DIAS_SEMANA = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const
