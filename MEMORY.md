# MEMORY — Gosen · Gestión de Células y Ramas

Memoria de trabajo del proyecto. **Leer este archivo antes de retomar cualquier tarea**,
junto con [README.md](README.md) (visión y roadmap) y [AGENTS.md](AGENTS.md) (reglas para trabajar en el código).

> Última actualización: **2026-10-09** (diseño: sistema de tokens + rediseño de interacción, además de la Fase 5: integrantes)

---

## 1. Contexto

- **Proyecto:** PWA (Next.js + TypeScript + Material UI) para gestionar la estructura de **ramas** y **células** de una comunidad: integrantes, pase de lista y cumpleaños. Desde 2026-10-15 incluye el **módulo de ministerios**: equipo, préstamos de equipo y eventos de servicio con confirmación y checada de llegada (ver §7.7).
- **Carpeta del proyecto:** `C:\Users\Luis\Desktop\gosen-cedulas`
- **Idioma:** el usuario trabaja en **español**. La UI, los comentarios de dominio y la documentación van en español. La infraestructura (helpers, config, nombres de utilidades) en inglés.
- **Máquina del usuario:** Windows, usuario `Luis`.
  - Node **v22.23.3** instalado en `%LOCALAPPDATA%\Programs\nodejs` (portátil, **sin** estar en el PATH del sistema: cada terminal necesita `export PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"`).
  - MySQL **8.4.6** portátil en `%LOCALAPPDATA%\Programs\mysql` (ver §9).
  - `git` 2.56.0 disponible; **el proyecto sigue sin `git init`**.
- Se abandonó una ruta previa con Flutter; este proyecto es el reemplazo (`instalar-flutter.ps1` es herencia, candidato a borrar).

## 2. Modelo de la organización

```
Administrador
   └── Rama  (tiene 1 líder)
          └── Célula  (varias por rama; tiene 1 líder)
                 └── Integrante  (a cada uno se le pasa lista)

Ministerio  (área de servicio: cámaras, alabanza, sonido…)
   ├── Equipo  (inventario; se presta y se devuelve)
   └── Evento de servicio  (fecha + hora a la que deben estar + punto del mapa)
              └── Servidor  (confirma su turno y checa su llegada)
```

- **Administrador** → todo el sistema.
- **Líder de rama** → su rama (células e integrantes dentro de ella).
- **Líder de célula** → su célula (integrantes, pase de lista).
- Un **integrante** es un registro de persona; no es una cuenta de usuario.
- Los **ministerios** son un eje aparte: **cruzan las ramas**, no cuelgan de ellas. Por eso
  tienen su propio alcance de permisos (`MINISTERIO`) y sus cuentas empiezan sesión con
  un rol de ese alcance (ver §6 y §7.7).

## 3. Glosario

| Término | Significado en el sistema |
| --- | --- |
| **Rama** | Unidad superior. Agrupa células. Tiene nombre y líder. |
| **Célula** | Unidad operativa dentro de una rama. Agrupa integrantes y tiene su reunión (día y hora + el punto donde se reúne). |
| **Integrante** | Persona inscrita en una célula, a la que se le pasa lista. |
| **Pase de lista** | Registro de asistencia de los integrantes de una célula en una reunión concreta (fecha). |
| **Encuentro** | Un paso de la formación. Campo booleano `hizoEncuentro`. |
| **Bautizo** | Campo booleano `estaBautizado`. |
| **Cumpleaños próximos** | Reporte derivado: integrantes que cumplen años en una ventana de N días desde hoy (día y mes, ignorando el año). |
| **Ministerio** | Área de servicio de la iglesia (cámaras, alabanza, sonido…). Tiene su inventario, sus préstamos y sus eventos. |
| **Equipo** | Pieza del inventario de un ministerio: nombre, descripción opcional y estatus (disponible · prestado · en mantenimiento · fuera de servicio). |
| **Préstamo** | Un equipo que salió con alguien: quién lo trae, a quién se le asignó, a qué hora salió y a qué hora y **en qué estado** volvió. |
| **Evento de servicio** | Día en que sirve el ministerio: fecha, **hora a la que deben estar** y el punto del mapa donde hay que estar. |
| **Servidor (turno)** | Quién sirve en un evento. Confirma («sí voy») y checa su **hora de llegada** con la ubicación del teléfono. |

## 4. Modelo de datos

**Implementado hoy** (ver `src/lib/db/esquema.sql`, se aplica con `npm run db:setup`):

```
rol          id · nombre(único) · descripcion · alcance ENUM('ORGANIZACION','RAMA','CELULA')
             · es_sistema (Administrador: protegido, siempre con todo el catálogo)
rol_permiso  rol_id → rol · recurso · accion   (PK compuesta; valores válidos en lib/auth/catalogo.ts)

usuario   id · email(únicо) · nombre · contrasena_hash(scrypt$N$r$p$salt$hash)
          · rol_id → rol  (antes: ENUM fijo `rol`; ver «db:migrar-roles»)
          · rama_id (alcance RAMA; en alcance CELULA se deduce de la célula) · celula_id (alcance CELULA)
          · ministerio_id (alcance MINISTERIO: el ministerio al que pertenece la cuenta) · activo

rama      id · nombre(únicо) · descripcion · lider_id → usuario · activa · creado_en

celula    id · rama_id → rama · nombre · lider_id → usuario
          · dia_semana(0=dom..6=sáb) · hora · activa
          · latitud · longitud (DECIMAL 10,7) · direccion(300) # punto del mapa
          · UNIQUE(rama_id, nombre)

integrante id · celula_id → celula · nombre · apellido_paterno · apellido_materno
          · fecha_nacimiento (date)                          # cumpleaños (se ignora el año)
          · latitud · longitud (DECIMAL 10,7) · direccion(300) # dónde vive (mapa)
          · origen_ciudad · origen_estado                    # "de dónde es"
          · hizo_encuentro (bool) · fecha_encuentro (date)
          · bautizado (bool) · fecha_bautizo (date)
          · situacion ENUM('ACTIVO','VISITANTE','INACTIVO','EGRESADO')
          · telefono · notas · creado_en · actualizado_en
          · KEY (celula_id) · KEY (apellido_paterno, apellido_materno, nombre)
```

`latitud`/`longitud`/`direccion` tienen el mismo significado en las dos tablas: **el punto que se
marca en el mapa y la dirección que devuelve el geocodificador**. El domicilio escrito a mano
(calle, número, colonia, ciudad, estado, CP) y el `email` del integrante **ya no existen**: se
sustituyeron por la ubicación (decisión del usuario, 2026-10-10). `db:migrar-ubicaciones` los
convierte en `direccion` antes de borrarlos, así que no se pierde lo escrito.

```
reunion      id · celula_id → celula · fecha(date) · creado_en
             · UNIQUE(celula_id, fecha)     # una reunión por célula y día

asistencia   id · reunion_id → reunion · integrante_id → integrante
             · estado ENUM('PRESENTE','AUSENTE','TARDANZA','JUSTIFICADO')
             · UNIQUE(reunion_id, integrante_id)
```

Módulo de ministerios (2026-10-15; ver §7.7):

```
ministerio  id · nombre(único) · descripcion · encargado_id → usuario · activo · creado_en

equipo      id · ministerio_id → ministerio · nombre · descripcion
            · estatus ENUM('DISPONIBLE','PRESTADO','MANTENIMIENTO','BAJA')
            · UNIQUE(ministerio_id, nombre)     # una pieza no se define dos veces

prestamo    id · equipo_id → equipo · responsable_id → usuario  # quien lo trae
            · asignado_a_id → usuario (NULL)                     # a quién se le asigna
            · prestado_en · devuelto_en (NULL = sigue fuera)
            · estado_entrega ENUM('BUENO','CON_DETALLE','DANADO')
            · estado_devolucion ENUM(...) NULL                   # en qué estado volvió
            · notas · registrado_por_id · devuelto_por_id

evento      id · ministerio_id → ministerio · nombre · descripcion · fecha
            · hora_llegada TIME        # a qué hora deben estar
            · latitud · longitud · direccion   # el punto donde hay que estar
            · creado_por_id · activo

servidor_evento   id · evento_id → evento · usuario_id → usuario
            · confirmado · confirmado_en       # «sí voy»
            · llego_en · latitud · longitud · direccion   # «ya estoy aquí» + dónde checó
            · registrado_por_id                # quién lo registró (él mismo / el encargado)
            · UNIQUE(evento_id, usuario_id)    # un turno por persona y evento
```

De ese borrador **no se implementaron** `tipo`, `notas`, `creadoPor` ni `minutosRetraso`: no hay nada
que los use todavía (misma regla que con el domicilio y el correo: no se pide lo que no se usa). El
pase de lista se guarda con `INSERT … ON DUPLICATE KEY UPDATE`, así que volver a pasar lista el mismo
día corrige lo que había. Ver §7.3.

### Reglas de negocio
1. Un integrante pertenece a **una sola célula** a la vez.
2. La asistencia es **por reunión**: se abre una reunión con fecha y se marcan estados.
3. **Cumpleaños próximos**: ventana configurable (30 días por defecto), ignorando el año.
4. El rol determina el alcance: **el filtrado ocurre en el servidor (SQL)**, nunca solo en la UI.
5. Desactivar en lugar de borrar: `activa = 0`, `activo = 0` y, en integrantes,
   `situacion = 'INACTIVO'` (se conserva el historial; la baja no borra la fila).
