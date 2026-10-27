import { Box, Chip, Stack, Typography } from '@mui/material'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettingsOutlined'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, puedeOtorgar } from '@/lib/auth/permisos'
import { listarRoles } from '@/lib/db/roles'
import {
  CATALOGO,
  ETIQUETAS_ACCION,
  ETIQUETAS_ALCANCE,
  RECURSOS,
  permiso,
  todosLosPermisos,
} from '@/lib/auth/catalogo'
import { inicialesDe } from '@/lib/nombres'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioRol from '@/components/FormularioRol'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Roles · Gosen' }

export default async function PaginaRoles() {
  const usuario = await exigirRol('ver', 'rol')
  const roles = await listarRoles()

  const puedeCrear = puede(usuario, 'crear', 'rol')
  const puedeEditar = puede(usuario, 'editar', 'rol')
  const puedeEliminar = puede(usuario, 'eliminar', 'rol')
  const actor = { permisos: usuario.permisos, alcance: usuario.alcance }
  const totalPermisos = todosLosPermisos().length

  const filas: FilaListado[] = roles.map((rol) => ({
    id: rol.id,
    avatar: { texto: inicialesDe(rol.nombre), tono: rol.esSistema ? 'primary' : 'default' },
    celdas: [
      { clave: 'nombre', etiqueta: 'Rol', texto: rol.nombre, destacado: true },
      { clave: 'descripcion', etiqueta: 'Descripción', texto: rol.descripcion ?? '—' },
      { clave: 'alcance', etiqueta: 'Alcance', texto: ETIQUETAS_ALCANCE[rol.alcance] },
      {
        clave: 'permisos',
        etiqueta: 'Permisos',
        texto: `${rol.permisos.length} de ${totalPermisos} permisos`,
      },
      {
        clave: 'cuentas',
        etiqueta: 'Cuentas',
        texto: `${rol.totalUsuarios} ${rol.totalUsuarios === 1 ? 'cuenta' : 'cuentas'}`,
      },
      {
        clave: 'tipo',
        etiqueta: 'Tipo',
        texto: rol.esSistema ? 'Protegido' : 'Personalizado',
        chip: {
          etiqueta: rol.esSistema ? 'Protegido' : 'Personalizado',
          tono: rol.esSistema ? 'primary' : 'default',
        },
      },
    ],
    // El Administrador está protegido: no se edita. Los demás, solo si no dan más poder del propio
    acciones:
      puedeEditar && !rol.esSistema && puedeOtorgar(usuario, rol) ? (
        <FormularioRol
          accion="editar"
          actor={actor}
          puedeEliminar={puedeEliminar}
          inicial={{
            id: rol.id,
            nombre: rol.nombre,
            descripcion: rol.descripcion,
            alcance: rol.alcance,
            permisos: rol.permisos,
            totalUsuarios: rol.totalUsuarios,
          }}
        />
      ) : undefined,
  }))

  // Vista de conjunto: qué puede hacer cada rol sobre cada recurso
  const filasMatriz: FilaListado[] = roles.map((rol) => ({
    id: rol.id,
    celdas: [
      // La clave no puede repetir el nombre de un recurso (abajo hay una columna «rol»)
      { clave: 'nombreRol', etiqueta: 'Rol', texto: rol.nombre, destacado: true },
      { clave: 'alcance', etiqueta: 'Alcance', texto: ETIQUETAS_ALCANCE[rol.alcance], conEtiqueta: true },
      ...RECURSOS.map((recurso) => {
        const acciones = CATALOGO[recurso].acciones.filter((accion) =>
          rol.permisos.includes(permiso(recurso, accion)),
        )
        return {
          clave: recurso,
          etiqueta: CATALOGO[recurso].etiqueta,
          texto: acciones.length > 0 ? acciones.map((a) => ETIQUETAS_ACCION[a]).join(' · ') : '—',
          conEtiqueta: true,
        }
      }),
    ],
  }))

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Roles y permisos"
        etiqueta="Organización"
        icono={<AdminPanelSettingsIcon />}
        subtitulo={`${roles.length} ${roles.length === 1 ? 'rol' : 'roles'}. Los cambios se aplican al instante a todas las cuentas que los usan.`}
      />

      {puedeCrear ? <FormularioRol accion="crear" actor={actor} /> : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Rol', 'Descripción', 'Alcance', 'Permisos', 'Cuentas', 'Tipo']}
        placeholderBuscador="Buscar rol…"
        accionesCabecera={puedeEditar}
        mensajeVacio="Todavía no hay roles."
      />

      <Box sx={{ pt: 1, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h4" component="h2">
            ¿Qué puede hacer cada rol?
          </Typography>
          <Chip size="small" label="Vista de conjunto" color="primary" />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          Resumen de los permisos activos de cada rol. El Administrador siempre tiene todos y no se
          puede modificar, para que la organización nunca se quede sin quien la gestione.
        </Typography>
      </Box>

      <ListadoResponsivo
        filas={filasMatriz}
        etiquetas={['Rol', 'Alcance', ...RECURSOS.map((recurso) => CATALOGO[recurso].etiqueta)]}
        placeholderBuscador="Buscar rol o permiso…"
        principal={false}
        mensajeVacio="—"
      />
    </Stack>
  )
}
