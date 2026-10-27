import { describe, expect, it } from 'vitest'
import { ROLES_BASE, todosLosPermisos, type Permiso } from '@/lib/auth/catalogo'
import {
  dentroDelAlcance,
  permisosEfectivos,
  puede,
  puedeOtorgar,
  rolPuede,
  type Identidad,
} from '@/lib/auth/permisos'
import { dentroDelMinisterio, filtroMinisterio } from '@/lib/db/alcance'

/** Identidad de prueba construida con los permisos REALES del rol base (no inventados). */
function como(
  nombreRol: string,
  territorio: Partial<Pick<Identidad, 'ramaId' | 'celulaId' | 'ministerioId'>> = {},
): Identidad {
  const rol = ROLES_BASE.find((candidato) => candidato.nombre === nombreRol)
  if (!rol) throw new Error(`No existe el rol base «${nombreRol}»`)
  return {
    alcance: rol.alcance,
    ramaId: null,
    celulaId: null,
    ministerioId: null,
    ...territorio,
    permisos: permisosEfectivos(rol.permisos, rol.alcance, rol.esSistema),
  }
}

describe('permisos · Administrador', () => {
  const admin = como('Administrador')

  it('tiene todo el catálogo', () => {
    expect(admin.permisos.length).toBe(todosLosPermisos().length)
  })

  it('puede en cualquier ministerio, rama y célula', () => {
    expect(puede(admin, 'crear', 'prestamo', { ministerioId: 99 })).toBe(true)
    expect(puede(admin, 'ver', 'celula', { ramaId: 7 })).toBe(true)
    expect(puede(admin, 'ver', 'integrante', { ramaId: 1, celulaId: 3 })).toBe(true)
  })
})

describe('permisos · Encargado de ministerio', () => {
  const encargado = como('Encargado de ministerio', { ministerioId: 1 })

  it('presta, edita eventos y asigna servidores en SU ministerio', () => {
    expect(puede(encargado, 'crear', 'prestamo', { ministerioId: 1 })).toBe(true)
    expect(puede(encargado, 'editar', 'evento', { ministerioId: 1 })).toBe(true)
    expect(puede(encargado, 'asignar', 'evento', { ministerioId: 1 })).toBe(true)
  })

  it('NO toca nada de otro ministerio', () => {
    expect(puede(encargado, 'crear', 'prestamo', { ministerioId: 2 })).toBe(false)
    expect(puede(encargado, 'editar', 'evento', { ministerioId: 2 })).toBe(false)
    expect(puede(encargado, 'ver', 'equipo', { ministerioId: 2 })).toBe(false)
  })

  it('NO crea ministerios ni ve usuarios, roles, ramas o integrantes', () => {
    expect(puede(encargado, 'crear', 'ministerio', {})).toBe(false)
    expect(rolPuede(encargado, 'ver', 'usuario')).toBe(false)
    expect(rolPuede(encargado, 'ver', 'rol')).toBe(false)
    expect(puede(encargado, 'ver', 'rama', { ramaId: 1 })).toBe(false)
    expect(puede(encargado, 'ver', 'integrante', { ramaId: 1, celulaId: 1 })).toBe(false)
  })
})

describe('permisos · Servidor de ministerio', () => {
  const servidor = como('Servidor de ministerio', { ministerioId: 1 })

  it('solo consulta lo de su ministerio', () => {
    expect(puede(servidor, 'ver', 'evento', { ministerioId: 1 })).toBe(true)
    expect(puede(servidor, 'ver', 'equipo', { ministerioId: 1 })).toBe(true)
    expect(puede(servidor, 'ver', 'evento', { ministerioId: 3 })).toBe(false)
  })

  it('NO presta, NO edita préstamos, NO crea eventos ni asigna ni checa por otro', () => {
    expect(puede(servidor, 'crear', 'prestamo', { ministerioId: 1 })).toBe(false)
    expect(puede(servidor, 'editar', 'prestamo', { ministerioId: 1 })).toBe(false)
    expect(puede(servidor, 'crear', 'evento', { ministerioId: 1 })).toBe(false)
    expect(puede(servidor, 'asignar', 'evento', { ministerioId: 1 })).toBe(false)
    expect(puede(servidor, 'checar', 'evento', { ministerioId: 1 })).toBe(false)
  })
})