6. **La ubicación se marca en el mapa, no se escribe**: células e integrantes guardan el punto
   (latitud/longitud) y la dirección que se obtiene de él. Marcar el punto es **opcional** (hay
   personas de las que no se sabe la dirección), y quien no lo marca aparece como «Sin ubicación».
7. Para inscribir a alguien nuevo se puede partir de **dónde vive**: el registro por ubicación
   (rol Lobby) ordena las células por cercanía y **la decisión de en cuál inscribirlo es humana**.
   El sistema solo propone (la más cercana va preseleccionada); nunca elige solo.
8. **Ministerios**: las cuentas de un ministerio tienen `usuario.ministerio_id` y un rol de alcance
   `MINISTERIO`; el filtro de sus datos viaja dentro del SQL (`filtroMinisterio`), igual que en ramas
   y células. Un rol de alcance rama/célula **no ve ministerios** (no cuelgan de las ramas).
9. **Checada de llegada**: quien sirve marca su llegada con la ubicación de su teléfono y el sistema
   guarda la hora, el punto y **la distancia contra el punto del evento**. El encargado puede marcar
   por quien no traiga teléfono (hora escrita a mano) y queda anotado que lo hizo él.
   Confirmar o checar el **propio** turno no exige permiso `evento:asignar`/`checar`: lo autoriza la
   asignación (el servidor comprueba que el turno sea suyo).

## 5. Requisito de diseño centralizado (expreso del usuario)

> *"que sea fácil cambiar la tipografía y colores del diseño en un archivo, porque se cambiarán después"*

- **Único archivo:** `src/theme/theme.ts` → exporta `fuentes`, `colores` y `tema` (MUI).
- Ningún componente puede escribir hex, `rgb()`, `fontFamily` ni tamaños de fuente propios.
- Las fuentes están como *strings* de sistema en `fuentes` (sin `next/font` para no atar el build a
  Google Fonts); el bloque comentado dentro del archivo muestra cómo cambiarlo a `next/font/google`.
- El tema **no se pasa como prop** desde un Server Component (MUI v9 lo rechaza: el tema contiene
  funciones). Se usa `src/components/TemaProvider.tsx` (`'use client'`) que importa el tema.
