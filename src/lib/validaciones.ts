import { z } from 'zod'
import { ALCANCES, esPermisoValido } from '@/lib/auth/catalogo'
import {
  CONSERVACIONES,
  ESTADOS_ASISTENCIA,
  ESTATUS_EQUIPO,
  SITUACIONES,
  TIPOS_CAMPO,
} from '@/types/domain'

/**
 * Validación de todo lo que entra desde el cliente.
 * Los server actions vuelven a comprobar permisos: validar no es autorizar.
 */

/** Las fechas/horas llegan como texto desde los formularios. */
const vacioANulo = (valor: unknown): unknown =>
  valor === '' || valor === undefined ? null : valor

/**
 * FormData entrega SIEMPRE texto: un id llega como '3' y lo vacío como ''.
 * Este preprocess deja lo vacío en null y convierte '3' en 3 antes de validar
 * (sin él, `z.number()` rechazaría cualquier id de formulario).
 */
const aNumeroONulo = (valor: unknown): unknown => {
  if (valor === '' || valor === undefined || valor === null) return null
  if (typeof valor === 'string') {
    const limpio = valor.trim()
    return /^-?\d+$/.test(limpio) ? Number(limpio) : limpio
  }
  return valor
}

export const numeroOpcional = z.preprocess(
  aNumeroONulo,
  z
    .number({ message: 'Valor numérico no válido' })
    .int({ message: 'Debe ser un número entero' })
    .nullable(),
)

/**
 * Casilla o interruptor: en el FormData llega `'on'` cuando está marcado y
 * nada cuando no. Sin esto, `z.coerce.boolean()` convertiría `'false'` en true.
 */
export const booleano = z.preprocess(
  (valor) => valor === 'on' || valor === 'true' || valor === '1' || valor === 1 || valor === true,
  z.boolean(),
)

/** Hora del día (HH:MM) o vacío → null (p. ej. la hora de llegada de un evento). */
export const horaOpcional = z.preprocess(
  vacioANulo,
  z
    .string({ message: 'Hora no válida' })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora debe tener formato HH:MM' })
    .nullable(),
)

