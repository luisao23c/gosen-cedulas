# Gosen — Gestión de Células y Ramas

Aplicación web **PWA** para organizar la estructura de **ramas** y **células** de la comunidad, registrar a sus **integrantes**, **pasar lista** en cada reunión y dar seguimiento a cada persona (cumpleaños próximos, encuentro, bautizo, ubicación).

> **Estado del proyecto:** fases 1-5 construidas y verificadas (auth, roles, usuarios, ramas, células e
> integrantes, más diseño responsivo móvil/escritorio). Sigue pendiente: pase de lista, cumpleaños y PWA.
> Ver [Roadmap](#roadmap). El detalle técnico vivo está en [MEMORY.md](MEMORY.md).

---

## 1. ¿Qué problema resuelve?

Hoy el control de la organización (quién pertenece a cada célula, quién asistió, quién cumplió años, quién ya hizo el encuentro o está bautizado) se lleva de forma manual. La app centraliza eso en una sola base de datos con permisos por rol, accesible desde el celular como PWA instalable.

### Jerarquía de la organización

```
Administradores
   └── Líder de rama        (1 líder por rama)
          └── Célula        (varias células por rama)
                 └── Integrantes  (personas a las que se les pasa lista)
```

### Roles

> Desde 2026-10-08 los roles son **configurables**: el administrador crea roles y elige sus permisos en `/panel/roles`.
> La tabla de abajo describe los **tres roles base** que trae la instalación.

| Rol | Alcance | Puede |
| --- | --- | --- |
| **Administrador** | Toda la organización | Crear/editar/eliminar ramas y células, asignar líderes, ver y exportar todo, gestionar usuarios |
| **Líder de rama** | Su rama | Crear/editar células de su rama, ver y mover integrantes entre sus células, ver pase de lista y cumpleaños de su rama |
| **Líder de célula** | Su célula | Registrar y editar integrantes de su célula, pasar lista, ver cumpleaños de su célula |
| **Integrante** | Es un registro, no un usuario | *(fase futura: portal de consulta propia)* |

---

## 2. Funcionalidades

### MVP (fase 1)
- **Autenticación** con roles (Administrador / Líder de rama / Líder de célula).
- **CRUD de ramas** y asignación de su líder.
- **CRUD de células** dentro de una rama, con día y hora de reunión y el punto donde se reúne (mapa).
- **Registro de integrantes** dentro de una célula.
- **Pase de lista** por reunión (un registro por célula y fecha): presente / ausente / justificado / tardanza, con el día que le toca a cada célula y un aviso en Inicio.
- **Cumpleaños próximos**: quién cumple años en los próximos N días (configurable), agrupado por célula y rama.
- **Búsqueda y filtros** de integrantes (por nombre, célula, estado, bautizado, encuentro).

### Ministerios (implementado 2026-10-15)
- **Módulo `/panel/ministerio`** con pestañas: Resumen · Equipos · Préstamos · Eventos · Mis turnos.
- **Catálogo de equipo** por ministerio: nombre, descripción opcional y estatus (disponible · prestado · en mantenimiento · fuera de servicio).
- **Sala de préstamos**: quién lo trae, a quién se le asignó, hora de salida, hora de retorno y **el estado en que se recibió**. Una persona puede traer varios equipos a la vez.
- **Eventos de servicio**: fecha, **hora a la que deben estar** y el punto del mapa. El encargado arma la lista de quién sirve.
- **Confirmación de turnos**: cada servidor confirma desde su cuenta («sí voy» / «ya no puedo ir») y **checa su hora de llegada** con la ubicación de su teléfono; se guarda la hora, el punto y la distancia al punto del evento. El encargado puede marcar por quien no traenga teléfono.
- **Permisos nuevos**: recursos `ministerio`, `equipo`, `prestamo`, `evento`, acciones `asignar` y `checar`, alcance **`MINISTERIO`** y roles base «Encargado de ministerio» y «Servidor de ministerio».

### Fase 2
- Historial de asistencia por integrante y porcentaje de asistencia por célula/rama.
- Exportar a CSV/Excel e imprimir listas.
- Estadísticas de la rama (crecimiento, asistencia promedio, integrados vs. visitantes).
- Notas y seguimiento pastoral por persona.

### Fase 3 (ideas en evaluación)
- Vista de cumpleaños del mes con avisos/recordatorios.
- Eventos de la rama (retiros, vigilias) con lista de asistencia propia.
- PWA offline: pasar lista sin internet y sincronizar al recuperar conexión.
- Notificaciones push.
- Portal de solo lectura para el integrante.

### Ficha del integrante (campos solicitados)
| Campo | Tipo | Notas |
| --- | --- | --- |
| Nombre(s) | texto | |
| Apellido paterno | texto | |
| Apellido materno | texto | |
| Fecha de nacimiento | fecha | base para **cumpleaños próximos** |
| Dónde vive / de dónde es | punto del mapa + ciudad/estado | se marca en el mapa (coordenadas + dirección) y, aparte, su lugar de origen |
| ¿Ya hizo el encuentro? | sí/no | + fecha (opcional) |
| ¿Ya está bautizado? | sí/no | + fecha (opcional) |
| Célula | referencia | a qué célula pertenece |
| Estado | enum | activo · visitante · inactivo · egresado |
| Teléfono / contacto | texto | opcional |
| Notas | texto largo | opcional |

---

## 3. Stack

| Capa | Tecnología | Notas |
| --- | --- | --- |
| Framework | **Next.js 16** (App Router) | rutas con sesión en `export const instant = false` |
| Lenguaje | **TypeScript** (strict) | |
| UI | **Material UI (MUI) 9** | tema centralizado, ver §4 |
| Diseño | Responsivo **móvil ≠ escritorio** | móvil: AppBar + barra inferior + FAB + tarjetas; escritorio: menú lateral + tabla |
| PWA | **Serwist** (`@serwist/next`) | *(pendiente, Fase 8)* |
| Datos | Server Components + **Server Actions** | sin cliente de estado adicional |
| Formularios | **Zod** + acciones de servidor | diálogos MUI con `useTransition` |
| Fechas | date-fns | para cumpleaños y rangos |
| Base de datos | **MySQL 8.4** + `mysql2` | capa de datos propia en `src/lib/db`, sin ORM |
| Sesión | Cookie firmada (HMAC) + contraseñas scrypt | rol relee de la base en cada petición |

> **Requisito:** Node.js 20 o superior (instalado en esta máquina, en `%LOCALAPPDATA%\Programs\nodejs`) y
> un servidor MySQL en `127.0.0.1:3306` (ver §6).

---

## 4. Tema centralizado (requisito explícito)

**Todo el diseño —colores, tipografía, radios, sombras— se controla desde un único archivo:**

### `src/theme/theme.ts`

Es la **única fuente de verdad** de la apariencia. Nada más en el proyecto escribe hex, `font-family` ni tamaños de texto.

```ts
// src/theme/theme.ts  — editar AQUÍ para cambiar la apariencia
import { createTheme } from '@mui/material/styles'
import { Inter, Lora } from 'next/font/google'

/** 1) Tipografías: cambiar la fuente = cambiar estas dos líneas */
export const fuentes = {
  titulos: Inter({ subsets: ['latin'], variable: '--fuente-titulos', display: 'swap' }),
  texto: Inter({ subsets: ['latin'], variable: '--fuente-texto', display: 'swap' }),
}

/** 2) Colores: cambiar la paleta = cambiar estos valores */
export const colores = {
  primario: '#1B5E20',
  secundario: '#FFB300',
  fondo: '#F7F8F7',
  superficie: '#FFFFFF',
  texto: '#1A1A1A',
}

/** 3) Tema de MUI construido con lo anterior */
export const tema = createTheme({
  palette: {
    mode: 'light',
    primary: { main: colores.primario },
    secondary: { main: colores.secundario },
    background: { default: colores.fondo, paper: colores.superficie },
    text: { primary: colores.texto },
  },
  typography: {
    fontFamily: `var(--fuente-texto), system-ui, sans-serif`,
    h1: { fontFamily: 'var(--fuente-titulos)', fontWeight: 700 },
    h2: { fontFamily: 'var(--fuente-titulos)', fontWeight: 700 },
    h3: { fontFamily: 'var(--fuente-titulos)', fontWeight: 600 },
  },
  shape: { borderRadius: 12 },
})
```

**Reglas del equipo:**
1. Ningún componente usa colores literales (`#...`, `rgb()`); siempre `theme.palette.*` o `sx={{ color: 'primary.main' }}`.
2. Ningún componente declara `fontFamily` ni `fontSize` propio; usa las variantes de `theme.typography`.
3. Las dos fuentes se cargan con `next/font` **dentro del mismo archivo** y se aplican en `src/app/layout.tsx` con `className={fuentes.titulos.variable + ' ' + fuentes.texto.variable}`.
4. Si en el futuro se quiere una paleta clara/oscura alterna, se agrega en este mismo archivo.

---

## 5. Estructura de carpetas

```
gosen-cedulas/
├─ src/
│  ├─ app/
│  │  ├─ layout.tsx              # envuelve en <TemaProvider> + fuentes del tema
│  │  ├─ page.tsx                # landing / redirección según rol
│  │  ├─ globals.css             # reset mínimo (sin colores ni fuentes propias)
│  │  ├─ (auth)/login/           # /login
│  │  └─ panel/                  # rutas protegidas (/panel/...)
│  │     ├─ layout.tsx           # PanelChrome + exigirSesion
│  │     ├─ page.tsx             # panel de inicio
│  │     ├─ acceso-denegado/
│  │     ├─ ramas/               # listado + ramas/[ramaId]
│  │     ├─ celulas/             # listado de células
│  │     ├─ ministerio/          # resumen · equipos · prestamos · eventos · mis-turnos
│  │     └─ usuarios/            # gestión de cuentas (solo admin)
│  ├─ components/                # UI reutilizable (PanelChrome, ListadoResponsivo, Formulario*, NavegacionMinisterio)
│  ├─ features/                  # auth · ramas · celulas · usuarios · ministerio (server actions)
│  ├─ lib/
│  │  ├─ auth/                   # permisos.ts · guardas.ts · sesion.ts · contrasenas.ts · catalogo.ts
│  │  ├─ db/                     # conexion.ts · ramas/celulas/usuarios · ministerios/equipos/prestamos/eventos · esquema.sql
│  │  ├─ ministerio.ts           # piezas compartidas del módulo (sin ser componentes)
│  │  └─ validaciones.ts         # esquemas Zod
│  ├─ theme/theme.ts             # ★ apariencia del proyecto
│  └─ types/domain.ts            # Rama, Celula, Integrante, Asistencia, Usuario
├─ scripts/crear-esquema.mjs     # crea el esquema y las cuentas de prueba (db:setup)
├─ .env.local                    # DB_* y SECRETO_SESION (no versionado)
├─ public/                       # iconos de la PWA
├─ README.md
└─ MEMORY.md                     # contexto y decisiones del proyecto
```

**Convención de nombres:** el dominio se nombra en español (`Rama`, `Celula`, `Integrante`, `Asistencia`); la infraestructura y utilidades en inglés. Sin mezclar dentro del mismo concepto.

---

## 6. Cómo correr el proyecto

> Node.js está instalado de forma portátil en `%LOCALAPPDATA%\Programs\nodejs` (**no está en el PATH**):
> hay que ponerlo en el PATH de cada terminal antes de usar `npm`.

```bash
# 0) PATH de Node (portátil, solo en esta máquina)
export PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"

# 1) MySQL 8.4 (portátil, puerto 3306) — si no está corriendo:
"$LOCALAPPDATA/Programs/mysql/bin/mysqld.exe" --no-defaults \
  --basedir="$LOCALAPPDATA/Programs/mysql" \
  --datadir="$LOCALAPPDATA/Programs/mysql/data" \
  --port=3306 --bind-address=127.0.0.1 --console

# 2) Instalar dependencias (solo la primera vez)
npm install

# 3) Crear esquema + cuentas de prueba (solo la primera vez)
npm run db:setup

# 4) Servidor de desarrollo
npm run dev            # http://localhost:3000
```

**Cuentas de prueba** (creadas por `db:setup`):

| Correo | Contraseña | Rol |
| --- | --- | --- |
| `admin@gosen.local` | `Admin1234!` | Administrador |
| `norte@gosen.local` | `Lider1234!` | Líder de rama |
| `celula1@gosen.local` | `Lider1234!` | Líder de célula |

| Script | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:setup` | Crea el esquema MySQL y las cuentas de prueba |
| `npm run db:migrar-roles` | Migra una base con el modelo antiguo de roles |
| `npm run db:migrar-integrantes` | Crea la tabla `integrante` en una base existente |
| `npm run db:migrar-ubicaciones` | Añade las columnas de ubicación y retira domicilio y correo |
| `npm run db:migrar-asistencia` | Crea `reunion` y `asistencia` (pase de lista) |
| `npm run db:migrar-celulas` | Renombra la tabla antigua `cedula` a `celula` |
| `npm run db:migrar-ministerio` | Crea `ministerio`, `equipo`, `prestamo`, `evento`, `servidor_evento` |

---

## 7. Roadmap

- [x] **Fase 0** — README + memoria del proyecto
- [x] **Fase 1** — Node, scaffold Next + TS + MUI, `ThemeProvider` y `theme.ts`, layout base
- [x] **Fase 2** — Persistencia: MySQL 8.4 + `mysql2` + esquema y seed
- [x] **Fase 3** — Autenticación y roles (login, sesión, guardas, matriz de permisos)
- [x] **Fase 4** — Ramas, células y usuarios (CRUD con diálogos MUI)
- [x] **Diseño responsivo** móvil (tarjetas, FAB, barra inferior) / escritorio (menú lateral, tabla)
- [x] **Fase 5** — Integrantes (ficha de la célula, alta/edición, baja = INACTIVO, buscador)
- [x] **Fase 6** — Pase de lista (por fecha, con los integrantes de la célula y aviso del día que toca)
- [x] **Fase 7** — Cumpleaños próximos (pantalla `/panel/cumpleanos`: ventana de 7/15/30/60/90 días, agrupado por célula y resumen en Inicio)
- [x] **Módulo de ministerios** (equipo, préstamos, eventos con confirmación y checada de llegada por ubicación; alcance y roles propios)
- [ ] **Fase 8** — PWA instalable y offline

---

## 8. Documentación interna

- [MEMORY.md](MEMORY.md) — contexto, glosario, modelo de datos, decisiones y pendientes. **Leerlo antes de retomar el trabajo.**
