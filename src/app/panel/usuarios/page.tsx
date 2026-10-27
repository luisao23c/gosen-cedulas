import { Button, Stack, Typography } from '@mui/material'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import GroupIcon from '@mui/icons-material/GroupOutlined'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, puedeOtorgar, rolPuede } from '@/lib/auth/permisos'
import { listarUsuarios } from '@/lib/db/usuarios'
import { listarRoles } from '@/lib/db/roles'
import { listarRamas } from '@/lib/db/ramas'
import { listarCelulas } from '@/lib/db/celulas'
import { listarMinisterios } from '@/lib/db/ministerios'
import { ALCANCE_CORTO } from '@/lib/auth/catalogo'
import { inicialesDe } from '@/lib/nombres'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioUsuario from '@/components/FormularioUsuario'
import FiltrosUsuarios from '@/components/FiltrosUsuarios'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Usuarios · Gosen' }

export default async function PaginaUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ rol?: string; estado?: string }>
}) {
  const usuario = await exigirRol('ver', 'usuario')
  const consulta = await searchParams

  // El rol llega como id numérico en la URL; cualquier otra cosa se ignora
  const rolNumero = Number(consulta.rol)
  const rolFiltro = Number.isInteger(rolNumero) && rolNumero > 0 ? rolNumero : null
  const estadoFiltro =
    consulta.estado === 'activas' ? true : consulta.estado === 'inactivas' ? false : null
  const hayFiltro = rolFiltro !== null || estadoFiltro !== null

  const puedeCrear = puede(usuario, 'crear', 'usuario')
  const puedeEditar = puede(usuario, 'editar', 'usuario')

  // Ramas y células se piden SIEMPRE: además del formulario, hacen falta para
  // mostrar a qué rama o célula pertenece cada cuenta (el alcance va en el SQL).
  const [usuarios, roles, ramas, celulas, ministerios] = await Promise.all([
    listarUsuarios(usuario, { rolId: rolFiltro, activo: estadoFiltro }),
    listarRoles(),
    listarRamas(usuario, false),
    listarCelulas(usuario, { soloActivas: false }),
    listarMinisterios(usuario),
  ])

  // Solo se pueden asignar roles que no den más poder del que uno tiene
  const rolesAsignables = roles
    .filter((rol) => puedeOtorgar(usuario, rol))
    .map((rol) => ({
      id: rol.id,
      nombre: rol.nombre,
      descripcion: rol.descripcion,
      alcance: rol.alcance,
    }))
  const opcionesRama = ramas.map((rama) => ({ id: rama.id, nombre: rama.nombre }))
  const opcionesCelula = celulas.map((celula) => ({
    id: celula.id,
    nombre: celula.nombre,
    ramaId: celula.ramaId,
    nombreRama: celula.nombreRama,
  }))
  const opcionesMinisterio = ministerios.map((ministerio) => ({
    id: ministerio.id,
    nombre: ministerio.nombre,
  }))

  const filas: FilaListado[] = usuarios.map((persona) => {
    const rama = opcionesRama.find((opcion) => opcion.id === persona.ramaId)
    const celula = opcionesCelula.find((opcion) => opcion.id === persona.celulaId)
    const ministerio = opcionesMinisterio.find((opcion) => opcion.id === persona.ministerioId)
    const rolPersona = roles.find((rol) => rol.id === persona.rolId)
    // No se edita a quien tiene más poder que uno (el servidor también lo impide)
    const editable = puedeEditar && rolPersona !== undefined && puedeOtorgar(usuario, rolPersona)

    const alcance =
      persona.alcance === 'ORGANIZACION'
        ? ALCANCE_CORTO.ORGANIZACION
        : persona.alcance === 'RAMA'
          ? (rama?.nombre ?? 'Sin rama')
          : persona.alcance === 'MINISTERIO'
            ? (ministerio?.nombre ?? 'Sin ministerio')
            : (celula?.nombre ?? 'Sin célula')

    return {
      id: persona.id,
      avatar: {
        texto: inicialesDe(persona.nombre),
        tono: persona.activo ? 'primary' : 'default',
      },
      celdas: [
        { clave: 'nombre', etiqueta: 'Nombre', texto: persona.nombre, destacado: true },
        { clave: 'correo', etiqueta: 'Correo', texto: persona.email },
        { clave: 'alcance', etiqueta: 'Alcance', texto: alcance },
        {
          clave: 'rol',
          etiqueta: 'Rol',
          texto: persona.rolNombre,
          chip: { etiqueta: persona.rolNombre, tono: 'primary' },
        },
        {
          clave: 'estado',
          etiqueta: 'Estado',
          texto: persona.activo ? 'Activa' : 'Desactivada',
          chip: {
            etiqueta: persona.activo ? 'Activa' : 'Desactivada',
            tono: persona.activo ? 'success' : 'default',
            soloTabla: persona.activo,
          },
        },
      ],
      acciones: editable ? (
        <FormularioUsuario
          accion="editar"
          roles={rolesAsignables}
          ramas={opcionesRama}
          celulas={opcionesCelula}
          ministerios={opcionesMinisterio}
          inicial={{
            id: persona.id,
            nombre: persona.nombre,
            rolId: persona.rolId,
            ramaId: persona.ramaId,
            celulaId: persona.celulaId,
            ministerioId: persona.ministerioId,
            activa: persona.activo,
          }}
        />
      ) : undefined,
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Usuarios"
        etiqueta="Organización"
        icono={<GroupIcon />}
        subtitulo={`${usuarios.length} ${usuarios.length === 1 ? 'cuenta' : 'cuentas'}${hayFiltro ? ' con los filtros aplicados' : ''}`}
      />

      {puedeCrear ? (
        <FormularioUsuario
          accion="crear"
          roles={rolesAsignables}
          ramas={opcionesRama}
          celulas={opcionesCelula}
          ministerios={opcionesMinisterio}
        />
      ) : null}

      <FiltrosUsuarios roles={roles.map((rol) => ({ id: rol.id, nombre: rol.nombre }))} />

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Nombre', 'Correo', 'Alcance', 'Rol', 'Estado']}
        placeholderBuscador="Buscar por nombre, correo o rol…"
        accionesCabecera={puedeEditar}
        mensajeVacio={
          hayFiltro
            ? 'Ningún usuario coincide con los filtros elegidos. Prueba quitando un filtro o busca por otro texto.'
            : 'No hay usuarios a tu alcance.'
        }
      />

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.5}
        sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Cada cuenta tiene un rol que decide qué puede ver y hacer. Solo quien tiene permiso para
          gestionar cuentas puede editarlas, y nadie puede asignar un rol con más poder que el suyo.
        </Typography>

        {rolPuede(usuario, 'ver', 'rol') ? (
          <Button
            href="/panel/roles"
            variant="outlined"
            startIcon={<AdminPanelSettingsIcon />}
            sx={{ flexShrink: 0 }}
          >
            Gestionar roles y permisos
          </Button>
        ) : null}
      </Stack>
    </Stack>
  )
}
