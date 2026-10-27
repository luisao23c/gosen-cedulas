# AGENTS.md — Gosen · Gestión de Células y Ramas

Guía de trabajo para agentes y colaboradores. **Síguela tal cual** al editar este repositorio.

Antes de empezar: lee [README.md](README.md) (visión, dominio y roadmap), [MEMORY.md](MEMORY.md) (contexto, modelo de datos y decisiones abiertas) y [DISENO.md](DISENO.md) (reglas de diseño: tipografía, color, iconos, componentes e interacción).

**También lee [DESIGN.md](DESIGN.md)** (referencia de diseño añadida por el usuario: lienzo cálido, jerarquía editorial con serif en títulos, un solo color de acento escaso, superficies que alternan claro/oscuro, radios y espaciado jerárquicos, elevación por bloques de color y no por sombras). Úsala como guía de criterio en toda pantalla nueva. Los **valores concretos** (colores, fuentes, radios) siguen saliendo de `src/theme/theme.ts` y de la marca de Gosén (Manual de Identidad): si algo de `DESIGN.md` choca con ella (p. ej. el coral y Copernicus/StyreneB frente a Cherry Mahogany y Minion Pro/Creato Display), **decisión del usuario (2026-10-27): los colores y las tipografías son SIEMPRE los de Gosén (Manual de Identidad, en `theme.ts`); los de `DESIGN.md` (coral, Copernicus, StyreneB, crema) NO se usan.** De `DESIGN.md` se toman solo los principios (jerarquía, ritmo, espaciado, radios por nivel, elevación). No toques la paleta ni las tipografías salvo que el usuario lo pida expresamente.

---

## 1. Qué es este proyecto

PWA con **Next.js + TypeScript + Material UI** para gestionar ramas y células:
integrantes, pase de lista y cumpleaños.

```
Administrador  →  Rama  →  Célula  →  Integrante
```

---

## 2. Estado actual (2026-10-27)

