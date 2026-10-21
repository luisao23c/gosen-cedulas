import { Stack } from '@mui/material'
import TuneIcon from '@mui/icons-material/Tune'
import { exigirRol } from '@/lib/auth/guardas'
import { puede } from '@/lib/auth/permisos'
import { listarCampos, usosDeCampos } from '@/lib/db/campos'
import { ETIQUETAS_TIPO_CAMPO, type CampoDiferenciador } from '@/types/domain'
import EncabezadoPagina from '@/components/EncabezadoPagina'
import FormularioCampo from '@/components/FormularioCampo'
import ListadoResponsivo, { type FilaListado } from '@/components/ListadoResponsivo'

export const instant = false
export const metadata = { title: 'Campos · Gosen' }

/** Resumen de lo que acepta un campo, en una línea («4 opciones», «18 a 99 años»). */
function resumenDeCampo(campo: CampoDiferenciador): string {
  if (campo.tipo === 'SELECT') {
    const total = campo.opciones.length
    return total === 1 ? '1 opción' : `${total} opciones`
  }
  const unidad = campo.unidad ? ` ${campo.unidad}` : ''
  if (campo.limiteInferior != null && campo.limiteSuperior != null) {
    return `${campo.limiteInferior} a ${campo.limiteSuperior}${unidad}`
  }
  if (campo.limiteInferior != null) return `desde ${campo.limiteInferior}${unidad}`
  if (campo.limiteSuperior != null) return `hasta ${campo.limiteSuperior}${unidad}`
  return 'número libre'
}

/**
 * Catálogo de preguntas con las que las células dicen a quién les sirven.
 *
 * Tres piezas que se editan en tres sitios (ver MEMORY §7.8):
 *  · el catálogo vive aquí (`/panel/campos`), es de toda la organización;
 *  · cada célula declara qué respuestas acepta, en su ficha;
 *  · cada persona responde en Lobby o en su ficha.
 */
export default async function PaginaCampos() {
  const usuario = await exigirRol('ver', 'campo')
  const campos = await listarCampos(false)
  const usos = await usosDeCampos()

  const puedeCrear = puede(usuario, 'crear', 'campo')
  const puedeEditar = puede(usuario, 'editar', 'campo')
  const activos = campos.filter((campo) => campo.activo).length

  const filas: FilaListado[] = campos.map((campo) => {
    const uso = usos.get(campo.id) ?? { respuestas: 0, criterios: 0 }
    return {
      id: campo.id,
      avatar: { texto: campo.nombre.slice(0, 2), tono: campo.activo ? 'primary' : 'default' },
      celdas: [
        { clave: 'nombre', etiqueta: 'Campo', texto: campo.nombre, destacado: true },
        {
          clave: 'descripcion',
          etiqueta: 'Para qué sirve',
          texto: campo.descripcion ?? '—',
        },
        {
          clave: 'tipo',
          etiqueta: 'Tipo',
          texto: ETIQUETAS_TIPO_CAMPO[campo.tipo],
          chip: { etiqueta: ETIQUETAS_TIPO_CAMPO[campo.tipo], tono: 'primary' },
        },
        { clave: 'resumen', etiqueta: 'Acepta', texto: resumenDeCampo(campo), conEtiqueta: true },
        {
          clave: 'uso',
          etiqueta: 'Se usa en',
          texto: `${uso.criterios} ${uso.criterios === 1 ? 'célula' : 'células'} · ${
            uso.respuestas
          } ${uso.respuestas === 1 ? 'respuesta' : 'respuestas'}`,
          // En el teléfono va como chip corto: el subtítulo de la fila se recorta a
          // dos líneas y el uso se quedaba a medias («Se usa en: …»).
          chip: {
            etiqueta: `${uso.criterios} ${uso.criterios === 1 ? 'célula' : 'células'} · ${uso.respuestas} resp.`,
            tono: 'default',
          },
        },
        {
          clave: 'estado',
          etiqueta: 'Estado',
          texto: campo.activo ? 'Activo' : 'Oculto',
          chip: { etiqueta: campo.activo ? 'Activo' : 'Oculto', tono: campo.activo ? 'success' : 'default' },
        },
      ],
      acciones: puedeEditar ? (
        <FormularioCampo accion="editar" inicial={campo} puedeEliminar={puede(usuario, 'eliminar', 'campo')} />
      ) : undefined,
    }
  })

  return (
    <Stack spacing={3}>
      <EncabezadoPagina
        titulo="Campos"
        etiqueta="Organización"
        icono={<TuneIcon />}
        subtitulo={`${campos.length} ${campos.length === 1 ? 'pregunta' : 'preguntas'} en el catálogo, ${activos} ${
          activos === 1 ? 'activa' : 'activas'
        }. Las células eligen cuáles aceptan; la gente las responde en el registro.`}
      >
        {puedeCrear ? <FormularioCampo accion="crear" /> : null}
      </EncabezadoPagina>

      <ListadoResponsivo
        filas={filas}
        etiquetas={['Campo', 'Para qué sirve', 'Tipo', 'Acepta', 'Se usa en', 'Estado']}
        placeholderBuscador="Buscar campo…"
        accionesCabecera={puedeEditar}
        mensajeVacio="Todavía no hay preguntas en el catálogo. Crea la primera: por ejemplo «Estado civil» con sus opciones."
      />
    </Stack>
  )
}
