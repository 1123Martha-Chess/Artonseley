# Notas — Optimización para teléfonos / app instalada (PWA)

Registro de la revisión para que la plataforma se use bien en celular, y en
particular cuando se instala como aplicación ("Agregar a pantalla de inicio" /
"Instalar app"). Se trabaja **por etapas**: cada etapa se termina y se verifica
antes de pasar a la siguiente. El `git add/commit/push` va al final de todo.

Origen del problema reportado por el dueño: al instalar la plataforma como app
en el teléfono, "los cuadernos y otras funciones no funcionan bien".

Diagnóstico inicial:

- **PWA incompleta.** `manifest.webmanifest` solo estaba enlazado en 3 páginas
  (index, plantillas, calculadora); sin iconos con tamaños declarados, sin
  metas de iOS (`apple-mobile-web-app-*`), sin `theme-color`, sin
  `viewport-fit=cover`. Resultado: al abrir la app instalada en un iPhone con
  notch, las barras superiores quedan **debajo de la barra de estado / notch**.
- **Cuadernos (editor).** La barra de herramientas de formato solo escucha
  `mousedown` para conservar la selección; en pantalla táctil se **pierde la
  selección al tocar N/K/S**. La "hoja" y los campos no están afinados para dedo.
- **Calendario.** No tenía ninguna regla responsive; la cuadrícula del mes es
  casi inservible en un celular.
- **Zoom automático de iOS.** Los campos de texto a 14px hacen que Safari haga
  zoom solo al enfocarlos (login, buscador, calculadora, calendario…).
- Ajustes menores pendientes en música, plantillas, calculadora, pestañas, admin.
- **Escritorio.** Decisión del dueño: en pantallas de celular se muestra un
  aviso recomendando usar **Pestañas** (el mosaico de ventanas no es usable en
  ~375px de ancho). No se reescribe el arrastre para táctil.

---

## Etapa 1 — Base PWA y fundamentos móviles  (HECHA — pendiente de verificación por el dueño)

Cambios que NO dependen del layout de cada página.

### Se modifica

- **`publico/manifest.webmanifest`** — reescrito: `id`, `lang`, `dir`,
  `orientation`, `categories`, iconos declarados a 192/512 (`purpose: any`),
  `display_override`. (Un icono `maskable` dedicado —logo con margen sobre
  fondo de marca— queda como mejora futura: hace falta editar imagen y no hay
  librería para eso en el proyecto.)
- **Los 15 `.html` de `publico/`** (index, login, crear-cuenta, buscador,
  editor, notificaciones, sugerencias, configuracion, escritorio, pestanas,
  calendario, musica, calculadora, plantillas, admin, guia-de-uso) — en el
  `<head>`, justo después de la línea del `viewport`:
  - `viewport` ahora incluye `viewport-fit=cover`.
  - Bloque nuevo de metas: `theme-color`, `color-scheme`,
    `mobile-web-app-capable`, `apple-mobile-web-app-capable`,
    `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`.
  - `<link rel="manifest" href="manifest.webmanifest">` (antes solo en 3).
  - `<link rel="apple-touch-icon" ...>`.
- **`servidor/paginasLegales.js`** — el mismo bloque de metas en la plantilla
  `armarPagina()` que genera /terminos-y-condiciones.html y
  /avisos-de-privacidad.html.
- **`publico/Sistema/temaGuardado.js`** — además de aplicar el color/tema
  guardado, ahora actualiza `<meta name="theme-color">` para que la barra del
  sistema combine con el tema claro/oscuro (mismos valores de superficie que
  usa `tema.css`, duplicados a propósito como las otras 4 constantes).
- **`publico/tema.css`** — reglas base para celular al final del archivo:
  - `-webkit-text-size-adjust: 100%` en `html` (evita que iOS infle el texto).
  - En `@media (max-width: 900px)`: `font-size: 16px` en `input`/`select`/
    `textarea` (con `!important`, porque varios `<style>` de página fijan 14px)
    para cortar el zoom automático de iOS al enfocar un campo.
- **`publico/plataforma.css`** — `.inicio` y `.pantalla` respetan
  `env(safe-area-inset-*)` (notch / barra de estado) en la app instalada.
- **`publico/documento.css`** — el `body` respeta `env(safe-area-inset-*)`.

### Se agrega

- Nada (los archivos nuevos se documentan si aparecen en etapas siguientes).

### Se elimina

- Nada.

### Efecto secundario conocido de la regla de 16px