/** Fecha de calendario (AAAA-MM-DD) o vacío → null. */
export const fechaOpcional = z.preprocess(
  vacioANulo,
  z
    .string({ message: 'Fecha no válida' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato AAAA-MM-DD' })
    .nullable(),
)

/**
 * Coordenada opcional del mapa: en el formulario llega como texto (el campo
 * de solo lectura) y lo vacío significa «sin marcar».
 */
const coordenada = (minimo: number, maximo: number, mensaje: string) =>
  z.preprocess(
    (valor) => {
      if (valor === '' || valor === undefined || valor === null) return null
      const numero = typeof valor === 'number' ? valor : Number(valor)
      // Si no es un número, se deja pasar tal cual para que Zod dé el error.
      return Number.isFinite(numero) ? numero : valor
    },
    z.number({ message: mensaje }).min(minimo, { message: mensaje }).max(maximo, { message: mensaje }).nullable(),
  )

export const latitudOpcional = coordenada(-90, 90, 'La latitud no es válida (entre -90 y 90)')
export const longitudOpcional = coordenada(-180, 180, 'La longitud no es válida (entre -180 y 180)')

/** Id obligatorio que llega como texto desde un desplegable o un campo oculto. */
export const idRequerido = (mensaje: string) =>
  z.preprocess(
    aNumeroONulo,
    z.number({ message: mensaje }).int({ message: mensaje }).positive({ message: mensaje }),
  )

export const textoOpcional = (limite: number) =>
  z.preprocess(
    vacioANulo,
    z.string({ message: 'Debe ser texto' }).trim().max(limite, { message: `Máximo ${limite} caracteres` }).nullable(),
  )

const email = z
  .string({ message: 'Falta el correo' })
  .trim()
  .min(5, { message: 'Correo demasiado corto' })
  .max(190, { message: 'Correo demasiado largo' })
  .refine((valor) => /.+@.+\..+/.test(valor), { message: 'Correo no válido' })
  .transform((valor) => valor.toLowerCase())

/** Contraseña nueva: 10 caracteres o más, con letras y números. (El login no la exige: las cuentas viejas siguen entrando.) */
const clave = z
  .string({ message: 'Falta la contraseña' })
  .min(10, { message: 'La contraseña necesita al menos 10 caracteres' })
  .max(200, { message: 'Contraseña demasiado larga' })
  .refine((valor) => /\p{L}/u.test(valor) && /\d/.test(valor), {
    message: 'La contraseña debe combinar letras y números',
  })

const nombrePropio = z
  .string({ message: 'Falta el nombre' })
  .trim()
  .min(3, { message: 'Escribe al menos 3 caracteres' })
  .max(120, { message: 'Máximo 120 caracteres' })

export const esquemaLogin = z.object({
  email,
  contrasena: z.string({ message: 'Falta la contraseña' }).min(1, { message: 'Falta la contraseña' }),
})

export const esquemaRama = z.object({
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
})

export const esquemaRamaEdicion = z.object({
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
  liderId: numeroOpcional,
  activa: z.coerce.boolean(),
})

export const esquemaCelula = z.object({
  ramaId: z.preprocess(
    aNumeroONulo,
    z
      .number({ message: 'Falta la rama' })
      .int()
      .positive({ message: 'Rama no válida' }),
  ),
  nombre: nombrePropio,
  diaSemana: numeroOpcional,
  hora: z.preprocess(
    vacioANulo,
    z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora debe tener formato HH:MM' })
      .nullable(),
  ),
  // Ubicación: el punto que se marca en el mapa y la dirección que se obtiene
  latitud: latitudOpcional,
  longitud: longitudOpcional,
  direccion: textoOpcional(300),
})

export const esquemaCelulaEdicion = esquemaCelula.omit({ ramaId: true }).extend({
  liderId: numeroOpcional,
  activa: z.coerce.boolean(),
})

/** Id de rol elegido en un desplegable (FormData lo entrega como texto). */
const idRol = z.preprocess(
  aNumeroONulo,
  z.number({ message: 'Elige un rol' }).int({ message: 'Rol no válido' }).positive({ message: 'Elige un rol' }),
)

export const esquemaUsuario = z.object({
  email,
  nombre: nombrePropio,
  contrasena: clave,
  rolId: idRol,
  ramaId: numeroOpcional,
  celulaId: numeroOpcional,
  ministerioId: numeroOpcional,
})

export const esquemaUsuarioEdicion = z.object({
  nombre: nombrePropio,
  rolId: idRol,
  ramaId: numeroOpcional,
  celulaId: numeroOpcional,
  ministerioId: numeroOpcional,
  activa: z.coerce.boolean(),
  /** Vacía = no cambiar la contraseña (reset opcional por parte del admin). */
  contrasena: z.preprocess(vacioANulo, clave.nullable()),
})

/** Rol: nombre, alcance y la lista de permisos «recurso:accion» marcados. */
export const esquemaRol = z.object({
  nombre: z
    .string({ message: 'Falta el nombre del rol' })
    .trim()
    .min(3, { message: 'El nombre necesita al menos 3 caracteres' })
    .max(60, { message: 'Máximo 60 caracteres' }),
  descripcion: textoOpcional(200),
  alcance: z.enum(ALCANCES, { message: 'Elige hasta dónde llega el rol' }),
  permisos: z
    .array(z.string())
    .max(100, { message: 'Demasiados permisos' })
    .refine((lista) => lista.every(esPermisoValido), { message: 'Hay permisos que no existen' })
    .transform((lista) => Array.from(new Set(lista))),
})

/* ──────────────────────────────────────────────
   PASE DE LISTA — un estado de asistencia por integrante
   ────────────────────────────────────────────── */

/** Fecha obligatoria (AAAA-MM-DD): el pase de lista siempre es de un día. */
const fechaRequerida = z
  .string({ message: 'Falta la fecha de la reunión' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha debe tener formato AAAA-MM-DD' })

export const esquemaPaseDeLista = z.object({
  celulaId: idRequerido('Célula no válida'),
  fecha: fechaRequerida,
  asistencias: z
    .array(
      z.object({
        integranteId: z.number({ message: 'Integrante no válido' }).int().positive(),
        estado: z.enum(ESTADOS_ASISTENCIA, { message: 'Estado de asistencia no válido' }),
      }),
    )
    .min(1, { message: 'La lista no tiene a nadie a quien pasar lista' })
    .max(500, { message: 'Demasiados integrantes de una vez' })
    .transform((lista) => {
      // Si el mismo integrante viniera dos veces, manda la última marca
      const porIntegrante = new Map<number, (typeof lista)[number]>()
      for (const asistencia of lista) porIntegrante.set(asistencia.integranteId, asistencia)
      return Array.from(porIntegrante.values())
    }),
})

/* ──────────────────────────────────────────────
   INTEGRANTE (Fase 5) — persona inscrita en una célula
   ────────────────────────────────────────────── */

/** Campos comunes al alta y a la edición (la célula no se cambia al editar). */
const camposIntegrante = {
  nombre: z
    .string({ message: 'Falta el nombre' })
    .trim()
    .min(2, { message: 'Escribe al menos 2 caracteres' })
    .max(120, { message: 'Máximo 120 caracteres' }),
  apellidoPaterno: z
    .string({ message: 'Falta el apellido paterno' })
    .trim()
    .min(2, { message: 'Escribe al menos 2 caracteres' })
    .max(120, { message: 'Máximo 120 caracteres' }),
  apellidoMaterno: textoOpcional(120),
  fechaNacimiento: fechaOpcional,
  // Ubicación: el punto del mapa sustituye al domicilio escrito a mano
  latitud: latitudOpcional,
  longitud: longitudOpcional,
  direccion: textoOpcional(300),
  // De dónde es
  origenCiudad: textoOpcional(120),
  origenEstado: textoOpcional(120),
  // Iglesia
  hizoEncuentro: booleano,
  fechaEncuentro: fechaOpcional,
  bautizado: booleano,
  fechaBautizo: fechaOpcional,
  situacion: z.enum(SITUACIONES, { message: 'Situación no válida' }),
  // Contacto
  telefono: textoOpcional(30),
  notas: textoOpcional(1000),
}

export const esquemaIntegrante = z.object({
  celulaId: idRequerido('Elige la célula'),
  ...camposIntegrante,
})

export const esquemaIntegranteEdicion = z.object({
  id: idRequerido('Integrante no válido'),
  ...camposIntegrante,
})

/* ──────────────────────────────────────────────
   MINISTERIO — equipos, préstamos y eventos de servicio
   ────────────────────────────────────────────── */

const idMinisterio = idRequerido('Elige el ministerio')

export const esquemaMinisterio = z.object({
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
})

export const esquemaMinisterioEdicion = z.object({
  id: idRequerido('Ministerio no válido'),
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
  encargadoId: numeroOpcional,
  activo: z.coerce.boolean(),
})

export const esquemaEquipo = z.object({
  ministerioId: idMinisterio,
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
})

export const esquemaEquipoEdicion = z.object({
  id: idRequerido('Equipo no válido'),
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
  estatus: z.enum(ESTATUS_EQUIPO, { message: 'Estatus no válido' }),
})

/** Abrir un préstamo: quién se lo lleva, a quién se le asigna y cómo sale. */
export const esquemaPrestamo = z.object({
  equipoId: idRequerido('Elige el equipo'),
  /** A quién se le presta (queda como quien lo lleva y responde por él); tiene que ser del ministerio */
  asignadoAId: idRequerido('Elige a quién se le presta el equipo'),
  /** Evento para el que sale el equipo; el servidor comprueba que sea del mismo ministerio */
  eventoId: numeroOpcional,
  /** Marcada = ya se lo llevó; sin marcar = queda «por recoger» hasta que confirme */
  entregado: booleano,
  estadoEntrega: z.enum(CONSERVACIONES, { message: 'Estado no válido' }),
  notas: textoOpcional(500),
})

/** Confirmar que ya se recogió el equipo. */
export const esquemaRecogida = z.object({ id: idRequerido('Préstamo no válido') })

/** Cerrar un préstamo: cómo volvió el equipo. (También lo usa quien avisa que ya lo devolvió.) */
export const esquemaDevolucion = z.object({
  id: idRequerido('Préstamo no válido'),
  estadoDevolucion: z.enum(CONSERVACIONES, { message: 'Estado no válido' }),
  notas: textoOpcional(500),
})

/** Campos comunes del evento: cuándo es y dónde hay que estar. */
const camposEvento = {
  nombre: nombrePropio,
  descripcion: textoOpcional(500),
  fecha: fechaRequerida,
  hora: horaOpcional,
  latitud: latitudOpcional,
  longitud: longitudOpcional,
  direccion: textoOpcional(300),
}

export const esquemaEvento = z.object({
  ministerioId: idMinisterio,
  ...camposEvento,
})

export const esquemaEventoEdicion = z.object({
  id: idRequerido('Evento no válido'),
  ...camposEvento,
  activo: z.coerce.boolean(),
})

/** Armar la lista de quién sirve: las cuentas elegidas viajan como `usuario`. */
export const esquemaAsignacion = z.object({
  eventoId: idRequerido('Evento no válido'),
  usuarios: z
    .array(z.number({ message: 'Cuenta no válida' }).int().positive())
    .max(200, { message: 'Demasiados servidores de una vez' })
    .transform((lista) => Array.from(new Set(lista))),
  /** Rol que tendrán en el evento; vacío = sin definir todavía */
  funcion: textoOpcional(80),
})

/** Cambiar el rol de un servidor ya asignado al evento. */
export const esquemaFuncion = z.object({
  eventoId: idRequerido('Evento no válido'),
  usuarioId: idRequerido('Servidor no válido'),
  funcion: textoOpcional(80),
})

/**
 * Checar la llegada. `usuarioId` vacío = mi propio turno; con valor, es el
 * encargado marcando por alguien más (eso pide el permiso `evento:checar`).
 */
export const esquemaLlegada = z.object({
  eventoId: idRequerido('Evento no válido'),
  usuarioId: numeroOpcional,
  /** Hora en que llegó (AAAA-MM-DDTHH:MM); vacío = ahora */
  llegoEn: z.preprocess(
    vacioANulo,
    z
      .string({ message: 'Hora no válida' })
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, { message: 'La hora de llegada no es válida' })
      .nullable(),
  ),
  latitud: latitudOpcional,
  longitud: longitudOpcional,
  direccion: textoOpcional(300),
})

/** Confirmar (o retirar la confirmación de) un turno. */
export const esquemaConfirmacion = z.object({
  eventoId: idRequerido('Evento no válido'),
  usuarioId: numeroOpcional,
  confirmado: booleano,
})

export const esquemaTurno = z.object({
  eventoId: esquemaAsignacion.shape.eventoId,
  usuarioId: idRequerido('Servidor no válido'),
})

/**
 * Campos diferenciadores del catálogo.
 * Un campo es una pregunta: `SELECT` (opciones para elegir) o `RANGO`
 * (número con límites). Las opciones llegan como una lista de textos desde el
 * editor de opciones del diálogo.
 */
const OPCIONES_MAXIMAS = 30

const esquemaBaseCampo = {
  nombre: nombrePropio,
  tipo: z.enum(TIPOS_CAMPO, { message: 'Tipo de campo no válido' }),
  descripcion: textoOpcional(300),
  unidad: textoOpcional(30),
  limiteInferior: numeroOpcional,
  limiteSuperior: numeroOpcional,
  opciones: z
    .array(
      z
        .string({ message: 'La opción no es válida' })
        .trim()
        .min(1, { message: 'La opción no puede quedar vacía' })
        .max(120, { message: 'Máximo 120 caracteres por opción' }),
    )
    .max(OPCIONES_MAXIMAS, { message: `Máximo ${OPCIONES_MAXIMAS} opciones por campo` }),
}

function revisarCampo(
  valor: z.infer<z.ZodObject<typeof esquemaBaseCampo>>,
  contexto: z.RefinementCtx,
): void {
  if (valor.tipo === 'SELECT') {
    if (valor.opciones.length === 0) {
      contexto.addIssue({
        code: 'custom',
        path: ['opciones'],
        message: 'Agrega al menos una opción para elegir.',
      })
    }
    const normalizadas = valor.opciones.map((opcion) => opcion.toLowerCase())
    if (new Set(normalizadas).size !== normalizadas.length) {
      contexto.addIssue({
        code: 'custom',
        path: ['opciones'],
        message: 'No repitas la misma opción dos veces.',
      })
    }
  }
  if (
    valor.tipo === 'RANGO' &&
    valor.limiteInferior != null &&
    valor.limiteSuperior != null &&
    valor.limiteInferior > valor.limiteSuperior
  ) {
    contexto.addIssue({
      code: 'custom',
      path: ['limiteSuperior'],
      message: 'El límite mayor debe ser mayor o igual que el menor.',
    })
  }
}

export const esquemaCampo = z.object(esquemaBaseCampo).superRefine(revisarCampo)

export const esquemaCampoEdicion = z
  .object({ id: idRequerido('Campo no válido'), activo: booleano, ...esquemaBaseCampo })
  .superRefine(revisarCampo)

/**
 * Criterio de una célula sobre un campo. El `tipo` lo pone el servidor (viene
 * del catálogo): así valida que un SELECT lleve opciones y un RANGO límites.
 */
export const esquemaCriterio = z
  .object({
    campoId: idRequerido('Campo no válido'),
    tipo: z.enum(TIPOS_CAMPO, { message: 'Tipo de campo no válido' }),
    obligatorio: booleano,
    opcionIds: z
      .array(z.number({ message: 'Opción no válida' }).int().positive())
      .max(50, { message: 'Demasiadas opciones en un criterio' }),
    minimo: numeroOpcional,
    maximo: numeroOpcional,
  })
  .superRefine((valor, contexto) => {
    if (valor.tipo === 'SELECT') {
      if (valor.opcionIds.length === 0) {
        contexto.addIssue({
          code: 'custom',
          path: ['opcionIds'],
          message: 'Elige al menos una opción para ese campo.',
        })
      }
      return
    }
    if (valor.minimo == null && valor.maximo == null) {
      contexto.addIssue({
        code: 'custom',
        path: ['minimo'],
        message: 'Pon al menos un límite del rango.',
      })
    } else if (valor.minimo != null && valor.maximo != null && valor.minimo > valor.maximo) {
      contexto.addIssue({
        code: 'custom',
        path: ['maximo'],
        message: 'El límite mayor debe ser mayor o igual que el menor.',
      })
    }
  })

export const esquemaCriteriosCelula = z.object({
  celulaId: idRequerido('Célula no válida'),
  criterios: z.array(esquemaCriterio).max(100, { message: 'Demasiados criterios de una vez' }),
})

/** Respuesta de una persona a un campo (Lobby o ficha del integrante). */
export const esquemaRespuesta = z.object({
  campoId: idRequerido('Campo no válido'),
  tipo: z.enum(TIPOS_CAMPO, { message: 'Tipo de campo no válido' }),
  /** SELECT */
  opcionId: numeroOpcional,
  /** RANGO */
  valor: numeroOpcional,
})

/** Extrae el primer mensaje de error de un resultado de Zod. */
export function primerError(resultado: { error?: { issues: { message: string }[] } }): string | null {
  const issue = resultado.error?.issues[0]
  return issue ? issue.message : null
}
