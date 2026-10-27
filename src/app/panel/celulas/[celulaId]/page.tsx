import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMoreOutlined'
import PhoneIcon from '@mui/icons-material/PhoneOutlined'
import AssignmentIcon from '@mui/icons-material/AssignmentOutlined'
import PlaceIcon from '@mui/icons-material/PlaceOutlined'
import { notFound, redirect } from 'next/navigation'
import { exigirRol } from '@/lib/auth/guardas'
import { puede } from '@/lib/auth/permisos'
import { buscarCelula } from '@/lib/db/celulas'
import { listarIntegrantes } from '@/lib/db/integrantes'
import { buscarRama } from '@/lib/db/ramas'
import { obtenerPaseDeLista } from '@/lib/db/asistencia'
import { DIAS_SEMANA, ETIQUETAS_SITUACION, nombreCompleto } from '@/types/domain'
import { calcularEdad, fechaDeLaReunion, formatearFecha, formatearHora } from '@/lib/fechas'
import { inicialesDe } from '@/lib/nombres'
import { coordenadasDe, enlaceMapa, formatearCoordenadas } from '@/lib/geo'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioIntegrante from '@/components/FormularioIntegrante'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'
import MapaUbicacion from '@/components/MapaUbicacion'
import PaseDeLista from '@/components/PaseDeLista'
import FormularioCriteriosCelula from '@/components/FormularioCriteriosCelula'
import { listarCampos, listarCriterios } from '@/lib/db/campos'

export const instant = false
export const metadata = { title: 'Célula · Gosen' }

/** Color del chip según la situación del integrante. */
const TONO_SITUACION: Record<string, 'success' | 'primary' | 'default'> = {
  ACTIVO: 'success',
  VISITANTE: 'primary',
  INACTIVO: 'default',
  EGRESADO: 'default',
}