describe('permisos · roles de rama y de célula', () => {
  it('el líder de rama solo ve las células de SU rama y ningún ministerio', () => {
    const lider = como('Líder de rama', { ramaId: 1 })
    expect(puede(lider, 'ver', 'celula', { ramaId: 1 })).toBe(true)
    expect(puede(lider, 'ver', 'celula', { ramaId: 2 })).toBe(false)
    expect(puede(lider, 'ver', 'ministerio', { ministerioId: 1 })).toBe(false)
  })

  it('el líder de célula solo ve a los integrantes de SU célula', () => {
    const lider = como('Líder de célula', { ramaId: 1, celulaId: 2 })
    expect(puede(lider, 'ver', 'integrante', { ramaId: 1, celulaId: 2 })).toBe(true)
    expect(puede(lider, 'ver', 'integrante', { ramaId: 1, celulaId: 3 })).toBe(false)
    expect(puede(lider, 'ver', 'equipo', { ministerioId: 1 })).toBe(false)
  })

  it('una cuenta de rama sin rama asignada no ve nada', () => {
    const huerfano = como('Líder de rama', { ramaId: null })
    expect(puede(huerfano, 'ver', 'celula', { ramaId: 1 })).toBe(false)
  })
})

describe('permisosEfectivos', () => {
  it('descarta permisos desconocidos y los que el alcance no admite', () => {
    const efectivos = permisosEfectivos(
      ['celula:ver', 'inventado:ver', 'usuario:crear', 'rol:eliminar'],
      'RAMA',
      false,
    )
    expect(efectivos).toEqual(['celula:ver'])
  })

  it('el rol de sistema siempre tiene todo, aunque la base diga menos', () => {
    expect(permisosEfectivos([], 'ORGANIZACION', true).length).toBe(todosLosPermisos().length)
  })
})

describe('puedeOtorgar (anti-escalada)', () => {
  const lider = como('Líder de rama', { ramaId: 1 })

  it('no se puede dar un rol con más alcance que el propio', () => {
    expect(puedeOtorgar(lider, { alcance: 'ORGANIZACION', permisos: ['celula:ver'] })).toBe(false)
  })

  it('no se puede dar un rol con permisos que uno no tiene', () => {
    const permisoAjeno: Permiso = 'usuario:crear'
    expect(puedeOtorgar(lider, { alcance: 'RAMA', permisos: [permisoAjeno] })).toBe(false)
  })

  it('sí se puede dar un rol igual o menor', () => {
    expect(puedeOtorgar(lider, { alcance: 'CELULA', permisos: ['integrante:ver'] })).toBe(true)
  })
})

describe('alcance de ministerios (dentro del SQL)', () => {
  it('organización: sin restricción', () => {
    expect(filtroMinisterio({ alcance: 'ORGANIZACION', ministerioId: null }).sql).toBe('1 = 1')
  })

  it('ministerio: solo el suyo, con parámetro (nunca texto pegado al SQL)', () => {
    const filtro = filtroMinisterio({ alcance: 'MINISTERIO', ministerioId: 4 }, 'e.ministerio_id')
    expect(filtro.sql).toBe('e.ministerio_id = ?')
    expect(filtro.parametros).toEqual([4])
  })

  it('ministerio sin ministerio asignado, rama y célula: no ven nada', () => {
    expect(filtroMinisterio({ alcance: 'MINISTERIO', ministerioId: null }).sql).toBe('1 = 0')
    expect(filtroMinisterio({ alcance: 'RAMA', ministerioId: null }).sql).toBe('1 = 0')
    expect(filtroMinisterio({ alcance: 'CELULA', ministerioId: null }).sql).toBe('1 = 0')
  })

  it('dentroDelMinisterio y dentroDelAlcance coinciden', () => {
    const cuenta = { alcance: 'MINISTERIO' as const, ministerioId: 1, ramaId: null, celulaId: null }
    expect(dentroDelMinisterio(cuenta, 1)).toBe(true)
    expect(dentroDelMinisterio(cuenta, 2)).toBe(false)
    expect(dentroDelMinisterio(cuenta, null)).toBe(false)
    expect(dentroDelAlcance(cuenta, { ministerioId: 1 })).toBe(true)
    expect(dentroDelAlcance(cuenta, { ministerioId: 2 })).toBe(false)
  })
})
