import type { RowDataPacket } from 'mysql2'
import { consultar, consultarUno, ejecutar, transaccion, type Transaccion } from '@/lib/db/conexion'
import type {
  CampoDiferenciador,
  CriterioCelula,
  OpcionCampo,
  RespuestaCampo,
  TipoCampo,
} from '@/types/domain'

/**
 * Acceso a datos de los CAMPOS DIFERENCIADORES.
 *
 * Tres piezas que viajan juntas:
 *  · `campo` / `campo_opcion`  → el catálogo de preguntas (lo gestiona la organización).
 *  · `celula_criterio` (+opciones) → lo que cada célula acepta (lo declara quien edita la célula).
 *  · `integrante_respuesta`    → lo que respondió cada persona (Lobby o su ficha).
 *
 * El catálogo no tiene alcance: es de toda la organización. Lo que sí se acota
 * es a quién se muestran las células y sus criterios (el SQL de `celulas.ts`).
 */

interface FilaCampo extends RowDataPacket {
  id: number
  nombre: string
  tipo: TipoCampo
  descripcion: string | null
  unidad: string | null
  limite_inferior: number | null
  limite_superior: number | null
  activo: number | boolean
  orden: number
}

interface FilaOpcion extends RowDataPacket {
  id: number
  campo_id: number
  etiqueta: string
}

interface FilaCriterio extends RowDataPacket {
  celula_id: number
  campo_id: number
  obligatorio: number | boolean
  minimo: number | null
  maximo: number | null
  opcion_id: number | null
}

interface FilaRespuesta extends RowDataPacket {
  campo_id: number
  opcion_id: number | null
  valor: number | null
}

function aCampo(fila: FilaCampo, opciones: OpcionCampo[]): CampoDiferenciador {
  return {
    id: fila.id,
    nombre: fila.nombre,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    unidad: fila.unidad,
    limiteInferior: fila.limite_inferior,
    limiteSuperior: fila.limite_superior,
    activo: Boolean(fila.activo),
    orden: fila.orden,
    opciones,
  }
}

function agruparOpciones(filas: FilaOpcion[]): Map<number, OpcionCampo[]> {
  const porCampo = new Map<number, OpcionCampo[]>()
  for (const fila of filas) {
    const lista = porCampo.get(fila.campo_id) ?? []
    lista.push({ id: fila.id, campoId: fila.campo_id, etiqueta: fila.etiqueta })
    porCampo.set(fila.campo_id, lista)
  }
  return porCampo
}

/* ─────────────── Catálogo ─────────────── */

/** Catálogo completo, con sus opciones. Por defecto solo los campos activos. */
export async function listarCampos(soloActivos = true): Promise<CampoDiferenciador[]> {
  const [campos, opciones] = await Promise.all([
    consultar<FilaCampo>(
      `SELECT * FROM campo ${soloActivos ? 'WHERE activo = 1' : ''} ORDER BY orden, nombre`,
    ),
    consultar<FilaOpcion>(
      'SELECT id, campo_id, etiqueta FROM campo_opcion ORDER BY orden, etiqueta',
    ),
  ])
  const porCampo = agruparOpciones(opciones)
  return campos.map((fila) => aCampo(fila, porCampo.get(fila.id) ?? []))
}

/** Un campo del catálogo con sus opciones, o null si no existe. */
export async function buscarCampo(id: number): Promise<CampoDiferenciador | null> {
  const fila = await consultarUno<FilaCampo>('SELECT * FROM campo WHERE id = ?', [id])
  if (!fila) return null
  const opciones = await consultar<FilaOpcion>(
    'SELECT id, campo_id, etiqueta FROM campo_opcion WHERE campo_id = ? ORDER BY orden, etiqueta',
    [id],
  )
  return aCampo(fila, opciones as unknown as OpcionCampo[])
}

export interface DatosCampo {
  nombre: string
  tipo: TipoCampo
  descripcion: string | null
  unidad: string | null
  limiteInferior: number | null
  limiteSuperior: number | null
  activo: boolean
  /** Etiquetas de las opciones (solo SELECT); el orden es el del arreglo */
  opciones: string[]
}

