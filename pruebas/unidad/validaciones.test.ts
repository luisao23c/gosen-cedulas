import { describe, expect, it } from 'vitest'
import {
  esquemaCampo,
  esquemaCriterio,
  esquemaDevolucion,
  esquemaEvento,
  esquemaLlegada,
  esquemaLogin,
  esquemaPaseDeLista,
  esquemaPrestamo,
  esquemaRol,
  esquemaUsuario,
  esquemaUsuarioEdicion,
  primerError,
} from '@/lib/validaciones'

/** Un formulario llega como texto: así se prueba, tal cual lo entrega FormData. */
const formulario = (campos: Record<string, string>) => campos

describe('esquemaLogin', () => {
  it('normaliza el correo (recorta y pasa a minúsculas)', () => {
    const resultado = esquemaLogin.safeParse({ email: '  Ana@Gosen.Test ', contrasena: 'x' })
    expect(resultado.success && resultado.data.email).toBe('ana@gosen.test')
  })

  it('rechaza correo mal escrito y contraseña vacía', () => {
    expect(esquemaLogin.safeParse({ email: 'no-es-correo', contrasena: 'x' }).success).toBe(false)
    expect(esquemaLogin.safeParse({ email: 'ana@gosen.test', contrasena: '' }).success).toBe(false)
  })
})

describe('esquemaUsuario', () => {
  const base = {
    email: 'nuevo@gosen.test',
    nombre: 'Nuevo Usuario',
    contrasena: 'una-clave-larga-1',
    rolId: '2',
    ramaId: '',
    celulaId: '',
    ministerioId: '',
  }

  it('convierte ids de formulario y deja vacío como null', () => {
    const resultado = esquemaUsuario.safeParse(base)
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.rolId).toBe(2)
      expect(resultado.data.ramaId).toBeNull()
    }
  })

  it('exige contraseña de 10 caracteres o más, con letras y números', () => {
    const corta = esquemaUsuario.safeParse({ ...base, contrasena: 'Corta1' })
    expect(corta.success).toBe(false)
    expect(primerError(corta)).toMatch(/10 caracteres/)

    const soloLetras = esquemaUsuario.safeParse({ ...base, contrasena: 'solo-letras-largas' })
    expect(soloLetras.success).toBe(false)
    expect(primerError(soloLetras)).toMatch(/letras y números/)

    expect(esquemaUsuario.safeParse({ ...base, contrasena: '1234567890123' }).success).toBe(false)
    expect(esquemaUsuario.safeParse({ ...base, contrasena: 'contraseña-ñandú-9' }).success).toBe(true) // acentos y ñ valen como letras
  })

  it('al editar, la contraseña vacía significa «no cambiar» y una nueva sigue la misma regla', () => {
    const edicion = { nombre: 'Nombre Largo', rolId: '2', ramaId: '', celulaId: '', ministerioId: '', activa: 'on' }
    const sinCambio = esquemaUsuarioEdicion.safeParse({ ...edicion, contrasena: '' })
    expect(sinCambio.success && sinCambio.data.contrasena).toBeNull()
    expect(esquemaUsuarioEdicion.safeParse({ ...edicion, contrasena: 'corta1' }).success).toBe(false)
    expect(esquemaUsuarioEdicion.safeParse({ ...edicion, contrasena: 'una-clave-larga-1' }).success).toBe(true)
  })

  it('rechaza un rol que no sea un número', () => {
    expect(esquemaUsuario.safeParse({ ...base, rolId: 'admin' }).success).toBe(false)
    expect(esquemaUsuario.safeParse({ ...base, rolId: '0' }).success).toBe(false)
    expect(esquemaUsuario.safeParse({ ...base, rolId: '-3' }).success).toBe(false)
  })
})

describe('esquemaRol', () => {
  it('rechaza permisos que no existen en el catálogo', () => {
    const resultado = esquemaRol.safeParse({
      nombre: 'Rol raro',
      descripcion: '',
      alcance: 'RAMA',
      permisos: ['celula:ver', 'hackear:todo'],
    })
    expect(resultado.success).toBe(false)
  })

  it('quita permisos repetidos y rechaza un alcance inventado', () => {
    const bueno = esquemaRol.safeParse({
      nombre: 'Rol bueno',
      descripcion: '',
      alcance: 'RAMA',
      permisos: ['celula:ver', 'celula:ver'],
    })
    expect(bueno.success && bueno.data.permisos).toEqual(['celula:ver'])
    expect(
      esquemaRol.safeParse({ nombre: 'Rol malo', alcance: 'GALAXIA', permisos: [] }).success,
    ).toBe(false)
  })
})

describe('esquemaPrestamo', () => {
  const base = formulario({
    equipoId: '5',
    asignadoAId: '9',
    eventoId: '',
    entregado: 'on',
    estadoEntrega: 'BUENO',
    notas: '',
  })

  it('un préstamo normal pasa; la casilla «entregado» marcada es true', () => {
    const resultado = esquemaPrestamo.safeParse(base)
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.entregado).toBe(true)
      expect(resultado.data.eventoId).toBeNull()
    }
  })

  it('sin marcar la casilla queda «por recoger» (false), no se interpreta «false» como verdadero', () => {
    const sin = esquemaPrestamo.safeParse({ ...base, entregado: undefined })
    expect(sin.success && sin.data.entregado).toBe(false)
    const texto = esquemaPrestamo.safeParse({ ...base, entregado: 'false' })
    expect(texto.success && texto.data.entregado).toBe(false)
  })

  it('exige a quién se le presta', () => {
    expect(esquemaPrestamo.safeParse({ ...base, asignadoAId: '' }).success).toBe(false)
  })

  it('rechaza un estado de conservación inventado', () => {
    expect(esquemaPrestamo.safeParse({ ...base, estadoEntrega: 'ROTO' }).success).toBe(false)
  })
})

