import { Stack, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { exigirRol } from '@/lib/auth/guardas'
import { puede, rolPuede } from '@/lib/auth/permisos'
import { listarRamas } from '@/lib/db/ramas'
import { listarUsuarios } from '@/lib/db/usuarios'
import { inicialesDe } from '@/lib/nombres'
import { borrarRama } from '@/features/ramas/acciones'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioRama from '@/components/FormularioRama'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Ramas · Gosen' }

export default async function PaginaRamas() {
  // Comprobación ANTES de leer datos; el alcance lo aplica el SQL
  const usuario = await exigirRol('ver', 'rama')

  const puedeCrear = puede(usuario, 'crear', 'rama')
  // Los candidatos a líder solo hacen falta si se puede crear o editar ramas
  const gestiona = puedeCrear || rolPuede(usuario, 'editar', 'rama')
  const [ramas, usuarios] = await Promise.all([
    listarRamas(usuario, usuario.alcance !== 'ORGANIZACION'),
    gestiona ? listarUsuarios(usuario) : Promise.resolve([]),
  ])

  const filas: FilaListado[] = ramas.map((rama) => ({
    id: rama.id,
    href: `/panel/ramas/${rama.id}`,
    avatar: {
      texto: inicialesDe(rama.nombre),
      tono: rama.activa ? 'primary' : 'default',
    },
    celdas: [
      { clave: 'nombre', etiqueta: 'Nombre', texto: rama.nombre, destacado: true },
      { clave: 'descripcion', etiqueta: 'Descripción', texto: rama.descripcion ?? '—' },
      { clave: 'lider', etiqueta: 'Líder', texto: rama.nombreLider ?? '—' },
      {
        clave: 'estado',
        etiqueta: 'Estado',
        texto: rama.activa ? 'Activa' : 'Inactiva',
        chip: { etiqueta: rama.activa ? 'Activa' : 'Inactiva', tono: rama.activa ? 'success' : 'default' },
      },
    ],
    acciones: (
      <>
        <Typography
          component="a"
          href={`/panel/ramas/${rama.id}`}
          variant="button"
          sx={{ color: 'primary.main', textDecoration: 'none', px: 1, py: 0.75 }}
        >
          Ver
        </Typography>
        {puede(usuario, 'editar', 'rama', { ramaId: rama.id }) ? (
          <FormularioRama
            accion="editar"
            usuarios={usuarios}
            inicial={{
              id: rama.id,
              nombre: rama.nombre,
              descripcion: rama.descripcion,
              liderId: rama.liderId,
              activa: rama.activa,
            }}
          />
        ) : null}
        {rama.activa && puede(usuario, 'eliminar', 'rama', { ramaId: rama.id }) ? (
          <AccionBaja
            accion={borrarRama}
            id={rama.id}
            queEs="la rama"
            mensajeExito="Rama dada de baja"
          />
        ) : null}
      </>
    ),
  }))

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Ramas"
        etiqueta="Estructura"
        icono={<AccountTreeIcon />}
        subtitulo={`${ramas.length} ${ramas.length === 1 ? 'rama' : 'ramas'} a tu alcance`}
      />

      {/* En móvil la acción principal es el botón flotante del propio formulario */}
      {puedeCrear ? <FormularioRama accion="crear" usuarios={usuarios} /> : null}

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Nombre', 'Descripción', 'Líder', 'Estado']}
        placeholderBuscador="Buscar rama o líder…"
        accionesCabecera
        mensajeVacio={
          puedeCrear
            ? 'No hay ramas todavía. Crea la primera con el botón «Nueva rama»: dentro de ella vivirán las células.'
            : 'Aún no hay ramas a tu alcance.'
        }
      />
    </Stack>
  )
}
