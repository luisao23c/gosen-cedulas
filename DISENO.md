# Guía de diseño — Gosén

Reglas para que toda pantalla se vea y se sienta como una sola aplicación. Los valores viven en
[`src/theme/theme.ts`](src/theme/theme.ts); aquí está el **porqué** y cómo usarlos.

---

## 1. Principios

1. **Una pantalla, una tarea.** Lo primero que se ve es lo que la persona viene a hacer (Inicio: «Qué sigue»;
   ficha de célula: pase de lista → integrantes). Lo que se consulta poco va plegado.
2. **La acción principal siempre visible.** Un botón con verbo («Pasar lista», «Recibir», «Llamar»), nunca un
   icono solitario ni algo escondido tras un deslizamiento.
3. **Menos cajas.** Se separa por espacio y contraste de capa (tarjeta blanca sobre lienzo claro), no por
   bordes gruesos, sombras ni degradados.
4. **Jerarquía por tamaño y peso**, no por color. El color de marca se reserva para acciones y estados activos.
5. **Mostrar lo necesario.** Formularios con lo esencial arriba y «Más opciones» plegado; listas sin
   datos repetidos (si todo es «Activa», no se pinta «Activa» en cada fila).

---

## 2. Tipografía

| Rol | Fuente | Tamaño (escritorio → teléfono) | Uso |
| --- | --- | --- | --- |
| `h1` | Minion Pro 600 | 40 → ~28 px | Portadas (login) |
| `h2` | Minion Pro 600 | 32 → ~25 px | **Título de pantalla** (`EncabezadoPagina`) |
| `h3` | Minion Pro 600 | 24 px | Cifras grandes, título de la portada de turno |
| `h4` | Minion Pro 600 | 20 px | **Título de sección** («Qué sigue», «Integrantes») |
| `h5` / `h6` | Minion Pro 600 | 18 / 16 px | Subsecciones y diálogos |
| `subtitle1` | Creato 700 | 16 px | Nombre de una fila, de una tarjeta |
| `body1` | Creato 400 | 16 px | Texto corrido |
| `body2` | Creato 400 | 15 px | Apoyo, detalle de filas |
| `caption` | Creato 400 | 13 px | Notas, contadores |
| `overline` | Creato 700 | 12 px | Etiquetas de grupo del menú |
| `button` | Creato 700 | 15 px | Botones |

- Los títulos bajan solos en el teléfono (`responsiveFontSizes`).
- Mínimo 12 px en cualquier texto; el cuerpo nunca baja de 15 px.
- Nada de `fontFamily`/`fontSize` sueltos en componentes: se usa la variante.

## 3. Color

- **Marca** (`primario` Cherry Mahogany): botones principales, enlace activo, foco. Nada más.
- **Lienzo** (`fondo`): el color de fondo de la marca aclarado. **Superficie** (`superficie`): blanco, para
  tarjetas, tablas y diálogos. **Superficie alt** (`superficieAlt`): cabeceras de tabla y paneles.
- **Texto**: `texto` (títulos y cuerpo) y `textoSuave` (apoyo). Contraste mínimo AA.
- **Estados** (no cambian con la marca): éxito, advertencia, error. Siempre **tonales** (fondo suave + texto
  del mismo tono), nunca contornos.
- Bordes: neutros cálidos (`borde`, `bordeFuerte`), sacados del fondo de la marca.

## 4. Espaciado y forma

- Rejilla de **8 px** (`spacing(1)` = 8). Entre secciones 24 px (`Stack spacing={3}`); dentro de una tarjeta 16 px.
- Radios: `chico` 8 (chips, insignias), `medio` 12 (botones, campos, iconos), `grande` 16 (tarjetas),
  `extra` 24 (diálogos). Píldora solo para filtros.
- Zonas táctiles de **44 px** o más (`medidas.zonaTactil` = 48 en navegación).
- Sombras casi nulas: las tarjetas se definen por borde fino; las sombras son para lo flotante (menús, diálogos).

## 5. Iconografía

- **Un solo estilo: contorno (Outlined)** de `@mui/icons-material`. Se importa siempre la variante
  `…Outlined` (p. ej. `PlaceOutlined`). No se mezclan rellenos y contornos.
- Tamaños: **24 px** en navegación, **20 px** dentro de botones y filas (`fontSize="small"`), 32–40 px solo en
  estados vacíos.
- Un icono acompaña a un texto; el icono solo se admite con `aria-label` y `Tooltip` y nunca para la acción
  principal.