describe('esquemaDevolucion', () => {
  it('pide el estado en que vuelve el equipo', () => {
    expect(esquemaDevolucion.safeParse({ id: '3', estadoDevolucion: 'DANADO', notas: 'Sin cable' }).success).toBe(true)
    expect(esquemaDevolucion.safeParse({ id: '3', estadoDevolucion: '' }).success).toBe(false)
  })
})

describe('esquemaEvento', () => {
  const base = { ministerioId: '1', nombre: 'Culto del domingo', descripcion: '', fecha: '2026-10-18', hora: '09:30' }

  it('acepta fecha y hora bien escritas', () => {
    expect(esquemaEvento.safeParse(base).success).toBe(true)
  })

  it('rechaza fecha u hora con otro formato, y coordenadas fuera de rango', () => {
    expect(esquemaEvento.safeParse({ ...base, fecha: '18/10/2026' }).success).toBe(false)
    expect(esquemaEvento.safeParse({ ...base, hora: '25:00' }).success).toBe(false)
    expect(esquemaEvento.safeParse({ ...base, latitud: '95', longitud: '0' }).success).toBe(false)
    expect(esquemaEvento.safeParse({ ...base, latitud: '25.5', longitud: '-103.4' }).success).toBe(true)
  })
})

describe('esquemaLlegada', () => {
  it('«usuarioId» vacío significa mi propio turno', () => {
    const resultado = esquemaLlegada.safeParse({ eventoId: '4', usuarioId: '', llegoEn: '' })
    expect(resultado.success && resultado.data.usuarioId).toBeNull()
  })

  it('la hora de llegada debe tener formato AAAA-MM-DDTHH:MM', () => {
    expect(esquemaLlegada.safeParse({ eventoId: '4', llegoEn: '2026-10-18T09:12' }).success).toBe(true)
    expect(esquemaLlegada.safeParse({ eventoId: '4', llegoEn: 'ayer' }).success).toBe(false)
  })
})

describe('esquemaPaseDeLista', () => {
  it('si un integrante viene repetido, manda la última marca', () => {
    const resultado = esquemaPaseDeLista.safeParse({
      celulaId: '2',
      fecha: '2026-10-11',
      asistencias: [
        { integranteId: 1, estado: 'AUSENTE' },
        { integranteId: 2, estado: 'PRESENTE' },
        { integranteId: 1, estado: 'PRESENTE' },
      ],
    })
    expect(resultado.success).toBe(true)
    if (resultado.success) {
      expect(resultado.data.asistencias).toHaveLength(2)
      expect(resultado.data.asistencias.find((asistencia) => asistencia.integranteId === 1)?.estado).toBe('PRESENTE')
    }
  })

  it('rechaza lista vacía, estado inventado y lista gigantesca', () => {
    const base = { celulaId: '2', fecha: '2026-10-11' }
    expect(esquemaPaseDeLista.safeParse({ ...base, asistencias: [] }).success).toBe(false)
    expect(
      esquemaPaseDeLista.safeParse({ ...base, asistencias: [{ integranteId: 1, estado: 'VOLANDO' }] }).success,
    ).toBe(false)
    const demasiados = Array.from({ length: 501 }, (_, indice) => ({ integranteId: indice + 1, estado: 'PRESENTE' }))
    expect(esquemaPaseDeLista.safeParse({ ...base, asistencias: demasiados }).success).toBe(false)
  })
})

describe('esquemaCampo / esquemaCriterio', () => {
  it('un campo de opciones necesita opciones y no admite repetidas', () => {
    const base = { nombre: 'Estado civil', tipo: 'SELECT', descripcion: '', unidad: '', limiteInferior: '', limiteSuperior: '' }
    expect(esquemaCampo.safeParse({ ...base, opciones: [] }).success).toBe(false)
    expect(esquemaCampo.safeParse({ ...base, opciones: ['Soltero', 'soltero'] }).success).toBe(false)
    expect(esquemaCampo.safeParse({ ...base, opciones: ['Soltero', 'Casado'] }).success).toBe(true)
  })

  it('un rango con el límite mayor por debajo del menor se rechaza', () => {
    const base = { nombre: 'Edad', tipo: 'RANGO', descripcion: '', unidad: 'años', opciones: [] }
    expect(esquemaCampo.safeParse({ ...base, limiteInferior: '30', limiteSuperior: '10' }).success).toBe(false)
    expect(esquemaCampo.safeParse({ ...base, limiteInferior: '10', limiteSuperior: '30' }).success).toBe(true)
  })

  it('un criterio de rango pide al menos un límite; uno de opciones, al menos una opción', () => {
    const base = { campoId: '1', obligatorio: 'on', opcionIds: [], minimo: '', maximo: '' }
    expect(esquemaCriterio.safeParse({ ...base, tipo: 'RANGO' }).success).toBe(false)
    expect(esquemaCriterio.safeParse({ ...base, tipo: 'RANGO', minimo: '18' }).success).toBe(true)
    expect(esquemaCriterio.safeParse({ ...base, tipo: 'SELECT' }).success).toBe(false)
    expect(esquemaCriterio.safeParse({ ...base, tipo: 'SELECT', opcionIds: [3] }).success).toBe(true)
  })
})
