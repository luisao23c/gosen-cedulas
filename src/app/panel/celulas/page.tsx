import { Stack } from '@mui/material'
import AssignmentIcon from '@mui/icons-material/Assignment'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarCelulas } from '@/lib/db/celulas'
import { listarRamas } from '@/lib/db/ramas'
import { listarUsuarios } from '@/lib/db/usuarios'
import { listarCampos, listarCriteriosDeCelulas } from '@/lib/db/campos'
import { etiquetaDeRango, queAcepta } from '@/lib/campos'
import { DIAS_SEMANA, type CampoDiferenciador, type CriterioCelula } from '@/types/domain'
import type { OpcionRama } from '@/features/tipos'
import { inicialesDe } from '@/lib/nombres'
import { borrarCelula } from '@/features/celulas/acciones'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioCelula from '@/components/FormularioCelula'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Células · Gosen' }

/**
 * Lo que acepta una célula, en una línea: «Estado civil: Soltero · Casado ·
 * Edad: 20 a 40 años». Es lo que Lobby compara con las respuestas de la persona.
 */
function resumenDeCriterios(
  criterios: CriterioCelula[],
  campos: Map<number, CampoDiferenciador>,
): string | null {
  const partes: string[] = []
  for (const criterio of criterios) {
    const campo = campos.get(criterio.campoId)
    if (!campo) continue
    const acepta = campo.tipo === 'SELECT' ? queAcepta(campo, criterio) : etiquetaDeRango(campo, criterio)
    partes.push(`${campo.nombre}: ${acepta}${criterio.obligatorio ? ' (obligatorio)' : ''}`)
  }
  return partes.length > 0 ? partes.join(' · ') : null
}

export default async function PaginaCelulas() {
  const usuario = await exigirRol('ver', 'celula')
  const celulas = await listarCelulas(usuario, { soloActivas: false })

  // Se puede crear dentro de las ramas que el alcance del rol permita. Ojo: la
  // comprobación va rama por rama; con ámbito vacío, un rol de alcance de rama
  // quedaría fuera de su propio territorio y no vería el botón:
  const ramasPermitidas: OpcionRama[] = rolPuede(usuario, 'crear', 'celula')
    ? (await listarRamas(usuario, false))
        .filter((rama) => puede(usuario, 'crear', 'celula', { ramaId: rama.id }))
        .map((rama) => ({ id: rama.id, nombre: rama.nombre }))
    : []

  // Los candidatos a líder solo hacen falta si se puede editar alguna célula
  const gestiona = rolPuede(usuario, 'editar', 'celula')
  const usuarios = gestiona ? await listarUsuarios(usuario) : []

  // A quién le sirve cada célula: el catálogo de campos y lo que acepta cada una
  const [camposCatalogo, criteriosPorCelula] = await Promise.all([
    listarCampos(true),
    listarCriteriosDeCelulas(celulas.map((celula) => celula.id)),
  ])
  const camposPorId = new Map(camposCatalogo.map((campo) => [campo.id, campo]))

  const filas: FilaListado[] = celulas.map((celula) => {
    const criterios = criteriosPorCelula.get(celula.id) ?? []
    const acepta = resumenDeCriterios(criterios, camposPorId)
    // En el teléfono el chip dice solo los valores: «Soltero · 20 a 40 años»
    const valores = criterios
      .slice(0, 3)
      .map((criterio) => {
        const campo = camposPorId.get(criterio.campoId)
        if (!campo) return null
        return campo.tipo === 'SELECT' ? queAcepta(campo, criterio) : etiquetaDeRango(campo, criterio)
      })
      .filter((valor): valor is string => valor != null)
      .join(' · ')

    return {
    id: celula.id,
    // La ficha de la célula es donde viven sus integrantes
    href: `/panel/celulas/${celula.id}`,
    avatar: {
      texto: inicialesDe(celula.nombre),
      tono: celula.activa ? 'primary' : 'default',
    },
    celdas: [
      { clave: 'nombre', etiqueta: 'Célula', texto: celula.nombre, destacado: true },
      {
        clave: 'rama',
        etiqueta: 'Rama',
        texto: celula.nombreRama ?? `Rama #${celula.ramaId}`,
      },
      {
        clave: 'reunion',
        etiqueta: 'Reunión',
        texto:
          celula.diaSemana != null
            ? `${DIAS_SEMANA[celula.diaSemana]}${celula.hora ? ` · ${celula.hora}` : ''}`
            : 'Sin día fijo',
      },
      {
        clave: 'ubicacion',
        etiqueta: 'Ubicación',
        texto: celula.ubicacion.direccion ?? 'Sin ubicación marcada',
      },
      {
        clave: 'sirve',
        etiqueta: 'A quién le sirve',
        texto: acepta ?? 'Sin criterios: se recomienda solo por cercanía',
        chip: {
          etiqueta: valores !== '' ? valores : 'Sin criterios',
          tono: valores !== '' ? 'primary' : 'default',
          soloTabla: valores === '',
        },
      },
      {
        clave: 'estado',
        etiqueta: 'Estado',
        texto: celula.activa ? 'Activa' : 'Inactiva',
        chip: {
          etiqueta: celula.activa ? 'Activa' : 'Inactiva',
          tono: celula.activa ? 'success' : 'default',
          soloTabla: celula.activa,
        },
      },
    ],
    // Editar y dar de baja la célula sin tener que entrar a su rama
    acciones: (
      <>
        {puede(usuario, 'editar', 'celula', { ramaId: celula.ramaId, celulaId: celula.id }) ? (
          <FormularioCelula
            accion="editar"
            ramaId={celula.ramaId}
            usuarios={usuarios}
            inicial={{
              id: celula.id,
              nombre: celula.nombre,
              diaSemana: celula.diaSemana,
              hora: celula.hora,
              ubicacion: celula.ubicacion,
              liderId: celula.liderId,
              activa: celula.activa,
            }}
            campos={camposCatalogo}
            criterios={criterios}
          />
        ) : null}
        {celula.activa &&
        puede(usuario, 'eliminar', 'celula', { ramaId: celula.ramaId, celulaId: celula.id }) ? (
          <AccionBaja
            accion={borrarCelula}
            id={celula.id}
            queEs="la célula"
            mensajeExito="Célula dada de baja"
          />
        ) : null}
      </>
    ),
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Células"
        etiqueta="Estructura"
        icono={<AssignmentIcon />}
        subtitulo={`${celulas.length} ${celulas.length === 1 ? 'célula' : 'células'} a tu alcance. Toca una para ver y agregar a sus integrantes.`}
      />

      {/* En móvil la acción principal es el botón flotante del propio formulario */}
      {ramasPermitidas.length > 0 ? (
        <FormularioCelula
          accion="crear"
          ramas={ramasPermitidas}
          usuarios={[]}
          campos={camposCatalogo}
          criterios={[]}
        />
      ) : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Célula', 'Rama', 'Reunión', 'Ubicación', 'A quién le sirve', 'Estado']}
        placeholderBuscador="Buscar célula, rama o dirección…"
        accionesCabecera
        mensajeVacio={
          ramasPermitidas.length > 0
            ? 'No hay células todavía. Crea la primera con el botón «Nueva célula»: dentro de ella se registran los integrantes.'
            : 'Aún no hay células a tu alcance.'
        }
      />
    </Stack>
  )
}