- Significado fijo: Ramas → árbol, Células → portapapeles, Lobby → pin de persona, Ministerio → manos con
  corazón, Cumpleaños → pastel, Llamar → teléfono, Editar → lápiz.

## 6. Componentes

- **Botones**: `contained` = una sola acción principal por pantalla; `outlined` = secundaria; `text` = terciaria
  (cancelar, «Más opciones»). Radio 12, alto 44 (36 en `small`). Sin degradados.
- **Campos**: contorno 12 px, alto 52, foco con borde de marca de 2 px, etiqueta flotante. Helper text solo si
  aclara algo no obvio.
- **Chips**: tonales (sin contorno). Un chip solo cuando **avisa de algo**; el estado «normal» se omite en la
  lista del teléfono (`soloTabla`).
- **Listas** (`ListadoResponsivo`): teléfono = filas con título, una línea de detalle y la **acción visible**
  (`accionVisible`); escritorio = tabla con columna de acciones fija a la derecha.
- **Cabecera de pantalla** (`EncabezadoPagina`): migas de vuelta → título `h2` → subtítulo. La acción principal
  va a la derecha en escritorio y a todo el ancho en el teléfono (`AccionPrincipal`).
- **Diálogos** (`DialogoFormulario`): hoja a pantalla completa en el teléfono, centrado en escritorio; lo
  esencial arriba y lo opcional plegado.
- **Vacíos y errores**: siempre en español, con icono, una frase y el siguiente paso.

## 7. Interacción

- Toda acción confirma con un aviso breve (`useAviso`) y refresca sin recargar.
- Lo destructivo pide un segundo toque («Toca otra vez para…»); nada se borra sin rastro (bajas, no borrados).
- Las pantallas entran con un fundido corto (220 ms) que respeta «reducir movimiento».
- Navegación: **menú lateral agrupado** (escritorio) / **barra inferior con ≤ 5 destinos + «Más»** (teléfono).

## 8. Móvil como app (no como web)

Reglas que hacen que el teléfono se sienta una app nativa:

- **Barra superior con contexto** (`CabeceraApp`): flecha de volver en las pantallas de detalle, el título aparece
  en la barra al desplazar (el título grande queda en el cuerpo), y la **acción principal es un «+» arriba a la
  derecha** (`AccionPrincipal`). Nada de botones flotantes que tapen filas.
- **Hojas inferiores** para formularios cortos (suben desde abajo, se cierran **arrastrando hacia abajo**);
  pantalla completa solo para formularios con mapa o muy largos (prop `completa` de `DialogoFormulario`).
- **Jalar para actualizar** (`JalarParaActualizar`): una PWA instalada no tiene botón de recargar.
- **Control segmentado en píldoras** en vez de pestañas subrayadas (`NavegacionMinisterio`).
- **Listas**: divisores con sangría, acción visible en la fila, fila entera táctil con respuesta al toque.
- **Sin comportamientos de web**: sin resaltado azul al tocar, sin retardo ni zoom por doble toque, sin rebote del
  navegador (ver `MuiCssBaseline` en el tema).
- **Instalable**: `display: standalone`, atajos al mantener pulsado el icono y metadatos de iOS.

## 9. Modo oscuro

- **Tres opciones** (menú de la cuenta, y pie del menú lateral en escritorio): *Auto* (sigue al dispositivo, es el valor
  por defecto), *Claro* y *Oscuro*. La elección se guarda en el navegador y se aplica **antes del primer pintado**: de noche no
  hay destello blanco.
- Sale de la misma paleta de marca: el texto de la marca (Tierra Viva) hace de fondo, el fondo de la marca (Luz Serna) hace
  de texto y el color de marca se **aclara** para que siga leyéndose sobre oscuro. Los estados (éxito, advertencia, error)
  también suben de tono. Contraste mínimo AA en ambos modos.
- **La identidad no se oscurece**: la portada del inicio, el login y el turno destacado conservan el degradado de marca y el
  logo claro en los dos modos.
- El mapa invierte sus teselas (`mapa.filtroOscuro`) para no deslumbrar; los marcadores y controles siguen el tema.
- Para tocarlo: `VALORES_OSCUROS` en `src/theme/theme.ts`. Nunca se escribe un color en un componente (ver AGENTS.md §3.1).

## 10. Cómo cambiar el aspecto

Todo sale de `apariencia` en `src/theme/theme.ts`: `paleta`, `tipografia`, `escalaTexto` y `escalaRadios`.
Para una pantalla nueva, usa los componentes de la sección 6 y las variantes del tema; si falta un token, se
agrega al tema, no a la pantalla.