En pantallas de ≤900px, los `<select>` chiquitos de la barra de
herramientas del editor (tipografía / tamaño) y algún campo numérico
angosto (música) crecen a 16px. Se ve un poco más grande, no rompe nada,
y de todos modos el layout móvil del editor se afina en una etapa
posterior. El beneficio (cortar el zoom de iOS) pesa más.

### Estado del servidor de prueba

`npm start` arranca sin errores. `/manifest.webmanifest` responde 200 con
`content-type: application/manifest+json`. Las páginas y la plantilla de
las páginas legales incluyen ya las metas nuevas.

### Cómo verificar la Etapa 1

1. `npm start`, abrir en el teléfono la IP de la LAN que imprime el servidor.
2. En el navegador del teléfono: menú → "Agregar a pantalla de inicio" /
   "Instalar app". Debe ofrecer instalarla desde cualquier página.
3. Abrir la app instalada. En un iPhone con notch, el contenido de la pantalla
   de inicio y de Configuración ya **no** queda tapado por la barra de estado.
4. El icono en la pantalla de inicio se ve completo (no recortado).
5. Al tocar un campo de texto, el teléfono ya **no** hace zoom solo.
6. Cambiar a tema oscuro en Configuración: la barra del sistema (reloj/batería)
   combina con el fondo oscuro.

---

## Etapa 2 — Editor / Cuadernos táctil  (HECHA — pendiente de verificación por el dueño)

### Se modifica

- **`publico/Sistema/manejaHerramientasEdicion.js`** — la barra de formato ya
  no pierde la selección al tocarla en pantalla táctil:
  - Nuevo `congelarSeleccion`: mientras el dedo/ratón está sobre la barra
    (`pointerdown` en captura sobre la barra → `true`; `pointerup` /
    `pointercancel` en `document` → `false` en el siguiente tick), no se
    sobrescribe el último rango bueno.
  - `guardarSeleccion` también corre en `selectionchange` (en táctil no hay
    `mouseup`), y respeta `congelarSeleccion`.
  - `ejecutarComando` / `ejecutarComandoResaltado` reponen el rango
    (`restaurarSeleccion`) antes del comando y vuelven a guardarlo después,
    para que comandos encadenados actúen sobre lo correcto.
- **`publico/Sistema/editorPrincipal.js`** — cada tarjeta de cuaderno tiene
  ahora un botón **✎** para renombrar (en táctil el doble clic no es fiable y
  además dispara el zoom de la página). El doble clic en el nombre se conserva
  para ratón. La lógica de renombrar se factorizó en `activarRenombrado()`.
- **`publico/editor.html`** — CSS:
  - `body` / `.barra-superior` / `.pie-aviso-legal` / `.pantalla-boveda`
    respetan `env(safe-area-inset-*)` (notch / barra de estado en app
    instalada).
  - Tarjeta de cuaderno: espacio a la derecha para ✎ + 🗑, botones con
    blanco de toque de 34px.
  - `@media (max-width: 900px)` reescrito:
    - El **documento va primero**; el buscador de leyes embebido baja al final
      (antes se comía ~45vh arriba). Scroll único de página, sin scroll
      anidado (`overflow: visible` en la columna de contenido, el lienzo y la
      lista de resultados).
    - `.cuerpo-editor` pasa de cuadrícula a columna flex (apila herramientas +
      hoja + notas); arregla el track de fila que valía `100%` y estiraba la
      columna de notas.
    - Hoja vacía más corta (`--alto-pagina: 620px`) para no dejar un vacío
      enorme de scroll en el teléfono.
    - Botones de formato / selector / selector de color más grandes para el
      dedo; swatches de nota a 30px; rejilla de la frase de recuperación a 2
      columnas; nombre del cuaderno en su propia línea en la cabecera.

### Efecto secundario conocido

Los renglones de separación entre "hojas" del editor quedan más seguidos en
celular (la hoja mide 620px en vez de 1056px). Es un cuaderno de notas, no una
vista previa de impresión, así que se aceptó el cambio.

---

## Etapa 3 — Calendario  (HECHA — pendiente de verificación por el dueño)

Antes: `calendario.html` no tenía ninguna regla responsive; la cuadrícula del
mes se aplastaba para caber entera en la pantalla y las notas quedaban
ilegibles.

### Se modifica