- Ver reglas completas en [README.md §4](README.md#4-tema-centralizado-requisito-explicito).

## 6. Arquitectura de permisos (implementada · roles configurables desde 2026-10-08)

Los roles **ya no son fijos**: son filas de `rol` + `rol_permiso`, editables en `/panel/roles`.

| Pieza | Archivo | Para qué |
| --- | --- | --- |
| Catálogo (recursos × acciones, alcances, roles base) | `src/lib/auth/catalogo.ts` | Lista cerrada de permisos que PUEDEN existir; sin imports del proyecto (la usan también los scripts) |
| `puede`, `tienePermiso`, `dentroDelAlcance`, `puedeOtorgar`, `permisosEfectivos` | `src/lib/auth/permisos.ts` | Decisión de permiso; `puedeOtorgar` = anti-escalada |
| `exigirSesion()` | `src/lib/auth/guardas.ts` | Páginas que solo necesitan estar dentro |
| `exigirRol(accion, recurso)` | `src/lib/auth/guardas.ts` | **Listados**: comprueba el permiso; el alcance lo aplica el SQL |
| `exigirPermiso(accion, recurso, ambito)` | `src/lib/auth/guardas.ts` | Páginas de un objeto concreto |
| `exigirPermisoAccion(...)` | `src/lib/auth/guardas.ts` | Server actions: devuelve `{error}` (no redirige) |
| Roles: datos y acciones | `src/lib/db/roles.ts`, `src/features/roles/acciones.ts` | CRUD de roles con transacción |
| Sesión: cookie `gosen_sesion` firmada HMAC (scrypt para contraseñas) | `src/lib/auth/sesion.ts`, `contrasenas.ts` | 7 días, httpOnly; **usuario + permisos del rol se recargan de la base en cada petición**: editar un rol surte efecto al instante |
| `instant = false` | páginas de `src/app/panel/**` y `src/app/page.tsx` | Las rutas con sesión se renderizan por petición |

**Reglas del modelo**
- Alcance del rol: `ORGANIZACION` (todo) · `RAMA` (la rama de la cuenta) · `CELULA` (la célula de la cuenta). Lo aplica el SQL de `ramas.ts`/`celulas.ts`/`usuarios.ts`/`integrantes.ts` (aquí con `JOIN celula`: el integrante se acota por la rama de su célula).
- **Administrador** (`es_sistema`): no se edita ni borra, siempre tiene todo el catálogo (un permiso nuevo no lo deja fuera) y debe quedar ≥ 1 cuenta activa con él.
- **Anti-escalada**: solo se asigna/crea/edita/borra un rol si quien actúa tiene todos sus permisos y alcance ≥. Tampoco se edita a una cuenta con más poder que uno.
- Permisos solo de organización: `rol:*` y `usuario:crear/editar/eliminar` (un rol de rama/célula no puede llevarlos; se descartan además al cargarlos).
- No se puede cambiar el alcance de un rol con cuentas, ni borrar un rol en uso.
- Listados de usuarios: alcance RAMA ve su rama + sus células + cuentas de organización; alcance CELULA su célula + organización.

**Regla clave aprendida a golpes:** en un **listado** no existe aún el objeto del que colgar el
alcance → usa `exigirRol` (permiso en página) + `WHERE` de alcance en el SQL. Usar `exigirPermiso` con
`ambito {}` en un listado **bloquea al rol de célula** de ver sus propios datos.

**Cuentas de prueba** (creadas por `npm run db:setup`, solo desarrollo):

| Rol | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@gosen.local` | `Admin1234!` |
| Líder de rama | `norte@gosen.local` | `Lider1234!` |
| Líder de célula | `celula1@gosen.local` | `Lider1234!` |
| Lobby | `lobby@gosen.local` | `Lider1234!` |

## 7. Diseño responsivo (patrón Material/Flutter)

El usuario pidió que **en móvil se parezca más a Flutter** y que la vista móvil sea distinta
de la de escritorio. Reparto actual:

| Pieza | Móvil (`< md`) | Escritorio (`md+`) |
| --- | --- | --- |
| Navegación | `BottomNavigation` fijo con las secciones que los permisos del rol permiten ver (Inicio · Ramas · Células · Lobby · Usuarios · Roles) | `Drawer` permanente a la izquierda con avatar, secciones y "Cerrar sesión" |
| Barra superior | `AppBar` con título de sección + avatar que abre el menú de cuenta (nombre, rol, cerrar sesión) | `AppBar` con título; el menú lateral lleva la sesión |
| Listados | Lista estilo Flutter (`ListadoResponsivo`): fila tocable, título + detalle + chips, buscador fijo arriba, acciones deslizando | **Tabla** densa con cabeceras |
| Acción principal | **`Fab` extendido** (con texto) sobre la barra inferior, vía `AccionPrincipal` | Botón en la cabecera |
| Contenido | `pb` extra para no tapar la barra inferior; `env(safe-area-inset-bottom)` | ancho libre con margen |

Componentes: `src/components/PanelChrome.tsx` (shell), `src/components/ListadoResponsivo.tsx`
(dos presentaciones del mismo dato) y los `Formulario*.tsx` que renderizan **botón en escritorio
y FAB en móvil** desde el mismo componente (no duplicar el diálogo).

### 7.1 Lenguaje visual y de interacción (rediseño 2026-10-09)

Todo sale de `src/theme/theme.ts`, que ahora expone **tokens con nombre** además de la paleta:
`radios` (chico·medio·grande·extra·pill), `sombras` (reposo·suave·media·alta, sobre una tinta verde
diluida, nunca negro puro), `movimiento` (duraciones y curvas), `degradados` (marca·ambiente),
`fuentes.numeros` y `colores.tintes/veloMarca`. **Regla:** si un componente necesita un radio, una
sombra o una duración, la toma del token; no escribe el valor.

Lo que cambió en la experiencia:

| Antes | Ahora | Por qué |
| --- | --- | --- |
| La `AppBar` tapaba la cabecera del menú lateral | Barra superior desplazada a la derecha del menú («clipped drawer») | Nada queda escondido tras otra superficie |
| Menú lateral sin jerarquía | Marca + sección «Secciones» + indicador de barra en el activo + tarjeta de sesión al pie | Saber dónde estás y quién eres, sin buscar |
| Barra inferior solo cambiaba de color | Píldora del icono activo (Material 3) | El estado activo se lee de un vistazo |
| Cabecera = título pelado | Cabecera con icono, etiqueta de contexto, subtítulo y miga de vuelta | Orientación antes que decoración |
| Listado = filas de texto | Avatar con iniciales por fila, estados como chip, contador de resultados, atajo «/» y vacíos con icono que explican qué hacer | Escanear y entender sin leer todo |
| Inicio = tres cifras | Portada de marca (saludo + rol) + cifras con icono y flecha + accesos rápidos | Arranque con contexto y siguiente paso claro |
| Login = formulario suelto | Panel de marca (escritorio) + tarjeta con formulario; en móvil, marca sobre la tarjeta | Confianza y contexto antes de la contraseña |
| Diálogo móvil sin pistas | Hoja con asa, ✕ y botón «Guardar» fijo; pie separado por línea en escritorio | Se entiende que se cierra y cómo se envía |
| `fontSize` sueltos en componentes | Tamaños desde `typography` o desde el tema (p. ej. `MuiAvatar`) | El requisito de «un solo archivo de diseño» sigue intacto |

Accesibilidad y detalle: aro de foco visible en los campos, `aria-current` en la sección activa,
`role="search"` en el buscador, etiquetas `aria` en los botones de icono, contraste de texto
secundario revisado y respeto de `prefers-reduced-motion` (global en `MuiCssBaseline`).
El contenido tiene tope de ancho (`medidas.anchoMaximoContenido`) para que no se estire en pantallas
grandes.

### 7.2 Ubicación en el mapa y registro por ubicación (2026-10-10)

Pedido del usuario: *«cuando registremos una célula que salga un mapa y marquemos donde es, usa
leaflet para que obtenga coordenadas long lat y más datos; al registrar un integrante igual, en vez
de los datos de domicilio, y quita correo de integrante»* + *«que exista un usuario de lobby: que
pueda registrar nuevos integrantes y, según la long y lat, decidir en qué célula integrarlo; le
saldrán las más cercanas de donde vive»*.

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Geometría y geocodificación | `src/lib/geo.ts` | `distanciaKm` (haversine), `distanciaLegible`, `formatearCoordenadas`, `coordenadasDe`, `enlaceMapa`, `resolverDireccion` (Nominatim, sin clave) |
| Lienzo del mapa | `src/components/MapaUbicacion.tsx` | Leaflet en un contenedor propio (nunca `body`), marcador `divIcon` con los tokens del tema, `soloLectura` para las fichas |
| Campo de formulario | `src/components/CampoUbicacion.tsx` | Mapa + «Usar mi ubicación» + «Quitar punto», lat/long de solo lectura y `direccion` oculta; **sus valores viajan en el `FormData`** |
| Campos compartidos | `src/components/CamposIntegrante.tsx` | Los campos del integrante en un solo sitio: los usan el diálogo de la célula y el registro por ubicación (`despuesDeUbicacion` es el hueco donde el lobby pone la lista de células) |
| Pantalla del lobby | `src/app/panel/lobby/page.tsx` + `src/features/lobby/RegistroLobby.tsx` | Marcar el punto → células ordenadas por distancia (la más cercana preseleccionada) → datos → registrar. Al guardar se limpia todo para la siguiente persona |
| Migración | `scripts/migrar-ubicaciones.mjs` (`npm run db:migrar-ubicaciones`) | Añade las columnas de ubicación, pasa el domicilio anterior a `direccion` y borra domicilio y correo (idempotente) |

Decisiones que conviene recordar:

- **Leaflet sin envoltorio de React** (`react-leaflet` está instalado pero no se usa): el mapa se crea
  una sola vez por montaje y después sigue las props. Recrearlo con cada cambio de coordenada perdía
  el encuadre. El módulo se carga con `import('leaflet')` dentro del efecto (trozo aparte).
- **El marcador es un `divIcon`**: el icono por defecto de Leaflet son imágenes sueltas que el
  empaquetador no encuentra (marcador roto). Los colores salen del tema.
- **La dirección es un extra, no un requisito**: si Nominatim no responde, el punto se guarda igual con
  sus coordenadas y la interfaz lo dice («no pudimos obtener la dirección»).
- **La rueda del ratón no hace zoom** en el mapa: secuestraba el desplazamiento de la página. Se
  puede mover y usar los botones +/−.
- **Quién elige la célula es la persona, no el sistema**: la pantalla propone el orden por cercanía y
  preselecciona la primera; el rol Lobby decide. El modelo no permite mover a alguien de célula
  después (regla 1), así que la elección se hace antes de guardar.
- **El rol Lobby no edita ni da de baja** (`integrante:ver` + `integrante:crear` + `celula:ver` +
  `rama:ver`): si hiciera falta más, se le concede desde `/panel/roles`, que para eso los roles son datos.
- **`react-leaflet` quedó instalado sin uso**; se deja (no se desinstala sin pedirlo) — ver §9.

### 7.3 Pase de lista, mapa por defecto en Torreón y bajas desde los listados (2026-10-10)

Pedido del usuario: *«en las células, quita el campo lugar; que todos los mapas salgan por defecto en
Torreón, Coahuila, no en Monterrey; en células no se puede editar o eliminar la célula, tampoco la
rama se puede eliminar; y el pase de lista cada día que toca también falta, de los que pertenecen a
la célula»*.

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Pase de lista (pantalla) | `src/components/PaseDeLista.tsx` | Tarjeta en la ficha de la célula: la fecha que toca, el resumen del día («1 presente · 1 ausente»), cambio de fecha (trae lo registrado de ese día) y el diálogo con un `Select` por integrante |
| Acciones | `src/features/asistencia/acciones.ts` | `guardarPaseDeListaAccion` y `consultarPaseDeListaAccion` (devuelve `{error}` en lugar de redirigir) |
| Acceso a datos | `src/lib/db/asistencia.ts` | `buscarReunion`, `obtenerPaseDeLista`, `guardarPaseDeLista` (transacción con `LAST_INSERT_ID(id)`) |
| Fechas | `src/lib/fechas.ts` | `hoyISO`, `fechaDeLaReunion` (hoy si es su día; si no, la última que ya pasó), `formatearFechaConDia` |
| Migración | `scripts/migrar-asistencia.mjs` (`npm run db:migrar-asistencia`) | Crea `reunion` y `asistencia` con sus claves ajenas en una base existente (idempotente) |
| Tarjeta de hoy | `src/app/panel/page.tsx` | «Hoy toca reunión»: las células cuyo `dia_semana` es hoy, con enlace directo a su ficha |
| Bajas desde el listado | `src/components/AccionBaja.tsx` (`borrarCelula`, `borrarRama`) | Baja de dos toques (botón + confirmación en el propio diálogo) en las filas de células y ramas |

Decisiones que conviene recordar:

- **`celula.lugar` desapareció.** Qué sitio es se ve en el mapa; la dirección la aporta el geocodificador.
  `db:migrar-ubicaciones` lo retira de las bases antiguas.
- **El centro del mapa es Torreón, Coahuila** (`mapa.centro` en `theme.ts`, 25.5439 / -103.4069, y el
  marcador usa `mapa.zoomPunto`). Los datos de prueba de `db:setup` también son de Torreón: la base de
  desarrollo tenía los de la siembra anterior (Monterrey) y se movieron con `UPDATE` sobre las filas
  que todavía traían esas direcciones.
- **Dos FAB se enciman**: en móvil `AccionPrincipal` fija el botón abajo a la derecha, así que en una
  pantalla con dos acciones flotantes («Nuevo integrante» y «Pasar lista») el de abajo queda **debajo**
  y no se puede pulsar (el tap cae en el otro). La regla queda: **un solo FAB por pantalla**; la segunda
  acción va como botón normal dentro de su tarjeta.
- **El estado de asistencia por defecto es PRESENTE** y quien no se marca cuenta como presente: en la
  reunión se marca la excepción (quien no llegó) y no a los 20 que sí. `Marcar todos presentes`
  deshace los cambios antes de guardar.
- **El servidor valida que los integrantes sean de esa célula**: los `estado_<id>` llegan del cliente,
  así que se contrastan con `listarIntegrantes(usuario, { celulaId })` antes de escribir (AGENTS §3.3).
- **Cada día tiene su registro** (`UNIQUE(celula_id, fecha)`), de modo que el pase de lista se puede
  adelantar o repasar: cambiar la fecha en la tarjeta carga lo que ya estaba marcado ese día.
- **La tarjeta y el botón solo salen con `asistencia:ver` / `asistencia:pasarLista`** calculados con el
  ámbito real de la célula; el rol Lobby (que no tiene ese permiso) ve la ficha sin pase de lista.
- **Un listado no debe ser el único camino a editar o dar de baja**: las acciones viven en el listado
  (⋮ en móvil, columna al final en escritorio) y la baja pide confirmación en el momento.

### 7.4 Cumpleaños próximos (2026-10-10)

Pedido del usuario: *«Añade los cumpleaños próximos agrupados por célula, con la ventana de días
configurable y un resumen en Inicio»* (Fase 7 del roadmap).

| Pieza | Archivo | Qué hace |
| --- | --- | --- |
| Pantalla | `src/app/panel/cumpleanos/page.tsx` | `/panel/cumpleanos`: ventana en la URL (`?dias=`), agrupado por célula y con buscador |
| Filtro | `src/components/FiltrosCumpleanos.tsx` | chips 7 · 15 · 30 · 60 · 90 días → `router.replace` (recalcula el servidor) |
| Lógica | `src/lib/cumpleanos.ts` | ventanas válidas, «Hoy»/«Mañana»/«En N días», filtrado y orden por célula |
| Fechas | `src/lib/fechas.ts` → `proximoCumpleanos` | próximo cumpleaños en UTC; el 29 de febrero cae el 28 en años no bisiestos |
| Datos | `lib/db/integrantes.ts` → `listarConFechaNacimiento` | alcance dentro del SQL; solo ACTIVO y VISITANTE con fecha |
| Resumen | `src/app/panel/page.tsx` | tarjeta «Próximos cumpleaños» (los 5 más cercanos) + atajo en «Accesos rápidos» |
| Listados | `src/components/ListadoResponsivo.tsx` | propiedadd opcional `grupo`: cabecera de grupo en móvil y fila `colSpan` en la tabla |

Decisiones que conviene recordar:

- **No se añadió una séptima entrada a la barra inferior**: a 390 px ya son 6 y el etiquetado se
  quedaría apretado. Se llega desde Inicio (tarjeta + atajo). Pedirlo si se quiere en el menú.
- **La ventana es una decisión del usuario, no del código**: chips en la pantalla (`§9.1` resuelta);
  sin parámetro, 30 días.
- **Solo activos y visitantes**: inactivos y egresados no entran (lo dice la propia pantalla).
- **El filtro por ventana no va en SQL**: cruza el fin de año y el 29 de febrero es aritmética de
  fechas. El alcance del rol, que eso sí es seguridad, va dentro de la consulta.
- **Todo en UTC a medianoche**: contar días con fechas locales se desplaza en el cambio de horario.
- **Agrupar es cuestión del listado**: `FilaListado.grupo` se pinta solo cuando cambia; las demás
  pantallas no pasan `grupo` y quedan idénticas a antes.

### 7.5 Vista móvil: el teléfono recibía la tabla de escritorio (2026-10-11)

El usuario reportó que «en teléfono no funciona y la vista móvil se descompuso». Se encontraron tres
causas reales (no era el diseño, era cómo se decidía):

| Causa | Qué pasaba | Arreglo |
| --- | --- | --- |
| El corte dependía de una medición en el cliente | `ListadoResponsivo` elegía lista o tabla con `useMediaQuery`, que en el servidor es `false`: **el HTML que salía del servidor traía la tabla** y el teléfono la veía hasta que hidrataba el JavaScript (o para siempre si no llegaba) | Las dos presentaciones se pintan siempre y el corte lo aplica el CSS (`display` con el breakpoint `md` del tema) |
| El buscador fijo ignoraba la zona segura | El listado se pegaba con `top: medidas.altoBarraSuperior.movil` (60 px escritos a mano) mientras la barra superior mide `60 + env(safe-area-inset-top)` —el mismo cálculo que ya hace `PanelChrome` para el contenido—: en un teléfono con muesca el buscador se metía debajo de la barra | El buscador fijo usa `calc(${medidas.altoBarraSuperior.movil}px + env(safe-area-inset-top, 0px))` |
| El título oculto medía toda la pantalla | `EncabezadoPagina` ocultaba el `<h1>` en móvil con `width: 1, height: 1` y en `sx` eso es **100%**, no 1 px: una caja invisible de 100%×100% en cada listado. Medido en `/panel/cumpleanos` a 390 px: 380×844 px, 16 px de desborde horizontal y el scroll de la página definido por esa caja | Pasa a `1px`×`1px` con `clip`/`clipPath` (patrón «solo lectores de pantalla») |

Decisiones que conviene recordar:

- **El corte se decide en CSS, no esperando al JavaScript** (regla añadida a AGENTS.md §3.5 y §3.6).
- **El corte es `md` del tema = 900 px** (valor por defecto de MUI): AGENTS.md decía 768 px. Se corrigió
  la documentación, no el comportamiento; si se quiere el corte en 768 px hay que declararlo en el tema.
- **En `sx`, un número fraccionario es un porcentaje** (`width: 1` = 100%, `width: 0.5` = 50%). Para
  «1 px» hay que escribirlo con unidad. Es el error que deformaba la vista móvil.
- **Lo que se midió**: HTML del servidor con UA de teléfono (ya trae `ul/li` y oculta la tabla por CSS),
  a 390 / 743 / 1280 px sin desbordes (`scrollWidth == clientWidth`), lista visible por debajo de 900 px
  y tabla por encima, y `typecheck`/`lint`/`build` en 0.

### 7.6 El teléfono se quedaba sin React: recursos internos del modo desarrollo bloqueados (2026-10-11)

Después de lo de §7.5 el usuario reportó que **desde el celular los botones «Nuevo…» nunca abrían el
formulario, los selectores no respondían y el mapa no aparecía** (lo abría por la IP de la red y por un
túnel de Cloudflare). No era la app: era que **el navegador del teléfono nunca ejecutaba su JavaScript**.

Causa (medida, no supuesta): Next **solo acepta `localhost`** como origen de sus recursos internos de
desarrollo (`/_next/*`, el websocket del HMR y las fuentes de `next/font`). Cuando el navegador pide
esos recursos con otro origen —la IP de la red o el subdominio de un túnel— el servidor de desarrollo
responde **403 `Unauthorized`** ([`block-cross-site-dev.js`](node_modules/next/dist/server/lib/router-utils/block-cross-site-dev.js))
y la página se queda con el HTML que sirvió el servidor **sin hidratar**: se ve, pero nada responde.

Cómo se comprobó:

| Prueba | Antes | Después |
| --- | --- | --- |
| `curl` de un chunk con `Origin` del túnel | 403 (12 bytes: `Unauthorized`) | 200 |
| `GET /__nextjs_font/geist-latin.woff2` | 403 | 200 |
| `wss://…/_next/hmr` (consola del navegador) | 502 (handshake rechazado) | conecta |
| Claves de React en el DOM (`__reactFiber$…`) por el túnel | **ninguna** (página muerta) | presentes (hidratada) |
| Clic en «Nuevo usuario» a 390 px por el túnel | no abría nada | abre la hoja a pantalla completa |
| Selector «Rol» del diálogo | no abría | lista los 4 roles |
| «Nueva célula» → mapa | nunca aparecía | contenedor 337×259 con teselas de Torreón |

Arreglo: **`allowedDevOrigins` en `next.config.ts`** con la IP del equipo (`192.168.1.13`) y
`*.trycloudflare.com`. Solo afecta a `next dev`; la app compilada (`next build` + `next start`) no hace
esta comprobación, así que en producción no hay nada que configurar.

Decisiones que conviene recordar:

- **Es un fallo de entorno, no de la aplicación**: si algo «no responde» en el teléfono pero en la PC sí,
  lo primero es mirar la consola del navegador del teléfono y buscar 403 en recursos `/_next`.
- **La pista estaba en la telemetría**: la consola pedía `wss://<host>/_next/hmr` y recibía 502, y el
  WebSocket siempre manda `Origin` (por eso estaba bloqueado aunque los `<script>` del mismo origen pasaran).
- **Los túneles cambian de URL en cada arranque** por eso el comodín `*.trycloudflare.com` y no un host fijo.
- **Lo que NO era**: no era Cloudflare modificando el HTML (comparado byte a byte: idéntico salvo el
  nonce `__next_r`), ni la base de datos, ni un problema de CSS. Cloudflare solo aporta el transporte.
- **Ojo con `npm run build` mientras `next dev` está arriba**: se verificó que el servidor siguió
  respondiendo 200 después del build, pero por costumbre conviene pararlo antes.

### 7.7 Módulo de ministerios (2026-10-15)

> Pedido del usuario: un módulo nuevo «Ministerio de cámaras» donde puedan iniciar sesión sus
> integrantes (con permisos y roles en el sistema), con catálogo de equipo, sala de préstamos,
> eventos donde la lista de servidores **confirma** y donde cada uno **checa su hora de llegada**
> por ubicación.

**Pantalla única con pestañas** (`/panel/ministerio`, con `NavegacionMinisterio`):

| Sección | Ruta | Qué hace |
| --- | --- | --- |
| Resumen | `/panel/ministerio` | Cifras del ministerio (equipos, prestados, eventos próximos, confirmaciones) |
| Equipos | `/panel/ministerio/equipos` | Catálogo: nombre, descripción opcional y estatus; se da de baja sin borrar |
| Préstamos | `/panel/ministerio/prestamos` | Quién lo trae, a quién se le asignó, hora de salida, hora de retorno y el estado en que volvió |
| Eventos | `/panel/ministerio/eventos` | Fecha, hora a la que deben estar y punto en el mapa; de ahí se arma la lista de servidores |
| Mis turnos | `/panel/ministerio/mis-turnos` | Mis eventos: confirmo mi turno y marco mi llegada. **No pide permiso de módulo** (lo autoriza la asignación) |

**Permisos.** El catálogo (`src/lib/auth/catalogo.ts`) gana los recursos `ministerio`, `equipo`,
`prestamo` y `evento`, las acciones `asignar` (servidores) y `checar` (llegada) y un **alcance
nuevo `MINISTERIO`** (`RANGO_ALCANCE` 1, el más estrecho). El filtro viaja dentro del SQL con
`src/lib/db/alcance.ts` (`filtroMinisterio` / `dentroDelMinisterio`), la misma regla que rama y
célula: un rol de alcance rama/célula **no ve ningún ministerio**. Roles base nuevos:

| Rol | Alcance | Permisos |
| --- | --- | --- |
| Encargado de ministerio | MINISTERIO | `ministerio:ver` + equipo y préstamo CRUD + evento CRUD + `asignar` + `checar` |
| Servidor de ministerio | MINISTERIO | solo `ministerio:ver`, `equipo:ver`, `evento:ver` |

`ministerio:crear/editar/eliminar` están en `PERMISOS_SOLO_ORGANIZACION`: los ministerios los da
de alta la organización; dentro de cada uno solo se gestionan sus propios datos.

**Flujo de un evento.** El encargado crea el evento con **hora de llegada** y el punto donde hay
que estar (`FormularioEvento` usa `CampoUbicacion`), arma la lista de quién sirve
(`AsignarServidores`) y cada servidor recibe su turno en «Mis turnos»: confirma («Confirmo que
voy» / «Ya no puedo ir») y, el día, marca su llegada. La checada guarda **hora, punto del teléfono
y distancia al punto del evento** (`AccionLlegada` + `distanciaKm`), y la fila dice quién la
registró («Él mismo» / «El encargado (marcó por él)»). `hora_llegada` es lo que permite decir si
llegó a tiempo.

**Reglas aprendidas al verificarlo:**

- La ubicación la espera **la app** (tiempo máximo propio): con el aviso de permisos del navegador
  pendiente, `navigator.geolocation` no responde y el botón se quedaba girando para siempre.
- El **chip** es lo único del estado que se ve en la lista del teléfono (la celda con chip no va al
  subtítulo), así que el estado de la devolución tiene que viajar en el chip.
- Una función exportada desde un módulo `'use client'` **no la puede llamar un Server Component**:
  las piezas compartidas del módulo (secciones y «¿es esta sección?») viven en `src/lib/ministerio.ts`,
  aparte de `NavegacionMinisterio.tsx`.

### 7.8 Campos diferenciadores y recomendación en Lobby (2026-10-20)

Pedido del usuario: *«que se creen preguntas de rangos o selects […] para que en Lobby se
recomiende mejor a cuál célula va alguien»*. Se modeló en tres piezas, y las tres son **datos**
(no código):

| Tabla | Qué es | Quién la toca |
| --- | --- | --- |
| `campo` + `campo_opcion` | El **catálogo** de preguntas («Estado civil», «Edad») con sus opciones o su rango | `/panel/campos` (organización) |
| `celula_criterio` + `celula_criterio_opcion` | Qué acepta **cada célula**: obligatorio o preferencia, opciones o mínimo/máximo | Ficha de la célula |
| `integrante_respuesta` | Qué respondió **cada persona** | Lobby (al registrarla) o su ficha |

**Dónde se ve:** el listado `/panel/celulas` trae una columna «A quién le sirve» (en el teléfono,
un chip con los valores: «Soltero · Casado»), la ficha de la célula la tarjeta «A quién le sirve»
con el botón para declararlos, y Lobby separa «Le sirven a esta persona» de «Otras células a tu
alcance».

**Se declaran también AL CREAR LA CÉLULA** (2026-10-20): el diálogo de «Nueva célula» / «Editar
célula» (tanto desde `/panel/celulas` como desde la ficha de la rama) trae el mismo editor, con el
mismo servidor y las **mismas validaciones**. Detalle importante: el formulario solo envía
`conCriterios = 1` cuando el editor se pintó; si una pantalla no lo trae, guardar la célula **no
toca** sus criterios, así que un formulario viejo no los borra por accidente.

**Dos errores que costaron encontrar:**

- **Se mezclaban los criterios entre células.** `aCriterios()` agrupaba solo por `campo_id`, así que
  las opciones de una célula aparecían pegadas a la otra y la recién creada salía «Sin criterios»
  (y la otra mostraba opciones de más). La llave correcta es **célula + campo**.
- El servidor valida el rango del criterio contra el **límite del campo** («no puede ser mayor que
  120») y que el mínimo no pase del máximo, y lo hace ANTES de escribir: si no cuadra, **no se
  crea ni se edita la célula**.

**Regla de la recomendación** (`src/lib/campos.ts`, sin base de datos ni React): un criterio
**obligatorio** incumplido descarta la célula; las **preferencias** cumplidas suman; lo que no se
respondió cuenta como no cumplido. La cercanía desempata: los criterios filtran y ordenan, el mapa
decide entre iguales. La recomendación **sugiere** —quien registra elige siempre— y el chip dice
por qué («Cumple 1 de 1» · «falta: Estado civil (Soltero · Casado)»).

**Detalles que costaron trabajo:**

- Un campo SELECT **no hay que borrarlo** si ya tiene respuestas: el catálogo lo rechaza y ofrece
  desactivarlo. Borrarlo se llevaría lo que la gente ya contestó.
- El editor de opciones se **reemplaza completo** al guardar. Pasar de SELECT a RANGO borra las
  opciones y los criterios que las usaban.
- `INSERT INTO campo (… orden) VALUES (…, (SELECT MAX(orden) FROM campo))` **falla**: MySQL no deja
  usar la tabla de destino en una subconsulta. El orden se lee antes, en su propio `SELECT`.
- El `onChange` de un **Select de MUI** no burbujea al `onChange` del `<form>`: para recomendar en
  vivo hay que avisar desde `CamposDiferenciadores` (`alResponder`).
- **Base MariaDB 10.4**: `RENAME COLUMN` y `RENAME INDEX` llegaron después (10.5). `db:migrar-celulas`
  intenta lo moderno y cae a `CHANGE COLUMN` / `ADD + DROP INDEX` cuando el servidor no lo entiende.

### 7.9 Cambiar colores y tipografía sin tocar el resto del tema (2026-10-20)

Pedido del usuario: *«ponlo fácil para cambiar colometría y tipografías»*. Al principio de
`src/theme/theme.ts` va el bloque **`ajustes`**: tres colores (`colorPrincipal`, `colorAcento`,
`colorFondo`), dos fuentes (`fuenteTitulos`, `fuenteTexto`) y dos escalas (`escalaTexto`,
`escalaRadios`). Todo lo demás se **deriva** con `aclarar` / `oscurecer` / `mezclar` / `alfa`:
los tonos claros y oscuros de la marca, los `action.*` de MUI, los tintes de estado, la tinta de
las sombras, los velos de la barra y el fondo del diálogo. Cambiar `colorPrincipal` recolorea la
app entera sin que quede un solo hex suelto contradiciéndolo.

- La escala de texto multiplica las variantes de `typography` (`tamano()`), la de radios los
  tokens de `radios` (`radio()`).
- Los colores de estado (éxito, advertencia, error) **no** cambian con la marca: significan lo
  mismo siempre.

## 8. Decisiones tomadas

| Fecha | Decisión | Motivo |
| --- | --- | --- |
| 2026-10-07 | **Next.js 16 (App Router) + TypeScript + MUI 9** | Requisito del usuario; versiones que resolvió npm |
| 2026-10-07 | **PWA instalable** | La lista se pasa en la reunión, desde el celular |
| 2026-10-07 | **Serwist** (`@serwist/next`) como PWA | Sucesor de `next-pwa`; compatible con Turbopack *(aún sin instalar)* |
| 2026-10-07 | **Tema centralizado en `src/theme/theme.ts`** | Requisito explícito del usuario |
| 2026-10-07 | **Nombres de dominio en español** | Coherencia con el vocabulario del usuario |
| 2026-10-07 | **MySQL 8.4 como base de datos** | Elección explícita del usuario («usa mysql») |
| 2026-10-07 | **`mysql2` + capa de datos propia, SIN ORM** | Prisma se instaló en versión 8-rc incompatible con el cliente; `mysql2` es un solo dep, sin código intermedio ni descargas de motores |
| 2026-10-07 | **Auth propia: cookie firmada HMAC + scrypt** | Sin dependencias; el rol se relee de la base en cada petición |
| 2026-10-07 | **Server Actions + Zod** para mutaciones | `useActionState` en login; `useTransition` + `router.refresh()` en los diálogos |
| 2026-10-07 | **`next/font` NO se usa en el tema** | Evita que el build dependa de la red para descargar fuentes |
| 2026-10-07 | **Vista móvil ≠ vista escritorio** (FAB, BottomNavigation, tarjetas) | Petición explícita del usuario |
| 2026-10-08 | **Roles y permisos configurables en BD** (`rol`, `rol_permiso`, `usuario.rol_id`) con catálogo cerrado en código | Petición del usuario: crear roles/permisos y asignar rol a cada cuenta |
| 2026-10-08 | Anti-escalada (`puedeOtorgar`), Administrador protegido, permisos de gestión solo en alcance organización | Evitar que un rol con `usuario:editar` se dé poder de administrador |
| 2026-10-10 | **Leaflet + OpenStreetMap** para marcar ubicaciones en células e integrantes | Pedido explícito del usuario («usa leaflet»); sin clave y sin coste |
| 2026-10-10 | **Nominatim** (OpenStreetMap) para la dirección del punto | Gratuito y sin clave; la dirección nunca bloquea el guardado |
| 2026-10-10 | **El domicilio escrito se sustituye por el punto del mapa** y el `email` del integrante se elimina | Pedido explícito del usuario: solo se pide información que se va a usar |
| 2026-10-10 | **Rol base «Lobby»** (alcance organización, ver + crear integrantes) | Registrar personas nuevas eligiendo la célula por cercanía, sin darle poder de edición |
| 2026-10-10 | **Se retira `celula.lugar`** | Pedido del usuario; el sitio lo dice el punto del mapa y su dirección |
| 2026-10-10 | **Centro por defecto del mapa: Torreón, Coahuila** (y datos de prueba de Torreón) | Pedido del usuario: los mapas se abrían en Monterrey |
| 2026-10-10 | **Pase de lista por fecha, con estado PRESENTE por defecto** | En la reunión se marca la excepción, no la mayoría |
| 2026-10-10 | **Una sola acción flotante (FAB) por pantalla** | Dos FAB se encimaban en el mismo punto y el de abajo quedaba inalcanzable en móvil |
| 2026-10-15 | **Todo el texto «cédula» pasa a ser «célula»** (pantallas, archivos, tipos, scripts); `db:migrar-celulas` renombra la tabla antigua `cedula` | Pedido del usuario: el dominio es de células, no de cédulas |
| 2026-10-15 | **Módulo de ministerios** con sus propios recursos (`ministerio`, `equipo`, `prestamo`, `evento`), acciones nuevas (`asignar` servidores, `checar` llegada) y **alcance `MINISTERIO`** | Pedido del usuario: que crezca el sistema para «Ministerio de cámaras» con su equipo, sus préstamos y sus eventos |
| 2026-10-15 | **Roles base «Encargado de ministerio» y «Servidor de ministerio»** (alcance MINISTERIO) | El encargado lleva inventario, préstamos y eventos; el servidor solo ve, confirma y checa |
| 2026-10-15 | **La hora de llegada y el punto viajan guardados en el evento**: se compara contra `hora_llegada` y contra el punto del mapa | Pedido del usuario: «para saber si llegó a tiempo» |
| 2026-10-15 | **La ubicación la espera la app, no el navegador** (tiempo máximo propio en `AccionLlegada`) | Con el aviso de permisos pendiente, `navigator.geolocation` no responde nunca y el botón se quedaba girando para siempre |
| 2026-10-20 | **Campos diferenciadores como datos**: catálogo en `/panel/campos`, criterios por célula, respuestas por persona; la recomendación vive en `src/lib/campos.ts` | Pedido del usuario: recomendar la célula con preguntas propias (estado civil, edad…) y no solo por cercanía |
| 2026-10-20 | **`ajustes` al principio de `theme.ts`** con 3 colores, 2 fuentes y 2 escalas; el resto del tema se deriva | Pedido del usuario: cambiar colores y tipografías sin pelear con 600 líneas de tema |

## 9. Decisiones abiertas  ⚠️

1. ~~**Ventana de cumpleaños**~~ **resuelta 2026-10-10**: no se eligió un valor fijo, se hizo
   **configurable en la pantalla** (chips de 7 · 15 · 30 · 60 · 90 días; `?dias=` en la URL, 30 por
   defecto) y quedó escrito que el reporte solo cuenta **activos y visitantes** (inactivos y
   egresados no aparecen).
2. **Campo "de dónde es"**: ¿un solo campo de texto libre o ciudad+estado normalizados?
3. **PWA**: instalar Serwist + `manifest.ts` + iconos (Fase 8) y decidir estrategia offline.
4. **Despliegue**: dónde se publicará (necesita MySQL accesible) — todavía no se decide.
5. ¿Borrar `instalar-flutter.ps1` y hacer `git init`? (pendiente de que el usuario lo pida).
6. **Ubicación obligatoria** en células e integrantes: hoy es opcional. ¿Debería exigirse el punto al
   crear una célula (sin él no puede proponerse por cercanía)?
7. **Selección de dirección al marcar**: Nominatim devuelve la calle más cercana, que puede ser una
   vecina. ¿Hace falta editar la dirección a mano o confirmar el punto con una vista de satélite?
8. **Cercanía y alcance**: el rol Lobby ve y ordena células de toda la organización. ¿Conviene un
   límite («solo las de su ciudad» / «solo a X km») o un tope de resultados?
9. `react-leaflet` quedó instalado sin uso (se usa Leaflet directo). ¿Se desinstala?
10. **Membresía de un ministerio**: hoy se pertenece con un rol de alcance `MINISTERIO` +
    `usuario.ministerio_id` (una cuenta = un ministerio). ¿Hace falta una tabla de membresía si
    alguien sirve en dos ministerios a la vez?
11. **Checar sin ubicación**: el propio servidor solo checa con la ubicación del teléfono (si el
    navegador la niega, no checa); el encargado sí puede guardar solo la hora. ¿Se permite al
    servidor marcar sin ubicación, o se mantiene obligatoria por el propósito del control?
12. **Equipo devuelto dañado**: la devolución guarda `estado_devolucion`, pero el `estatus` del
    equipo lo mueve a mano el encargado. ¿Debería pasar solo a `MANTENIMIENTO` cuando volvió
    «dañado»?

> Resueltas: ~~persistencia~~ (MySQL + mysql2), ~~autenticación~~ (propia con sesión firmada),
> ~~formularios~~ (Zod + acciones; los diálogos usan `useTransition`, no React Hook Form).

## 10. Roadmap y estado actual

- [x] **Fase 0** — README + memoria (README.md, MEMORY.md, AGENTS.md)
- [x] **Fase 1** — Node, scaffold Next + TS + MUI, `theme.ts`, layout base
- [x] **Fase 2** — Persistencia: MySQL 8.4 + `mysql2` + esquema y seed (`npm run db:setup`)
- [x] **Fase 3** — Autenticación, roles y permisos (login, sesión, guardas, matriz)
- [x] **Fase 4** — Ramas y células (CRUD con diálogo) + Usuarios con rol y alcance
- [x] **Diseño responsivo móvil/escritorio** (FAB, barra inferior, tarjetas)
- [x] **Fase 5** — Integrantes: ficha de la célula con listado (buscador), alta/edición en diálogo, baja = `INACTIVO`
- [x] **Ubicación por mapa (Leaflet) + registro por ubicación (rol Lobby)** (2026-10-10; ver §7.2)
- [x] **Fase 6** — Pase de lista (2026-10-10; ver §7.3): por fecha, con los integrantes de la célula y aviso en Inicio del día que toca
- [x] **Fase 7** — Cumpleaños próximos (2026-10-10; ver §7.4): pantalla `/panel/cumpleanos` con ventana configurable, agrupado por célula y resumen en Inicio
- [x] **Módulo de ministerios** (2026-10-15; ver §7.7): equipo con estatus, sala de préstamos (quién lo trae, a quién se le asignó, horas de salida y retorno y el estado en que volvió), eventos de servicio con hora de llegada y punto en el mapa, lista de servidores que **confirman** su turno y **chechan** su llegada con la ubicación, y «Mis turnos» para cada servidor.
- [ ] **Fase 8** — PWA instalable y offline
- [ ] **Fase 2 del pase de lista** — historial y porcentaje de asistencia por integrante (§9 lo deja abierto)

**Siguiente paso concreto:** Fase 8 (PWA instalable) o el historial de asistencia, a elección del usuario.

## 11. Entorno y cómo verificar

```bash
# Node (portátil; abrir terminal con esto si no está en el PATH)
export PATH="$LOCALAPPDATA/Programs/nodejs:$PATH"

npm run dev        # http://localhost:3000
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # next build
npm run db:setup   # ⚠️ RECREA el esquema y los datos de prueba
npm run db:migrar-roles       # migra una base con el modelo antiguo (usuario.rol)
npm run db:migrar-integrantes # crea la tabla `integrante` en una base existente
npm run db:migrar-ubicaciones   # añade las columnas de ubicación y retira domicilio y correo
npm run db:migrar-asistencia    # crea `reunion` y `asistencia` (pase de lista) en una base existente
npm run db:migrar-celulas      # renombra la tabla antigua `cedula` a `celula`
npm run db:migrar-ministerio    # crea `ministerio`, `equipo`, `prestamo`, `evento`, `servidor_evento`
npm run db:migrar-campos       # crea el catálogo de campos, los criterios y las respuestas
```

- **Orden de las migraciones** en una base vieja: `db:migrar-celulas` **primero** (renombra la
tabla y las columnas); después roles, integrantes, ubicaciones, asistencia, ministerio y campos.
  Si el servidor responde `MariaDB 10.4.32` en vez de MySQL 8, no pasa nada: el script de células
  ya usa el camino compatible (`CHANGE COLUMN` en lugar de `RENAME COLUMN`).

- **Probar desde el celular:** `next dev` escucha en todas las interfaces (su salida imprime
  `Network: http://<IP>:3000`). Abrir en el teléfono esa dirección, con el teléfono en la **misma red**
  (aquí: `http://192.168.1.13:3000`). El firewall de Windows ya tiene reglas de entrada para `node.exe`
  (perfil público, TCP y UDP). Si el celular no abre nada, lo primero es comprobar que el servidor siga
  corriendo en la PC.
  - **`allowedDevOrigins` es obligatorio para abrirlo desde fuera de `localhost`** (ver §7.6): sin él,
    `next dev` responde 403 a `/_next/*` desde la IP de la red o desde un túnel y el teléfono se queda
    sin React (botones, selectores y mapa muertos). Ya está en `next.config.ts`; si cambia la IP del
    equipo o el dominio del túnel, hay que añadirlos ahí y reiniciar el servidor.
  - **Túnel de Cloudflare:** `"$LOCALAPPDATA/cloudflared.exe" tunnel --url http://localhost:3000` imprime
    en la primera línea una URL `https://<algo>.trycloudflare.com` (cambia en cada arranque). Útil cuando
    el teléfono no está en la misma red. Es un servidor de **desarrollo**, no un despliegue.
- **MySQL portátil:** `%LOCALAPPDATA%\Programs\mysql\bin\mysqld.exe --no-defaults --basedir=... --datadir=...\data --port=3306 --bind-address=127.0.0.1 --console`
  - Arrancó con `Start-Process` (proceso desprendido). **Si no responde en 3306, hay que relanzarlo.**
  - Falta `vcruntime140_1.dll`: se copió a `bin\` desde OneDrive (era la x64 que había); sin ese fichero `mysqld` no arranca (0xC0000135).
  - `root` sin contraseña; la app entra con `gosen` / `gosen_dev` (ver `.env.local`, no versionado).
- **Sin Git:** `git init` sigue pendiente (no se commitea sin pedirlo).

## 12. Changelog

| Fecha | Cambio |
| --- | --- |
| 2026-10-07 | Se crea `README.md` con visión, dominio, stack, tema centralizado y roadmap. |
| 2026-10-07 | Se crean `MEMORY.md` y `AGENTS.md`. |
| 2026-10-07 | Instalación de Node v22 (portátil) y MySQL 8.4.6 (portátil, DLL de runtime). |
| 2026-10-07 | Scaffold Next 16 + MUI 9; `theme.ts` central; verificación typecheck/lint/build en 0. |
| 2026-10-07 | Esquema MySQL (`usuario`, `rama`, `celula`) + seed con 3 cuentas de prueba. |
| 2026-10-07 | Login, sesión firmada, matriz de permisos y guardas (`exigirSesion/exigirRol/exigirPermiso`). |
| 2026-10-07 | CRUD de ramas, células y usuarios (diálogos MUI + server actions + Zod). |
| 2026-10-07 | Rutas bajo `/panel/...` (la carpeta `(panel)` no creaba segmento de URL: se renombró). |
| 2026-10-07 | `instant = false` en las rutas con sesión (Next 16 exige marcarlas como no prerenderizables). |
| 2026-10-07 | Corregido: los listados usan `exigirRol` (el alcance va en SQL); antes bloqueaban al líder de célula. |
| 2026-10-07 | Diseño responsivo: `BottomNavigation` + `Fab` + tarjetas en móvil, menú lateral + tabla en escritorio. |
| 2026-10-07 | MySQL dejó de escuchar en 3306 y toda pantalla que llamaba `consultar` fallaba; se relanzó `mysqld` (§11). |
| 2026-10-07 | `conexion.ts` traduce los códigos de mysql2 (`ECONNREFUSED`, `ER_BAD_DB_ERROR`…) a un mensaje en español con la orden exacta a ejecutar. |
| 2026-10-07 | Columnas `longitud` y `latitud` añadidas a la tabla `celula`; esquema y validadores actualizados. |
| 2026-10-07 | Campo `email` eliminado del formulario de integrante (ya no se solicita). |
| 2026-10-08 | Endurecimiento de cuentas: invariante «siempre queda un administrador activo» en `editarUsuario` + reset opcional de contraseña desde el diálogo de edición. |
| 2026-10-08 | Filtros por rol y estado en `/panel/usuarios` (chips → `searchParams` → condición dentro del SQL, sin tocar la cláusula de alcance). |
| 2026-10-08 | Sección «¿Qué puede hacer cada rol?» generada desde `accionesDisponibles`: la matriz visible es la misma que aplica el servidor. |
| 2026-10-08 | Tema: `themeColor` sale de `colores.primario`, avatar sin `fontSize` literal y borrado `page.module.css` sin usar (cero colores/fuentes fuera de `theme.ts`). |
| 2026-10-08 | Diseño: los botones «Nuevo…» del escritorio dejaron de estirarse a todo el ancho (`alignSelf: flex-start`). |
| 2026-10-08 | **Bug latente corregido**: FormData entrega los ids como texto (`'3'`) y Zod los rechazaba («Valor numérico no válido»); `numeroOpcional` y el `ramaId` de `esquemaCelula` ahora convierten con `aNumeroONulo`. Afectaba a alta/edición de usuarios líderes, células y líderes de rama/célula. Verificado en navegador: editar célula/rama sin cambios, alta de célula, y reset de contraseña (que fue lo que lo destapó). |
| 2026-10-08 | **`ListadoResponsivo` reescrito** (regla dura en AGENTS.md §3.6): buscador en ambas vistas (normaliza acentos/mayúsculas, contador «X de Y» y estado sin resultados), móvil = lista estil Flutter (filas densas con divisor, NO tarjetas) con acciones que se revelan **deslizando** o con el ⋮, escritorio = tabla con el mismo buscador. Aplicado a las 5 listas (usuarios, matriz de permisos, células, ramas y células de la rama). |
| 2026-10-08 | Corregido en el nuevo listado: la lógica del arrastre pasa a refs (`dxRef`/`arrastrandoRef`) — con estado de render, varios `pointermove` en el mismo lote leían datos obsoletos y `dx` quedaba atascado. |
| 2026-10-08 | **Roles y permisos configurables**: tablas `rol`/`rol_permiso`, `usuario.rol_id`, catálogo en `lib/auth/catalogo.ts`, pantalla `/panel/roles` (alta/edición/borrado con matriz de permisos táctil), selector de rol dinámico en cuentas, filtros por rol desde la base. |
| 2026-10-08 | Script `npm run db:migrar-roles`: migra una base con el enum antiguo sin borrar datos (idempotente; también rellena `rama_id` de los líderes de célula). |
| 2026-10-08 | Diseño/interacción móvil: `DialogoFormulario` (pantalla completa en móvil con botón Guardar fijo abajo), `AccionPrincipal` (FAB extendido), `AvisoProvider` (aviso «Guardado»), `EncabezadoPagina`, `loading.tsx` del panel, menú de cuenta en el avatar, fila de listado tocable con chips y buscador fijo, filtros desplazables, barra inferior con 5 secciones, zonas seguras (`viewportFit: cover`), login con ver contraseña. Medidas en `medidas` del tema. |
| 2026-10-08 | Los diálogos envían con `onSubmit` (antes `action`): un error del servidor ya no borra lo que se escribió. Navegación de listados con `next/link` (sin recarga completa). |
| 2026-10-09 | **Bug que impedía iniciar sesión con roles**: `lib/db/roles.ts` y `usuarios.ts` traían los permisos con la subconsulta `JSON_ARRAYAGG`, y el usuario `gosen` no tiene el privilegio `EXECUTE` que MySQL 8 exige para esa función («execute command denied … for routine»). Ahora los permisos se leen con un `SELECT recurso, accion FROM rol_permiso` aparte (uno por rol, o una sola consulta agrupada para los listados). Verificado: login, `/panel/roles` y resolución de permisos. |
| 2026-10-09 | Corregido en la matriz de `/panel/roles`: la celda del nombre usaba `clave: 'rol'` y chocaba con la columna del recurso «Roles y permisos» (clave React duplicada). La primera celda pasa a `clave: 'nombreRol'`. |
| 2026-10-09 | **Alta de células desde el listado general**: `/panel/celulas` ahora trae «Nueva célula» (botón en escritorio, FAB en móvil). `FormularioCelula` acepta `ramas` y muestra el selector de rama cuando no se le fija `ramaId`; solo lista ramas donde el alcance del rol permite crear (la comprobación sigue en el servidor). |
| 2026-10-09 | Corregido en esa misma pantalla: el filtro de ramas usaba `puede(..., {})` y el ámbito vacío dejaba al líder de rama **sin** el botón (su propia rama “queda fuera” de un ámbito vacío). Ahora la puerta barata es `rolPuede(...)` y la comprobación real va rama por rama. Verificado con una cuenta de alcance RAMA. |
| 2026-10-09 | Corregido en `/panel/usuarios`: la columna «Alcance» decía «Sin rama» a quien solo tiene permiso de ver cuentas, porque ramas y células solo se consultaban si el usuario podía crear/editar. Ahora se piden siempre (van acotadas por el SQL de alcance). |
| 2026-10-09 | **Bug que impedía guardar la edición de un rol**: el `<Select>` de alcance queda `disabled` cuando el rol ya tiene cuentas asignadas, y **un control deshabilitado no se envía en el `FormData`** → Zod fallaba siempre con «Elige hasta dónde llega el rol». Ahora el valor viaja también en un `input` oculto. Verificado en navegador guardando un permiso sobre un rol con cuenta y comprobando la fila en `rol_permiso`. |
| 2026-10-09 | **Fase 5 — Integrantes**: tabla `integrante` (+ `npm run db:migrar-integrantes` para bases existentes), tipos en `types/domain.ts`, capa de datos `lib/db/integrantes.ts` (alcance por `JOIN celula`), validación Zod en `validaciones.ts`, server actions `features/integrantes/acciones.ts` y pantalla `/panel/celulas/[celulaId]` con `ListadoResponsivo` + `FormularioIntegrante` (secciones: personales, domicilio, origen, encuentro/bautizo, contacto). La baja marca `INACTIVO` en vez de borrar. Enlaces desde ramas y desde el listado de células. Verificado en navegador (390 px y 1280 px): alta, edición, baja y aviso de éxito. |
| 2026-10-09 | Corregido `scripts/crear-esquema.mjs`: concedía privilegios solo a `gosen@'%'` y no a `gosen@'localhost'` (rompía `db:setup` cuando el cliente entra por el socket local). |
| 2026-10-10 | **Ubicación en el mapa (Leaflet + OpenStreetMap)**: `lib/geo.ts` (haversine, formato, `resolverDireccion` con Nominatim), `MapaUbicacion` (contenedor propio, marcador del tema, solo lectura) y `CampoUbicacion` (mapa + «Usar mi ubicación» + lat/long + dirección). `medidas` del tema pasa a `mapa` (centro, zooms, alto) y el tema pinta el chrome de Leaflet (atribución y botones). |
| 2026-10-10 | **Se retiran el domicilio y el correo del integrante**: `integrante` guarda `latitud`/`longitud`/`direccion`; `celula` recibe esas mismas columnas. Los campos del integrante se extraen a `CamposIntegrante` (compartidos con el lobby) y `FormularioCelula` usa `CampoUbicacion`. |
| 2026-10-10 | **Rol base «Lobby»** (`src/lib/auth/catalogo.ts`) + cuenta de prueba `lobby@gosen.local` + acceso «Lobby» en el armazón (visible con `integrante:crear`, no con `ver`) y atajo en Inicio. |
| 2026-10-10 | **Pantalla `/panel/lobby`**: se marca dónde vive la persona y se ordenan las células por distancia (`distanciaKm`), con la más cercana preseleccionada y su distancia en un chip; el formulario se limpia tras registrar para atender a la siguiente persona. |
| 2026-10-10 | Migración `npm run db:migrar-ubicaciones` (idempotente): añade las columnas de ubicación, conserva el domicilio anterior en `direccion` y borra domicilio y correo. Probada sobre una base con la forma antigua (2 filas) antes de ejecutarla en la base de desarrollo. |
| 2026-10-10 | **Se retira `celula.lugar`** del dominio, la validación, el SQL, los formularios, la capa de datos, el esquema, la siembra y `db:migrar-ubicaciones`. El centro del mapa pasa a **Torreón, Coahuila** y los datos de prueba también (`crear-esquema.mjs`); la base de desarrollo se movió a Torreón con `UPDATE` sobre las filas que seguían con las direcciones de Monterrey. |
| 2026-10-10 | **Editar y dar de baja desde los listados**: `AccionBaja` (dos toques) en las filas de células y ramas; «Editar célula» en el listado general. Verificado en navegador (743 px y 1280 px). |
| 2026-10-10 | **Fase 6 — Pase de lista**: tablas `reunion`/`asistencia` (+ `npm run db:migrar-asistencia`), `lib/db/asistencia.ts`, validación Zod (`esquemaPaseDeLista`), acciones `features/asistencia/acciones.ts`, componente `PaseDeLista` en la ficha de la célula y tarjeta «Hoy toca reunión» en Inicio. La fecha que toca sale de `fechaDeLaReunion` (hoy si es su día; si no, la última que pasó) y se puede cambiar para repasar otro día. Verificado en navegador a 743 px y 1280 px con tres roles (administrador, líder de célula y Lobby) y comprobando las filas de `reunion`/`asistencia` en MySQL. |
| 2026-10-10 | Corregido durante esa verificación: el pase de lista usaba un segundo `AccionPrincipal` y su FAB quedaba **debajo** del de «Nuevo integrante» en el mismo punto (no se podía pulsar en móvil). Ahora es un botón de tamaño táctil dentro de su tarjeta y queda escrito como regla: un FAB por pantalla. |
| 2026-10-10 | **Verificado de nuevo en el navegador el registro por ubicación** (a petición del usuario, que volvió a describir el flujo): marcar el punto en el mapa deja `latitud`/`longitud` (25.54403 / -103.40710) y la dirección de Nominatim («Avenida Ocampo, Torreón, Coahuila, 27289»); las células salen ordenadas por distancia (20 m · 2,5 km · 3,0 km) con la más cercana preseleccionada y el chip «La más cercana»; al elegir a mano **la más lejana** (Célula 2) el `celulaId` del formulario la respeta y el aviso dice «quedó en Célula 2 (Rama Norte)», con el formulario limpio para la siguiente persona. La fila de prueba (id 7) se borró después; la base vuelve a sus 4 integrantes. También comprobado: «Nueva célula» y «Nuevo integrante» traen su mapa y **ningún** campo de lugar, domicilio ni correo, y la cuenta `lobby@gosen.local` entra a `/panel/lobby` y a `/panel/roles` la manda a acceso denegado. |
| 2026-10-10 | Verificación de la fase de ubicaciones sin panel de navegador disponible: `typecheck` 0 · `lint` 0 · `build` 0; script Node contra la base real (lectura/escritura de células e integrantes con ubicación, ida y vuelta), esquemas Zod con FormData realista y geocodificación inversa contra Nominatim; y SSR con sesión (`/panel/lobby` y `/panel/celulas/1`) comprobando el filtrado por alcance (3 células para organización, 1 para el líder de célula). **El marcado del punto en el mapa dentro del navegador quedó sin comprobar** (ver §12 y el informe de la tarea). |
| 2026-10-10 | **Fase 7 — Cumpleaños próximos**: pantalla `/panel/cumpleanos` (ventana configurable con chips, agrupado por célula, buscador), tarjeta en Inicio, `lib/cumpleanos.ts`, `proximoCumpleanos` en `lib/fechas.ts` (29-feb y fin de año resueltos) y la propiedadd opcional `grupo` de `ListadoResponsivo`. typecheck/lint/build en 0 con `pipefail`; probado en el navegador a 1280 y 390 px: ventana 30 («1 hoy»), ventana 7 (estado vacío «prueba con una ventana más amplia»), tarjeta de Inicio con «Hoy» y «En 23 días», cabecera de grupo en móvil y escritorio, y alcance del rol. La fecha de nacimiento que cambié para probar el caso «Hoy» se restauró (María: 1990-03-14). |
| 2026-10-11 | **Vista móvil arreglada**: `ListadoResponsivo` pinta lista y tabla siempre y el corte lo hace el CSS del tema `md` (antes el HTML del servidor traía la tabla y el teléfono la mostraba hasta hidratar); el buscador fijo suma `env(safe-area-inset-top)`; y `EncabezadoPagina` deja de crear una caja invisible de 100%×100% (`width: 1` en `sx` es 100%, no 1 px) que desbordaba a lo ancho y alargaba el scroll. Verificado con el HTML del servidor (UA de teléfono) y a 390 / 743 / 1280 px. Ver §7.5. |
| 2026-10-11 | **Arreglado «desde el celular no funciona nada»**: el servidor de desarrollo respondía **403** a `/_next/*` (websocket del HMR incluido) cuando el origen no era `localhost`, así que el teléfono se quedaba con el HTML sin hidratar (botones que no abren el diálogo, selectores muertos y mapa que nunca aparece). Se añade `allowedDevOrigins` en `next.config.ts` con la IP de la red y `*.trycloudflare.com`. Comprobado por túnel y por IP con un navegador real: la página hidrata, «Nuevo usuario» abre la hoja, el selector «Rol» lista los roles y «Nueva célula» dibuja el mapa (337×259 con teselas de Torreón). Ver §7.6. |
| 2026-10-15 | **«cédula» → «célula» en toda la app**: pantallas, tipos, capa de datos, componentes y scripts pasan a `celula`/`Celula`/`/panel/celulas`; `npm run db:migrar-celulas` renombra la tabla `cedula` de bases existentes (idempotente, sin tocar datos) y `esquema.sql` deja caer la tabla vieja. En la interfaz y en el código no queda una sola «cédula»; solo sobreviven el nombre de la carpeta del proyecto, los comentarios que documentan el nombre antiguo y la clave histórica `LIDER_CEDULA`. También se corrigieron los **datos** que aún lo decían: los nombres de las células («Cédula 1» → «Célula 1», «Cedula mayoress» → «Célula mayoress», «Cédula el aguila» → «Célula el aguila»), el nombre de la cuenta («Líder de cédula» → «Líder de célula») y su correo de prueba **`cedula1@gosen.local` → `celula1@gosen.local`** (el mismo que ya usa la siembra `db:setup`; ojo: cambia con quién se entra). Sin colisiones con el `UNIQUE(rama_id, nombre)`: se comprobó antes de cada `UPDATE`. |
| 2026-10-15 | **Módulo Ministerio** (pedido del usuario: «Ministerio de cámaras»): esquema nuevo (`ministerio`, `equipo`, `prestamo`, `evento`, `servidor_evento`) + `npm run db:migrar-ministerio`, alcance `MINISTERIO` en el catálogo de permisos (con `filtroMinisterio` dentro del SQL, hermana de rama/célula), recursos nuevos `ministerio|equipo|prestamo|evento` con acciones `asignar` y `checar`, roles base «Encargado de ministerio» y «Servidor de ministerio», y pantalla `/panel/ministerio` con pestañas Resumen · Equipos · Préstamos · Eventos · Mis turnos. Ver §7.7. |
| 2026-10-15 | Flujo completo verificado en navegador como encargado (David, alcance MINISTERIO): alta de equipo, préstamo con hora de salida, devolución con hora y estado («Devuelto · con algún detalle»), evento con hora de llegada y punto en el mapa, asignación de servidores, confirmación del turno y checada con coordenadas (distancia al punto calculada y guardada). |
| 2026-10-15 | Corregido al verificarlo: **el botón «Marcar mi llegada» se quedaba girando para siempre** cuando el navegador no respondía la ubicación (aviso de permisos pendiente): `AccionLlegada` pone su propio tiempo máximo de 12 s y avisa «No pudimos leer tu ubicación…». También: la fila de préstamo en el teléfono **no mostraba el estado en que volvió** el equipo (el chip ahora dice «Devuelto · con algún detalle» y se tiñe de advertencia), el diálogo del encargado mostraba la fecha en crudo («2026-10-18») y la confirmación en primera persona («Confirmo que voy») aparecía cuando la hacía el encargado por otro (ahora «Confirmar que va»). |
| 2026-10-15 | Ajustes de semántica en la ficha del evento: el turno **propio** se confirma y se checa en primera persona y sin pedir `evento:checar` (lo autoriza la asignación, igual que en «Mis turnos»), mientras que el de otro va con las acciones del encargado. Y `FormularioMinisterio`: el selector de encargado pasó a **controlado** (MUI avisaba «uncontrolled Select changing its default value» al refrescarse la lista después de guardar). |
| 2026-10-09 | **Rediseño de la interfaz y de la interacción**. `theme.ts` pasa de tener solo la paleta a un sistema de tokens (`radios`, `sombras`, `movimiento`, `degradados`, `fuentes.numeros`, `colores.tintes/veloMarca`) y a estilar todos los componentes MUI (botones píldora con degradado, campos con aro de foco, tablas con cabecera en mayúsculas, diálogos, menús, tooltips, avisos, esqueletos). Armazón nuevo: barra superior que arranca tras el menú lateral, menú con marca/secciones/sesión al pie, navegación inferior con píldora del icono activo. Pantallas: inicio con portada y cifras accionables, login en dos columnas, fichas de rama y célula con miga y resumen, listados con avatar de iniciales, contador de resultados, atajo «/», vacíos con icono y `prefers-reduced-motion`. Verificado con typecheck/lint/build en 0 y revisión visual a 390 px y 1280 px de todas las pantallas. |