| Item | Estado |
| --- | --- |
| Documentación (README, MEMORY, AGENTS) | ✅ |
| Node.js en la máquina | ✅ v22.23.3 portátil en `%LOCALAPPDATA%\Programs\nodejs` (**no** está en el PATH del sistema) |
| Scaffold del proyecto Next | ✅ Next 16.4 + MUI 9.4 |
| Base de datos | ✅ MySQL 8.4.6 portátil en 3306 (si no responde, ver [MEMORY.md §11](MEMORY.md#11-entorno-y-cómo-verificar)) |
| Repositorio Git | ❌ sin inicializar |
| typecheck / lint / test / build | ✅ pasan (última verificación: 2026-10-27 · 185 pruebas, 12 archivos) |
| Ubicación por mapa (Leaflet) y registro por ubicación (rol Lobby) | ✅ (ver [MEMORY.md §7.2](MEMORY.md#72-ubicación-en-el-mapa-y-registro-por-ubicación-2026-10-10)) |
| Pase de lista (por fecha, en la ficha de la célula) y edición/baja desde los listados | ✅ (ver [MEMORY.md §7.3](MEMORY.md#73-pase-de-lista-mapa-por-defecto-en-torreón-y-bajas-desde-los-listados-2026-10-10)) |
| Cumpleaños próximos (`/panel/cumpleanos`, ventana configurable, resumen en Inicio) | ✅ (ver [MEMORY.md §7.4](MEMORY.md#74-cumpleaños-próximos-2026-10-10)) |
| Módulo de ministerios (`/panel/ministerio`: equipo, préstamos, eventos, confirmación y checada de llegada) | ✅ (ver [MEMORY.md §7.7](MEMORY.md#77-módulo-de-ministerios-2026-10-15)) |
| Texto «cédula» → «célula» en toda la app | ✅ (`npm run db:migrar-celulas` renombra la tabla antigua) |
| Mapa por defecto | ✅ Torreón, Coahuila (`mapa.centro` en `theme.ts`) |
| Tests automatizados | ✅ vitest: `pruebas/unidad` (lógica pura) y `pruebas/integracion` (MySQL `gosen_test`, se saltan solas si no hay base) · CI en `.github/workflows/ci.yml` (aún no se ha ejecutado en GitHub: el repositorio no se ha subido) |
| Modo claro / oscuro / auto | ✅ ver [DISENO.md §9](DISENO.md) · contraste AA comprobado por pruebas (`pruebas/unidad/tema.test.ts`) |
| Sin conexión | ⚠️ solo el **armazón** (`public/sw.js` + `/offline` + aviso en el panel): no guarda ni reenvía datos. Lógica probada en `sw.test.ts`; el registro del service worker **no** se pudo ejercitar en el navegador integrado (no admite service workers) |
| Manual de uso | ✅ [docs/manual/MANUAL.md](docs/manual/MANUAL.md) con 28 capturas (móvil, base de demostración `gosen_demo`; sin video) |

Cada terminal necesita:

```bash
export PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"
```

Sin ese paso, `npm`/`node` no se encuentran.

---

## 3. Reglas duras

### 3.1 Tema centralizado — el requisito más importante
- **Todo** lo visual sale de **`src/theme/theme.ts`**: colores, tipografías, radios, sombras.
- 🚫 Nada de hex, `rgb()`, `hsl()` fuera de ese archivo.
- 🚫 Nada de `fontFamily` o `fontSize` en componentes: usar variantes de `theme.typography`
  y tokens del tema (`color: 'primary.main'`, `spacing()`, `theme.shape.borderRadius`).
- **Cambiar la apariencia = editar `apariencia` en `src/theme/theme.ts`**: `paleta` (marca, bosque, oceano,
  vino, violeta, grafito, terracota), `tipografia` (marca, moderna, amigable, editorial, sistema),
  por defecto la **marca** (Manual de Identidad: Minion Pro + Creato Display, archivos en `src/fonts/`), `escalaTexto` y
  `escalaRadios`. Una paleta nueva es una línea más en `PALETAS`; una tipografía nueva, una en `TIPOGRAFIAS`
  (y su carga en `app/layout.tsx` si es de Google Fonts).
- Si necesitas un token nuevo (un color de éxito, un espaciado), **agrégalo al tema** y úsalo por referencia.
- Tan importante como el color: **radios** (`radios.*`), **sombras** (`sombras.*`), **duraciones y curvas**
  (`movimiento.*`) y **degradados** (`degradados.*`). Nada de `boxShadow: '0 2px 8px …'`, `transition: '220ms …'`
  ni `borderRadius: 16` escritos a mano en un componente.
- Tamaños de texto: variantes de `theme.typography` o el valor por defecto del componente en el tema
  (p. ej. `MuiAvatar` fija el tamaño de las iniciales). Nunca `fontSize: '0.85rem'` en un componente.
- `globals.css` no lleva colores ni `font-family`: solo reset/mínimos.
- **Modo claro y oscuro**: `colores` (de `theme.ts`) son **referencias a variables CSS** (`var(--g-fondo)`…), no hex: cambian
  solas con el modo y se usan dentro de cualquier valor de CSS (`border: \`1px solid ${colores.borde}\``). Para operar con un
  color en JavaScript (mezclar, aclarar) o para algo que no entiende `var()` (manifest, `themeColor`) están los valores reales
  en `paletaReal.claro` / `paletaReal.oscuro`. Un token de color nuevo se agrega a **`VALORES_CLAROS` y a `VALORES_OSCUROS`**
  (TypeScript exige las mismas claves). El texto sobre el degradado de marca es `colores.textoSobreMarca`, **no**
  `primary.contrastText` (en oscuro este último es oscuro). El logo cambia de versión solo (`LogoGosen`). El selector de
  apariencia vive en `PanelChrome` (`SelectorApariencia`); MUI guarda la elección y la aplica antes de pintar.

### 3.2 Idioma
- **Dominio y UI en español**: `Rama`, `Celula`, `Integrante`, `Asistencia`, `pasarLista`, `cumpleanos`.
- **Infraestructura y utilidades en inglés**: `getUser`, `formatDate`, `db`.
- Sin mezclar: un concepto no se llama en español en un archivo y en inglés en otro.
- Comentarios y strings visibles al usuario, en español.

### 3.3 TypeScript
- `strict: true`. Nada de `any` para salir del paso.
- Los tipos de dominio viven en `src/types/domain.ts`; no los dupliques en cada feature.
- Validación de datos al entrar (Zod u equivalente) — **nunca confíes del cliente**.

### 3.4 Permisos
- Los **roles son datos** (tablas `rol` y `rol_permiso`), no una lista fija: el administrador los crea y
  edita desde `/panel/roles`. Cada rol = nombre + **alcance** (`ORGANIZACION` / `RAMA` / `CELULA`) + permisos
  `recurso:accion`. Cada cuenta tiene un `rol_id`.
- Qué permisos **pueden existir** lo fija **`src/lib/auth/catalogo.ts`** (recursos × acciones, roles base,
  permisos solo de organización). Un recurso nuevo se declara ahí y aparece solo en el editor de roles.
- Los permisos se comprueban **en el servidor** antes de leer o escribir datos. Filtrar solo en la UI no es
  seguridad. `usuario.permisos` ya viene resuelto del rol en cada petición (`lib/db/usuarios.ts`).
- **Listados** → `exigirRol(accion, recurso)` (solo permiso en la página) + cláusula de alcance **dentro del SQL**.
  Nunca `exigirPermiso(..., {})`: con ámbito vacío se bloquea al rol de célula de ver sus propios datos.
- **Páginas de un objeto concreto** → `exigirPermiso(accion, recurso, ambito)` con el alcance real.
- **Server actions** → `exigirPermisoAccion(...)`, que devuelve `{error}` en lugar de redirigir.
- La lógica vive en `src/lib/auth/permisos.ts` (`puede`, `tienePermiso`, `dentroDelAlcance`, `puedeOtorgar`).
  Si hay que cambiar quién puede qué **por defecto**, se edita el rol desde la app (o `ROLES_BASE` para instalaciones nuevas).
- **Anti-escalada**: nadie asigna ni crea un rol con más permisos o más alcance que los suyos (`puedeOtorgar`).
  Los permisos de gestión (`rol:*`, `usuario:crear/editar/eliminar`) solo existen en roles de alcance organización.
- El rol **Administrador** (`es_sistema = 1`) es inmutable, siempre tiene todo el catálogo y siempre debe
  quedar al menos una cuenta activa con él (invariante en `editarUsuario`).
- Bases con el modelo antiguo (columna `usuario.rol`): `npm run db:migrar-roles` (no borra datos).
- **No usar `JSON_ARRAYAGG` (ni funciones equivalentes) para juntar los permisos**: MySQL exige el privilegio
  `EXECUTE` y el usuario de la aplicación no lo tiene (rompía el login entero). `lib/db/roles.ts` los lee con un
  `SELECT recurso, accion FROM rol_permiso` normal.
- **Los ministerios son un eje aparte**: tienen alcance propio (`MINISTERIO`) y el filtro viaja dentro del SQL
  (`lib/db/alcance.ts`). Un rol de alcance rama/célula **no ve ministerios**. Los permisos para crear/editar
  ministerios solo existen en roles de organización; y confirmar o checar el **propio** turno no exige
  `evento:asignar`/`checar`: lo autoriza la asignación (el servidor comprueba que el turno sea suyo).

### 3.5 Diseño responsivo (móvil ≠ escritorio)
- El usuario pide que **en móvil se parezca a Flutter**: `AppBar` + `BottomNavigation` + `Fab` + tarjetas.
- Escritorio: menú lateral permanente + tabla densa + botón en la cabecera.
- Los listados van con `src/components/ListadoResponsivo.tsx` (misma data, dos presentaciones).
- Cada `Formulario*.tsx` dibuja **el botón (escritorio) y el FAB (móvil)** con `AccionPrincipal` y el diálogo con
  `DialogoFormulario` (pantalla completa en móvil, centrado en escritorio); el estado común va en
  `useFormularioDialogo` (error, «guardando…», aviso de éxito, refresco). No dupliques diálogo ni lógica.
- Cabecera de pantalla con `EncabezadoPagina` (en móvil el título ya está en la barra superior).
- Medidas táctiles y de barras en `medidas` de `src/theme/theme.ts`; nada de `84px` sueltos.
- Los diálogos envían con `onSubmit` (no `action`) para que un error no borre lo escrito.
- **Sin botón flotante sobre las listas**: `AccionPrincipal` es un botón en el flujo de la página (a todo el ancho en móvil) porque el FAB tapaba las últimas filas. La regla antigua de "un solo FAB" queda como historial;
  antes decía: **Un solo FAB por pantalla**: `AccionPrincipal` lo fija abajo a la derecha, así que dos acciones
  flotantes se enciman en el mismo punto y la de abajo queda inalcanzable al tacto. La segunda acción
  va como botón normal de tamaño táctil dentro de su tarjeta (así lo hace `PaseDeLista`).
- **Barra superior con contexto**: en el teléfono `AccionPrincipal` se registra en la barra (un «+» arriba a la derecha) y `EncabezadoPagina` le da su título y el destino del «volver» (`components/CabeceraApp.tsx`). Los formularios cortos son **hojas inferiores** (`DialogoFormulario`; `completa` solo para los largos o con mapa). Ver [DISENO.md §8](DISENO.md).
- El corte es `md` del tema (MUI por defecto: 900 px) y sale siempre de `theme.breakpoints`:
  `useMediaQuery(theme.breakpoints.*)` cuando hay que medir en JavaScript, y `display: { xs, md }`
  cuando basta con el CSS (así lo hacen `ListadoResponsivo` y `PanelChrome`). **Nada de `768px`
  escritos a mano.**
- Lo que decide el diseño se decide en CSS, no esperando al JavaScript: si el primer pintado del
  teléfono depende de una medición en el cliente, el teléfono ve la vista de escritorio un momento
  (o para siempre, si el JavaScript no llega).

### 3.6 Listados y tablas — componente obligatorio
- **Toda tabla o listado de la app usa `src/components/ListadoResponsivo.tsx`.** Es el Único
  componente de listado: prohibido usar `Table`/`Card` de MUI o un listado propio para presentar
  colecciones, y prohibido crear componentes de listados paralelos.
- El componente ya trae lo que hace falta: `avatar` (iniciales + tono) por fila, `iconoVacio`, el
  contador de resultados, el atajo «/» —que solo reclama el listado con `principal` (por defecto el
  primero)— y el buscador (`placeholderBuscador`). Úsalo en vez de añadir adornos a mano.
- El componente trae **buscador de serie** (filtra por cualquier celda, sin distinguir acentos ni
  mayúsculas): todo listado tiene que poder buscarse. Pásale `placeholderBuscador` contextual
  («Buscar célula…»).
- **Móvil (< md)** → lista estil Flutter, **NO tarjetas**: filas densas con divisor, título +
  subtítulo + chip final. Las **acciones se revelan deslizando la fila hacia la izquierda** (o con
  el botón ⋮ de la propia fila).
- **Escritorio (md+)** → tabla densa con cabeceras y el mismo buscador.
- Las dos presentaciones se pintan **siempre** y el corte lo aplica el CSS del tema (`display` con
  el breakpoint `md`): el HTML que sale del servidor ya trae la lista, así el teléfono ve la vista
  móvil en el primer pintado, sin esperar a que cargue el JavaScript.
- Si hace falta otra presentación, amplía ESTE componente; no crees otro.

### 3.7 Ubicación y mapas
- **La ubicación se marca, no se escribe.** Células e integrantes guardan `latitud`/`longitud` +
  `direccion` (la que devuelve el geocodificador). Nadie pide «calle, número, colonia» a mano.
- **Todo mapa de la app sale de `src/components/MapaUbicacion.tsx`** (lienzo Leaflet) y todo campo de
  ubicación, de `src/components/CampoUbicacion.tsx` (mapa + «Usar mi ubicación» + lat/long + la
  dirección oculta que viaja en el `FormData`). No crees mapas ni campos paralelos.
- El mapa se crea **una sola vez** por montaje y sigue las props; no lo rehagas al cambiar de punto
  (se pierde el encuadre). Los callbacks se leen por ref y el módulo se carga con `import('leaflet')`.
- **Nada de `#hex` en el marcador ni en el chrome del mapa**: los colores salen del tema
  (`colores`, `radios`, `sombras`) y los valores del mapa, de `mapa` en `theme.ts`.
- Cálculos geográficos y geocodificación viven en `src/lib/geo.ts` (`distanciaKm`, `coordenadasDe`,
  `resolverDireccion`). **La dirección es un extra**: si el servicio no responde, se guardan las
  coordenadas igual y se avisa en la interfaz.
- La cercanía **sugiere**; la persona decide. Nunca inscribas a nadie en una célula por distancia sin
  que alguien lo elija.

### 3.8 Next.js / React
- App Router. **Server Components por defecto**; `"use client"` solo donde haga falta
  (MUI, formularios, interactividad).
- MUI necesita su adaptador App Router (`@mui/material-nextjs/v16-appRouter`) en `layout.tsx`.
- **El tema no se pasa como prop desde el servidor** (contiene funciones): usar `TemaProvider.tsx`.
- **No `component={Link}` desde una página Server** (MUI v9 es cliente y rechaza funciones como prop):
  usar `<Button href="...">`.
- Toda ruta que lee la sesión necesita `export const instant = false` **en la página** (Next 16).
- Las mutaciones vía Server Actions con Zod; tras guardar, `router.refresh()` en el cliente.

### 3.9 Seguridad y pruebas
- **El secreto de sesión sale de `lib/entorno.ts` (`secretoSesion()`)**, nunca de `process.env` suelto. En producción
  exige `SECRETO_SESION` propio de 32+ caracteres y **falla cerrado** (el secreto de ejemplo está en el repositorio:
  usarlo permitiría fabricar sesiones). El token vive en `lib/auth/token.ts` (lógica pura, con pruebas).
- **Inicio de sesión**: límite de intentos por correo y por IP (`lib/auth/limite.ts` + `proteccion.ts`, contadores en la
  tabla `intento_login`) y tiempo de respuesta igual exista o no el correo (`gastarTiempoDeVerificacion`). Si la tabla
  no existe, el login sigue sin límite y avisa: no rompas el acceso por una migración pendiente.
- Contraseñas nuevas: 10+ caracteres con letras y números (`validaciones.ts`). El login no exige esa regla.
- Cabeceras de seguridad y CSP en `next.config.ts` (CSP solo en producción). Si añades un origen externo (mapas,
  fuentes, analítica) hay que **declararlo ahí** o el navegador lo bloqueará.
- **Toda lógica nueva lleva prueba** en `pruebas/` (unidad si es pura; integración si toca SQL, con `describe.skipIf(!baseLista)`).
  Las pruebas de integración usan `gosen_test` y se niegan a correr contra otra base. Si una consulta junta columnas de dos
  tablas con el mismo nombre (`id`, `latitud`…), **ponles alias**: `listarMisTurnos` devolvía el id del turno como si fuera el del evento.
- Salud: `GET /api/salud` (pública, sin detalles). Errores del servidor: una línea JSON por error (`instrumentation.ts`); la pantalla de
  error muestra el `digest` como «Código del error».
- **Sin conexión** (`public/sw.js`): el service worker guarda SOLO archivos estáticos (JS/CSS/fuentes/iconos/logo) y la página
  `/offline`. **Nunca** guarda HTML del panel, respuestas RSC ni acciones del servidor (llevan datos personales y se verían
  tras cerrar sesión): `estrategia()` decide qué se toca y está probada. Si añades rutas con datos, no las metas en el caché.
  Al cambiar `sw.js` sube `VERSION`. No hay cola de captura sin red: el aviso `AvisoSinConexion` lo dice con honestidad.
- **Patrones de interfaz (2026-10-27)**: barra inferior **flotante** en móvil (píldora, `medidas.margenNavFlotante`, `sombras.alta`);
  menú lateral **colapsable** en escritorio (`useMenuCompacto`, `medidas.anchoMenuCompacto`, se recuerda en el navegador);
  todo estado vacío sale de `EstadoVacio` (no armes uno a mano); `ListadoResponsivo` acepta `filtros` por columna (por la `clave` de
  la celda; solo aparecen si hay más de una opción) y `accionVacio`; el Inicio usa rejilla tipo bento para las cifras.
- **Márgenes negativos dentro de un `Stack` no funcionan** (el `Stack` reinicia los márgenes de sus hijos): para filas que llegan
  al borde de la pantalla usa `alBorde` del tema, no `mx: -2`.
- `npm run lint` ignora `.claude/**`, `.github/skills/**` y `respaldos/**` (scripts de terceros y volcados, no código de la app).

---

## 4. Estructura

```
src/
├─ app/
│  ├─ layout.tsx          # adaptador MUI + TemaProvider
│  ├─ page.tsx            # redirección según sesión
│  ├─ (auth)/login/       # /login
│  └─ panel/              # /panel, /panel/ramas, /panel/celulas, /panel/usuarios, /panel/roles…
├─ components/            # PanelChrome, ListadoResponsivo, Formulario*, CamposIntegrante, MapaUbicacion, CampoUbicacion, PaseDeLista, AccionBaja, FiltrosCumpleanos, NavegacionMinisterio, Formulario{Equipo,Prestamo,Evento,Ministerio}, Accion{Confirmar,Llegada,Devolucion,QuitarServidor}, AsignarServidores
├─ features/              # acciones de servidor por dominio (auth · ramas · celulas · integrantes · asistencia · usuarios · roles · lobby · ministerio)
├─ lib/
│  ├─ auth/               # catalogo · sesion · permisos · guardas · contrasenas
│  ├─ fechas.ts           # hoy ISO, fecha de la reunión, formato de fecha y próximo cumpleaños
│  ├─ cumpleanos.ts       # ventanas, etiquetas («Hoy»/«En N días») y orden por célula
│  ├─ ministerio.ts       # secciones del módulo (lo comparten servidor y cliente; no es componente)
│  ├─ alcance.ts          # filtro de ministerios dentro del SQL (alcance MINISTERIO)
│  ├─ geo.ts              # distancias, coordenadas y geocodificación inversa
│  └─ db/                 # conexion(mysql2) · ramas · celulas · integrantes · asistencia · usuarios · roles · ministerios · equipos · prestamos · eventos · esquema.sql
├─ theme/theme.ts         # ★ única fuente de verdad visual
└─ types/domain.ts        # tipos del dominio

scripts/crear-esquema.mjs # npm run db:setup (esquema + datos de prueba)
```

- Una pantalla nueva = carpeta en `app/panel/...` + módulos en `features/...` y `lib/db/...`.
- No metas SQL ni datos de prueba dentro de componentes: va en `lib/db` y en `scripts/`.

---

## 5. Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (http://localhost:3000) |
| `npm run build` | Build de producción |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:setup` | ⚠️ **Recrea** el esquema MySQL y los datos de prueba |
| `npm run db:migrar-roles` | Migra una base existente al modelo de roles configurables (conserva datos, idempotente) |
| `npm run db:migrar-integrantes` | Crea la tabla `integrante` en una base existente |
| `npm run db:migrar-ubicaciones` | Añade las columnas de ubicación, retira el domicilio y el correo del integrante y el `lugar` de la célula (idempotente) |
| `npm run db:migrar-asistencia` | Crea las tablas `reunion` y `asistencia` (pase de lista) en una base existente |
| `npm run db:migrar-celulas` | Renombra la tabla antigua `cedula` a `celula` (idempotente) |
| `npm run iconos` | Regenera los íconos de la PWA y el logo claro desde `public/marca/gosen-logo.png` |
| `npm run db:migrar-ministerio` | Crea `ministerio`, `equipo`, `prestamo`, `evento` y `servidor_evento` (idempotente) |
| `npm test` | Pruebas automáticas (vitest). Las de integración necesitan `npm run db:preparar-pruebas` una vez |
| `npm run db:preparar-pruebas` | Crea/recrea la base **`gosen_test`** (nunca toca `gosen`; se niega a correr contra un host remoto) |
| `npm run db:migrar-seguridad` | Crea `intento_login` (límite de intentos de inicio de sesión; idempotente) |
| `npm run db:migrar-todo` | Ejecuta **todas** las migraciones en orden (idempotente, sin borrar datos). Con `DB_REMOTA=true` + `DB_SSL=true` sirve para Aiven |
| `npm run db:respaldar` | Respaldo de la base a `respaldos/*.sql` (sin `mysqldump`; lleva datos personales: no va a Git) |
| `npm run db:restaurar -- archivo.sql --confirmar` | ⚠️ Reemplaza la base con un respaldo |

`db:setup` con `ADMIN_CONTRASENA` (+ `ADMIN_EMAIL`) hace una **instalación limpia**: solo ese administrador, sin las
cuentas de prueba de contraseña conocida. Guía completa de publicación y operación: [DESPLIEGUE.md](DESPLIEGUE.md).

Node no está en el PATH del sistema: abrir la terminal con
`export PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"` antes de usar `npm`.

---

## 6. Checklist antes de dar una tarea por terminada

- [ ] `npm run typecheck` sin errores
- [ ] `npm run lint` sin errores
- [ ] `npm test` en verde (con MySQL encendido para que corran también las de integración)
- [ ] `npm run build` compila
- [ ] Si tocaste `src/theme/theme.ts`, nada quedó con colores/fuentes hardcodeados
- [ ] Cada consulta de datos filtrada por el alcance del rol (`usuario.alcance`)
- [ ] ¿Tocaste ubicaciones? Los mapas salen de `MapaUbicacion`/`CampoUbicacion` y la dirección nunca
      bloquea el guardado
- [ ] ¿Es una pantalla nueva? ¿Se ve bien a 390 px (tarjetas/FAB) Y a 1280 px (tabla/menú)?
- [ ] ¿Hay listados o tablas? Van con `ListadoResponsivo` (buscador + lista Flutter en móvil, §3.6)
- [ ] ¿Tocaste asistencia? El pase de lista valida en el servidor que cada integrante sea de esa
      célula (los ids llegan del cliente) y las fechas salen de `src/lib/fechas.ts`
- [ ] UI en español, sin texto en inglés salvo términos técnicos
- [ ] No hay `console.log` de depuración ni datos de prueba hardcodeados
- [ ] Actualizar [MEMORY.md](MEMORY.md) si la tarea cambió una decisión o agregó una funcionalidad

---

## 7. Qué no hacer

- No cambiar el stack (MUI, Next, Serwist) sin que el usuario lo pida.
- No reescribir la documentación de `README.md`/`MEMORY.md` para "limpiarla": son el historial.
- No inventar decisiones: si algo está en [MEMORY.md §7](MEMORY.md#7-decisiones-abiertas--️),
  **pregúntalo** en lugar de resolverlo en silencio.
- No usar `git commit`, `git push` ni desplegar sin que se pida explícitamente.
- No meterse con archivos ajenos al proyecto (p. ej. `instalar-flutter.ps1` queda como herencia).

---

## 8. Al terminar

Reporta qué se hizo, qué quedó pendiente y **qué se verificó** (typecheck / lint / build / prueba
en el navegador a 390 px y 1280 px). Si algo no se pudo comprobar, dilo explícitamente.