export default async function PaginaCelula({ params }: { params: Promise<{ celulaId: string }> }) {
  const { celulaId: texto } = await params
  const celulaId = Number(texto)
  if (!Number.isInteger(celulaId) || celulaId <= 0) notFound()

  const usuario = await exigirRol('ver', 'integrante')
  // Acotado al alcance del rol: si la célula no es suya, no existe
  const celula = await buscarCelula(celulaId, usuario)
  if (!celula) redirect('/panel/acceso-denegado')

  const ramaId = celula.ramaId
  const ambito = { ramaId, celulaId }
  // La reunión que toca: hoy si es su día, y si no la última que ya pasó
  const fechaReunion = fechaDeLaReunion(celula.diaSemana)
  const veAsistencia = puede(usuario, 'ver', 'asistencia', ambito)
  const [integrantes, rama, pase, campos, criterios] = await Promise.all([
    listarIntegrantes(usuario, { celulaId }),
    buscarRama(ramaId, usuario),
    veAsistencia
      ? obtenerPaseDeLista(celulaId, fechaReunion)
      : Promise.resolve({ reunionId: null, asistencias: [] }),
    // Catálogo + lo que esta célula acepta: lo de arriba de «A quién le sirve»
    listarCampos(true),
    listarCriterios(celulaId),
  ])

  const puedeCrear = puede(usuario, 'crear', 'integrante', ambito)
  const puedeEditar = puede(usuario, 'editar', 'integrante', ambito)
  const puedePasarLista = puede(usuario, 'pasarLista', 'asistencia', ambito)
  const puedeEditarCriterios = puede(usuario, 'editar', 'celula', ambito)
  const hoyToca = celula.diaSemana != null && celula.diaSemana === new Date().getDay()

  const activos = integrantes.filter((integrante) => integrante.situacion === 'ACTIVO').length
  // Punto de la célula en el mapa (null si todavía no se ha marcado)
  const puntoCelula = coordenadasDe(celula.ubicacion)

  const filas: FilaListado[] = integrantes.map((integrante) => {
    const edad = calcularEdad(integrante.fechaNacimiento)
    return {
      id: integrante.id,
      avatar: {
        texto: inicialesDe(nombreCompleto(integrante)),
        tono: integrante.situacion === 'ACTIVO' ? 'primary' : 'default',
      },
      celdas: [
        {
          clave: 'nombre',
          etiqueta: 'Integrante',
          texto: nombreCompleto(integrante),
          destacado: true,
        },
        {
          clave: 'situacion',
          etiqueta: 'Situación',
          texto: ETIQUETAS_SITUACION[integrante.situacion],
          chip: {
            etiqueta: ETIQUETAS_SITUACION[integrante.situacion],
            tono: TONO_SITUACION[integrante.situacion] ?? 'default',
          },
        },
        {
          clave: 'nacimiento',
          etiqueta: 'Nacimiento',
          texto:
            integrante.fechaNacimiento == null
              ? '—'
              : `${formatearFecha(integrante.fechaNacimiento)}${edad != null ? ` (${edad} años)` : ''}`,
        },
        // El teléfono, el origen y la dirección completa son para la tabla; en el teléfono el
        // contacto es el botón «Llamar» de la fila.
        { clave: 'telefono', etiqueta: 'Teléfono', texto: integrante.telefono ?? '—', soloTabla: true },
        {
          clave: 'origen',
          soloTabla: true,
          etiqueta: 'De dónde es',
          texto: [integrante.origen.ciudad, integrante.origen.estado]
            .filter(Boolean)
            .join(', ') || '—',
        },
        {
          clave: 'ubicacion',
          soloTabla: true,
          etiqueta: 'Dónde vive',
          texto: integrante.ubicacion.direccion ?? 'Sin ubicación marcada',
        },
      ],
      // Lo que más se hace con una persona: llamarle o corregir sus datos, a la vista
      accionVisible:
        integrante.telefono || puedeEditar ? (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {integrante.telefono ? (
              <Button
                size="small"
                variant="outlined"
                startIcon={<PhoneIcon />}
                href={`tel:${integrante.telefono.replace(/[^\d+]/g, '')}`}
              >
                Llamar
              </Button>
            ) : null}
            {puedeEditar ? (
              <FormularioIntegrante
                comoBoton
                accion="editar"
                celulaId={celulaId}
                inicial={integrante}
              />
            ) : null}
          </Stack>
        ) : undefined,
      acciones: puedeEditar ? (
        <FormularioIntegrante accion="editar" celulaId={celulaId} inicial={integrante} />
      ) : undefined,
    }
  })

  const reunion =
    celula.diaSemana != null
      ? `${DIAS_SEMANA[celula.diaSemana]}${celula.hora ? ` · ${formatearHora(celula.hora)}` : ''}`
      : 'Sin día fijo'

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        volver={{ href: `/panel/ramas/${ramaId}`, etiqueta: rama ? rama.nombre : 'Volver a la rama' }}
        titulo={celula.nombre}
        etiqueta="Célula"
        icono={<AssignmentIcon />}
        subtitulo={reunion}
      />

      {/* Resumen en una línea: la reunión ya sale en el subtítulo de arriba */}
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          size="small"
          variant="outlined"
          label={
            integrantes.length === 0
              ? 'Sin integrantes todavía'
              : `${integrantes.length} ${integrantes.length === 1 ? 'integrante' : 'integrantes'} · ${activos} ${activos === 1 ? 'activo' : 'activos'}`
          }
        />
        <Chip
          size="small"
          label={celula.activa ? 'Activa' : 'Inactiva'}
          color={celula.activa ? 'success' : 'default'}
          variant={celula.activa ? 'filled' : 'outlined'}
        />
      </Stack>

      {veAsistencia ? (
        <PaseDeLista
          celulaId={celulaId}
          integrantes={integrantes.map((integrante) => ({
            id: integrante.id,
            nombre: nombreCompleto(integrante),
            situacion: integrante.situacion,
          }))}
          fechaInicial={fechaReunion}
          asistenciasIniciales={pase.asistencias}
          hayRegistroInicial={pase.reunionId != null}
          hoyToca={hoyToca}
          diaSemanaTexto={celula.diaSemana != null ? reunion : null}
          puedePasarLista={puedePasarLista}
        />
      ) : null}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        sx={{ justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' } }}
      >
        <Box>
          <Typography variant="h4" component="h2">
            Integrantes
          </Typography>
        </Box>
        {/* En móvil la acción principal es el botón flotante del propio formulario */}
        {puedeCrear ? <FormularioIntegrante accion="crear" celulaId={celulaId} /> : null}
      </Stack>

      <ListadoResponsivo
        filas={filas}
        etiquetas={[
          'Integrante',
          'Situación',
          'Nacimiento',
          'Teléfono',
          'De dónde es',
          'Dónde vive',
        ]}
        placeholderBuscador="Buscar integrante, teléfono o dirección…"
        accionesCabecera={puedeEditar}
        mensajeVacio={
          puedeCrear
            ? 'Esta célula todavía no tiene integrantes. Agrega al primero con el botón «Nuevo integrante»: su fecha de nacimiento alimenta después los cumpleaños.'
            : 'Esta célula todavía no tiene integrantes.'
        }
      />
      {/* Datos que se consultan poco: abajo y plegados (el mapa solo se carga al abrirlos) */}
      <Accordion
        variant="outlined"
        disableGutters
        slotProps={{ transition: { unmountOnExit: true } }}
        sx={{ '&::before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box>
            <Typography variant="subtitle1">Dónde se reúne y a quién le sirve</Typography>
            <Typography variant="body2" color="text.secondary">
              Mapa de la célula y los criterios para recomendarla en el Lobby.
            </Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
          {puntoCelula ? (
            <Paper variant="outlined" sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1.5}
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                      <PlaceIcon fontSize="small" color="primary" />
                      <Typography variant="overline" color="text.secondary">
                        Dónde se reúne
                      </Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {celula.ubicacion.direccion ?? 'Punto marcado, sin dirección resuelta'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatearCoordenadas(puntoCelula.latitud, puntoCelula.longitud)}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    href={enlaceMapa(puntoCelula.latitud, puntoCelula.longitud)}
                    target="_blank"
                    rel="noopener"
                  >
                    Abrir en el mapa
                  </Button>
                </Stack>
                <MapaUbicacion
                  latitud={puntoCelula.latitud}
                  longitud={puntoCelula.longitud}
                  soloLectura
                  etiqueta={`Mapa de la célula ${celula.nombre}`}
                />
              </Stack>
            </Paper>
          ) : null}

          <FormularioCriteriosCelula
            celulaId={celulaId}
            campos={campos}
            criterios={criterios}
            puedeEditar={puedeEditarCriterios}
          />

          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}