- **`publico/calendario.html`** — CSS (solo se agregó; nada de la vista de
  escritorio cambió):
  - `body` / `.cal-barra` / `.cal-panel-fondo` / `#pantallaBoveda` respetan
    `env(safe-area-inset-*)` (notch / barra de estado en app instalada).
  - Nuevo `@media (max-width: 700px)`:
    - `html, body { height: auto }` → **la página hace scroll** en vez de
      exprimir el mes.
    - `.cal-rejilla` con `grid-auto-rows: minmax(76px, auto)`: cada día tiene
      alto suficiente para leerse; el mes largo simplemente se desplaza.
    - Encabezado: el nombre del mes en su propia línea; debajo, la fila de
      `<< < > >>` y "Hoy", con botones de 44×40 para el dedo.
    - Panel del día: la "Situación" (etiqueta + detalle) pasa a dos renglones;
      botones de nota más grandes.
    - Rejilla de la frase de recuperación a 2 columnas.

### Se elimina

- Nada.

### Cómo verificar

1. Abre el Calendario en el celular / app instalada.
2. El mes se ve completo, cada día con espacio; se hace scroll si no cabe.
3. `<< < Mes Año > >> Hoy` caben sin encimarse.
4. Toca un día: el panel abre bien, "Situación" en dos renglones, se puede
   escribir sin que el teléfono haga zoom.
5. En iPhone instalado, la barra de arriba no queda tapada por el notch.

---

## Etapa 4 — Buscador  (HECHA)

- **`publico/buscador.html`** — `body` (lados), `.barra-superior` (arriba) y el
  `.pie-aviso-legal` fijo (abajo) respetan `env(safe-area-inset-*)`.
  `buscadorPrincipal.js` ya mide el alto real del pie para reservar el espacio,
  así que el ajuste del notch inferior se propaga solo. El `@media` de 640px
  que ya existía no se tocó.

## Etapa 5 — Escritorio  (HECHA)

- **`publico/escritorio.html`**:
  - Nuevo bloque `.aviso-movil-escritorio`: en `@media (max-width: 760px)` tapa
    todo con un aviso ("El Escritorio es para pantallas grandes") y un botón a
    **Pestañas**. El JS del escritorio sigue corriendo detrás, inofensivo.
  - Se agregó el HTML del aviso al inicio del `<body>`.
  - Barra fija, lienzo y pie fijos ajustados con `env(safe-area-inset-*)` (para
    tablets angostas, > 760px).

## Etapa 6 — Pestañas  (HECHA)

- **`publico/pestanas.html`**:
  - `.pestanas-barra` fija: `height: calc(44px + inset-top)` + padding con
    `env(...)` → la tira de pestañas baja del notch.
  - `.area-contenido` (donde vive el `<iframe>`): `top/left/right/bottom` con
    `env(safe-area-inset-*)`. Dentro de un iframe `env(...)` vale 0, así que las
    páginas de adentro no pueden esquivar el notch solas — se hace en el
    contenedor.
  - `@media (max-width: 640px)`: pestañas más angostas, botón de cerrar y "+"
    más grandes para el dedo, se oculta el "← Inicio" (el logo ya lleva ahí).

## Etapa 7 — Música  (HECHA)

- **`publico/musica.html`**: `.pantalla-musica` con `env(safe-area-inset-*)`;
  la barra de volumen pegajosa se pega en `top: env(safe-area-inset-top)`.
  `@media (max-width: 400px)`: la barra de volumen se parte en dos renglones
  (iconos arriba, deslizador a todo el ancho abajo).

## Etapa 8 — Plantillas  (HECHA)

- **`publico/plantillas.html`**: `body` (lados), `.plt-barra-superior` (arriba)
  y `.plt-cuerpo` (abajo) con `env(safe-area-inset-*)`. El `@media` de 720px que
  ya existía no se tocó.

## Etapa 9 — Calculadora  (sin cambios propios)

- Usa `.pantalla` de `plataforma.css`, que ya quedó con `env(safe-area-inset-*)`
  en la Etapa 1. Los campos ya se apilan en una columna en pantallas chicas y
  la tabla del desglose vive en `.tabla-scroll`. No hizo falta nada más.

## Etapa 10 — Admin  (HECHA — retoque ligero)

- **`publico/admin.html`**: `body` (lados), `header.barra-admin` (arriba),
  `main` (abajo), `.aviso-flotante` y el fondo de los modales respetan
  `env(safe-area-inset-*)`. La página ya era razonablemente responsive (tablas
  en `.tabla-scroll`, `@media` de 600px, cabecera con `flex-wrap`). Es un panel
  de uso casi siempre en escritorio, así que no se invirtió más.

---

## Estado final

Todas las etapas hechas. Falta solo, como mejora futura opcional: un icono
`maskable` dedicado para la PWA (ver Etapa 1).

`git add / commit / push` ejecutado al terminar todas las etapas, como pidió el
dueño.