/** Crea un campo con sus opciones o no crea nada. Devuelve el id. */
export async function guardarCampo(datos: DatosCampo): Promise<number> {
  // El orden se lee aparte: MySQL no deja consultar la tabla que se está
  // insertando en la misma sentencia («Table 'campo' is specified twice»).
  const ultimo = await consultarUno<{ orden: number }>(
    'SELECT COALESCE(MAX(orden), -1) + 1 AS orden FROM campo',
  )
  const orden = Number(ultimo?.orden ?? 0)

  return transaccion(async (tx) => {
    const resultado = await tx.ejecutar(
      `INSERT INTO campo (nombre, tipo, descripcion, unidad, limite_inferior, limite_superior, activo, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        datos.nombre,
        datos.tipo,
        datos.descripcion,
        datos.unidad,
        datos.limiteInferior,
        datos.limiteSuperior,
        datos.activo ? 1 : 0,
        orden,
      ],
    )
    await reemplazarOpciones(tx, resultado.insertId, datos.opciones)
    return resultado.insertId
  })
}

/** Actualiza un campo; sus opciones se reemplazan completas. */
export async function actualizarCampo(id: number, datos: DatosCampo): Promise<void> {
  await transaccion(async (tx) => {
    await tx.ejecutar(
      `UPDATE campo SET nombre = ?, tipo = ?, descripcion = ?, unidad = ?,
         limite_inferior = ?, limite_superior = ?, activo = ? WHERE id = ?`,
      [
        datos.nombre,
        datos.tipo,
        datos.descripcion,
        datos.unidad,
        datos.limiteInferior,
        datos.limiteSuperior,
        datos.activo ? 1 : 0,
        id,
      ],
    )
    // Cambiar de SELECT a RANGO vacía la lista de opciones Y los criterios
    // que aceptaban opciones: ya no hay nada que aceptar.
    const opciones = datos.tipo === 'SELECT' ? datos.opciones : []
    await tx.ejecutar('DELETE FROM campo_opcion WHERE campo_id = ?', [id])
    if (datos.tipo !== 'SELECT') {
      await tx.ejecutar('DELETE FROM celula_criterio_opcion WHERE campo_id = ?', [id])
    }
    await reemplazarOpciones(tx, id, opciones)
  })
}

/**
 * Da de baja un campo. Las respuestas dadas desaparecen con él (la clave ajena
 * lo borra en cascada) y los criterios que lo usaban también: quien lo quiera
 * conservar mejor ocultarlo con el interruptor del campo.
 */
export async function borrarCampo(id: number): Promise<void> {
  await ejecutar('DELETE FROM campo WHERE id = ?', [id])
}

/** Cuántas respuestas y criterios dependen de este campo (para avisar al dar de baja). */
export async function contarUsosCampo(
  id: number,
): Promise<{ respuestas: number; criterios: number }> {
  const [respuestas, criterios] = await Promise.all([
    consultarUno<{ n: number }>('SELECT COUNT(*) AS n FROM integrante_respuesta WHERE campo_id = ?', [id]),
    consultarUno<{ n: number }>('SELECT COUNT(*) AS n FROM celula_criterio WHERE campo_id = ?', [id]),
  ])
  return { respuestas: Number(respuestas?.n ?? 0), criterios: Number(criterios?.n ?? 0) }
}

/**
 * Respuestas y criterios de TODOS los campos, en dos consultas.
 * Es lo que pinta el catálogo: cuánto se usa cada pregunta y si se puede dar
 * de baja (con respuestas, no: se desactiva).
 */
export async function usosDeCampos(): Promise<
  Map<number, { respuestas: number; criterios: number }>
> {
  const [respuestas, criterios] = await Promise.all([
    consultar<{ campo_id: number; total: number }>(
      'SELECT campo_id, COUNT(*) AS total FROM integrante_respuesta GROUP BY campo_id',
    ),
    consultar<{ campo_id: number; total: number }>(
      'SELECT campo_id, COUNT(*) AS total FROM celula_criterio GROUP BY campo_id',
    ),
  ])

  const mapa = new Map<number, { respuestas: number; criterios: number }>()
  const acumular = (campoId: number, cual: 'respuestas' | 'criterios', total: number) => {
    const actual = mapa.get(campoId) ?? { respuestas: 0, criterios: 0 }
    actual[cual] = Number(total)
    mapa.set(campoId, actual)
  }
  for (const fila of respuestas) acumular(fila.campo_id, 'respuestas', fila.total)
  for (const fila of criterios) acumular(fila.campo_id, 'criterios', fila.total)
  return mapa
}

async function reemplazarOpciones(
  tx: Transaccion,
  campoId: number,
  opciones: string[],
): Promise<void> {
  for (const [indice, etiqueta] of opciones.entries()) {
    await tx.ejecutar('INSERT INTO campo_opcion (campo_id, etiqueta, orden) VALUES (?, ?, ?)', [
      campoId,
      etiqueta,
      indice,
    ])
  }
}

/* ─────────────── Criterios de las células ─────────────── */

function aCriterios(filas: FilaCriterio[]): CriterioCelula[] {
  // La llave es CELULA + campo: una célula y otra no comparten criterios aunque
  // pidan el mismo campo. Agrupar solo por campo mezclaba las opciones de una
  // célula en la otra (y una de las dos se quedaba sin criterios).
  const porCampo = new Map<string, CriterioCelula>()
  for (const fila of filas) {
    const llave = `${fila.celula_id}:${fila.campo_id}`
    const existente = porCampo.get(llave)
    if (existente) {
      if (fila.opcion_id != null && !existente.opcionIds.includes(fila.opcion_id)) {
        existente.opcionIds.push(fila.opcion_id)
      }
      continue
    }
    porCampo.set(llave, {
      celulaId: fila.celula_id,
      campoId: fila.campo_id,
      obligatorio: Boolean(fila.obligatorio),
      minimo: fila.minimo,
      maximo: fila.maximo,
      opcionIds: fila.opcion_id != null ? [fila.opcion_id] : [],
    })
  }
  return Array.from(porCampo.values())
}

const SQL_CRITERIOS = `SELECT c.celula_id, c.campo_id, c.obligatorio, c.minimo, c.maximo, co.opcion_id
  FROM celula_criterio c
  LEFT JOIN celula_criterio_opcion co ON co.celula_id = c.celula_id AND co.campo_id = c.campo_id`

/** Criterios que ha declarado una célula. */
export async function listarCriterios(celulaId: number): Promise<CriterioCelula[]> {
  const filas = await consultar<FilaCriterio>(
    `${SQL_CRITERIOS} WHERE c.celula_id = ? ORDER BY c.campo_id`,
    [celulaId],
  )
  return aCriterios(filas)
}

/** Criterios de varias células a la vez (el registro por ubicación los pide de una sola vez). */
export async function listarCriteriosDeCelulas(
  celulaIds: number[],
): Promise<Map<number, CriterioCelula[]>> {
  const mapa = new Map<number, CriterioCelula[]>()
  if (celulaIds.length === 0) return mapa
  const filas = await consultar<FilaCriterio>(
    `${SQL_CRITERIOS} WHERE c.celula_id IN (${marcas(celulaIds.length)}) ORDER BY c.celula_id, c.campo_id`,
    celulaIds,
  )
  for (const criterio of aCriterios(filas)) {
    const lista = mapa.get(criterio.celulaId) ?? []
    lista.push(criterio)
    mapa.set(criterio.celulaId, lista)
  }
  return mapa
}

/** Marcas de los comodines `?` de una lista de parámetros («?, ?, ?»). */
function marcas(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}

/** Reemplaza todos los criterios de una célula por los dados. */
export async function guardarCriterios(
  celulaId: number,
  criterios: Omit<CriterioCelula, 'celulaId'>[],
): Promise<void> {
  await transaccion(async (tx) => {
    await tx.ejecutar('DELETE FROM celula_criterio WHERE celula_id = ?', [celulaId])
    await tx.ejecutar('DELETE FROM celula_criterio_opcion WHERE celula_id = ?', [celulaId])
    for (const criterio of criterios) {
      await tx.ejecutar(
        `INSERT INTO celula_criterio (celula_id, campo_id, obligatorio, minimo, maximo)
         VALUES (?, ?, ?, ?, ?)`,
        [celulaId, criterio.campoId, criterio.obligatorio ? 1 : 0, criterio.minimo, criterio.maximo],
      )
      for (const opcionId of criterio.opcionIds) {
        await tx.ejecutar(
          'INSERT INTO celula_criterio_opcion (celula_id, campo_id, opcion_id) VALUES (?, ?, ?)',
          [celulaId, criterio.campoId, opcionId],
        )
      }
    }
  })
}

/* ─────────────── Respuestas de las personas ─────────────── */

/** Qué respondió una persona. */
export async function listarRespuestas(integranteId: number): Promise<RespuestaCampo[]> {
  const filas = await consultar<FilaRespuesta>(
    'SELECT campo_id, opcion_id, valor FROM integrante_respuesta WHERE integrante_id = ?',
    [integranteId],
  )
  return filas.map((fila) => ({
    campoId: fila.campo_id,
    opcionId: fila.opcion_id,
    valor: fila.valor,
  }))
}

/** Responder sobrescribe lo anterior: se borran y se vuelven a escribir las respuestas. */
export async function guardarRespuestas(
  integranteId: number,
  respuestas: RespuestaCampo[],
): Promise<void> {
  await transaccion(async (tx) => {
    await tx.ejecutar('DELETE FROM integrante_respuesta WHERE integrante_id = ?', [integranteId])
    for (const respuesta of respuestas) {
      if (respuesta.opcionId == null && respuesta.valor == null) continue
      await tx.ejecutar(
        'INSERT INTO integrante_respuesta (integrante_id, campo_id, opcion_id, valor) VALUES (?, ?, ?, ?)',
        [integranteId, respuesta.campoId, respuesta.opcionId, respuesta.valor],
      )
    }
  })
}
