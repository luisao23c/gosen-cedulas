import { Box, Chip, Paper, Stack, Typography } from '@mui/material'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import { notFound, redirect } from 'next/navigation'
import { exigirRol } from '@/lib/auth/guardas'
import { puede } from '@/lib/auth/permisos'
import { buscarRama, nombreLiderDeRama } from '@/lib/db/ramas'
import { listarCelulas } from '@/lib/db/celulas'
import { listarUsuarios } from '@/lib/db/usuarios'
import { listarCampos, listarCriteriosDeCelulas } from '@/lib/db/campos'
import { DIAS_SEMANA } from '@/types/domain'
import { inicialesDe } from '@/lib/nombres'
import { borrarCelula } from '@/features/celulas/acciones'
import AccionBaja from '@/components/AccionBaja'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioCelula from '@/components/FormularioCelula'
import FormularioRama from '@/components/FormularioRama'

export const instant = false
export const metadata = { title: 'Rama · Gosen' }

/** Dato de la tarjeta de resumen: etiqueta arriba, valor debajo. */
function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="overline" color="text.secondary">
        {etiqueta}
      </Typography>
      <Box>{children}</Box>
    </Box>
  )
}

export default async function PaginaRama({ params }: { params: Promise<{ ramaId: string }> }) {
  const { ramaId: texto } = await params
  const ramaId = Number(texto)
  if (!Number.isInteger(ramaId) || ramaId <= 0) notFound()

  const usuario = await exigirRol('ver', 'rama')
  // La búsqueda ya va acotada al alcance del rol: si no es suya, no existe
  const rama = await buscarRama(ramaId, usuario)
  if (!rama) redirect('/panel/acceso-denegado')

  const puedeEditar = puede(usuario, 'editar', 'rama', { ramaId })
  const puedeCrearCelula = puede(usuario, 'crear', 'celula', { ramaId })

  const [celulas, liderNombre, usuarios, camposCatalogo] = await Promise.all([
    listarCelulas(usuario, { ramaId, soloActivas: false }),
    nombreLiderDeRama(ramaId),
    puedeCrearCelula || puedeEditar ? listarUsuarios(usuario) : Promise.resolve([]),
    // Catálogo de campos: así se declaran los criterios en el propio alta
    listarCampos(true),
  ])
  const criteriosPorCelula = await listarCriteriosDeCelulas(celulas.map((celula) => celula.id))

  const filasCelula: FilaListado[] = celulas.map((celula) => ({
    id: celula.id,
    href: `/panel/celulas/${celula.id}`,
    avatar: {
      texto: inicialesDe(celula.nombre),
      tono: celula.activa ? 'primary' : 'default',
    },
    celdas: [
      { clave: 'nombre', etiqueta: 'Célula', texto: celula.nombre, destacado: true },
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
        clave: 'estado',
        etiqueta: 'Estado',
        texto: celula.activa ? 'Activa' : 'Inactiva',
        chip: {
          etiqueta: celula.activa ? 'Activa' : 'Inactiva',
          tono: celula.activa ? 'success' : 'default',
        },
      },
    ],    acciones: (
      <>
        {puede(usuario, 'editar', 'celula', { ramaId, celulaId: celula.id }) ? (
          <FormularioCelula
            accion="editar"
            ramaId={ramaId}
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
            criterios={criteriosPorCelula.get(celula.id) ?? []}
          />
        ) : null}
        {celula.activa &&
        puede(usuario, 'eliminar', 'celula', { ramaId, celulaId: celula.id }) ? (
          <AccionBaja
            accion={borrarCelula}
            id={celula.id}
            queEs="la célula"
            mensajeExito="Célula dada de baja"
          />
        ) : null}
      </>
    ),
  }))

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        volver={{ href: '/panel/ramas', etiqueta: 'Ramas' }}
        titulo={rama.nombre}
        etiqueta="Rama"
        icono={<AccountTreeIcon />}
        subtitulo={rama.descripcion ?? 'Sin descripción'}
      >
        {puedeEditar ? (
          <FormularioRama
            accion="editar"
            usuarios={usuarios}
            inicial={{
              id: ramaId,
              nombre: rama.nombre,
              descripcion: rama.descripcion,
              liderId: rama.liderId,
              activa: rama.activa,
            }}
          />
        ) : null}
      </EncabezadoPagina>

      <Paper
        variant="outlined"
        sx={{
          p: { xs: 2, sm: 2.5 },
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
        }}
      >
        <Dato etiqueta="Líder de la rama">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {liderNombre ?? 'Sin líder asignado'}
          </Typography>
        </Dato>
        <Dato etiqueta="Células">
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {celulas.length} {celulas.length === 1 ? 'célula' : 'células'}
          </Typography>
        </Dato>
        <Dato etiqueta="Estado">
          <Chip
            size="small"
            label={rama.activa ? 'Activa' : 'Inactiva'}
            color={rama.activa ? 'success' : 'default'}
            variant={rama.activa ? 'filled' : 'outlined'}
          />
        </Dato>
      </Paper>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Box>
          <Typography variant="h5" component="h2">
            Células de la rama
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Cada célula agrupa a sus integrantes y tiene su día de reunión.
          </Typography>
        </Box>
        {/* En móvil la acción principal es el botón flotante del propio formulario */}
        {puedeCrearCelula ? (
          <FormularioCelula
            accion="crear"
            ramaId={ramaId}
            usuarios={usuarios}
            campos={camposCatalogo}
            criterios={[]}
          />
        ) : null}
      </Stack>

      <ListadoResponsivo
        filas={filasCelula}
        etiquetas={['Célula', 'Reunión', 'Ubicación', 'Estado']}
        placeholderBuscador="Buscar célula o dirección…"
        accionesCabecera
        mensajeVacio={
          puedeCrearCelula
            ? 'Esta rama aún no tiene células. Crea la primera con el botón «Nueva célula».'
            : 'Esta rama aún no tiene células.'
        }
      />
    </Stack>
  )
}
