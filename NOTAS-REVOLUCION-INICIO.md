# Revolución de la interfaz — pantalla de inicio + pantallas completas

Fecha: 2026-08-31. **No subido a GitHub todavía.**

Objetivo: `index.html` deja de ser el buscador y pasa a ser una **pantalla
de inicio** con un saludo aleatorio (letra Georgia, color negro) y unos
rectángulos de esquinas redondeadas ("burbujas") que llevan a cada parte
del sistema. Las tres pestañas que eran paneles laterales (Notificaciones,
Buzón de sugerencias, Configuración/Personalización) pasan a ser páginas
completas propias.

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `publico/plataforma.css` | Estilo compartido de la pantalla de inicio y de las 3 pantallas completas nuevas (no lo usa `buscador.html`). |
| `publico/buscador.html` | El buscador, mudado tal cual desde el viejo `index.html` (mismo `<style>` embebido, mismo `buscadorPrincipal.js`). Los íconos 🔔/⚙️ de la barra ahora son enlaces a `notificaciones.html` / `configuracion.html`; el logo enlaza a `index.html`. |
| `publico/notificaciones.html` | Pantalla completa de "leyes modificadas / avisos" (antes panel 🔔). |
| `publico/sugerencias.html` | Pantalla completa del buzón de sugerencias (antes panel dentro de ⚙️). |
| `publico/configuracion.html` | Pantalla completa: Mi cuenta (apodo), Personalización, enlaces a Guía/Términos/Avisos, enlace a admin (solo admin), Cerrar sesión. |
| `publico/Sistema/inicioPrincipal.js` | Entry point de `index.html`: aplica el color guardado y pinta el saludo aleatorio con el apodo del usuario. |
| `publico/Sistema/frasesBienvenida.js` | Lista de frases de saludo (con `{user}`) y `fraseDeBienvenidaAleatoria(nombre)`. Fallback = texto literal `[user]`. |
| `publico/Sistema/paginaNotificaciones.js` | Entry point de `notificaciones.html` (lógica sacada de `manejaSugerencias.js`, sin panel). |
| `publico/Sistema/paginaSugerencias.js` | Entry point de `sugerencias.html` (lógica sacada de `manejaBuzonSugerencias.js`, sin panel). |
| `publico/Sistema/paginaConfiguracion.js` | Entry point de `configuracion.html`. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `publico/index.html` | **Reescrito por completo**: era el buscador, ahora es la pantalla de inicio (burbujas). El buscador se fue a `buscador.html`. |
| `publico/Sistema/buscadorPrincipal.js` | Quita imports/llamadas de `inicializarSugerencias`, `inicializarBuzonSugerencias`, `inicializarConfiguracion`. `inicializarPersonalizacion()` → `aplicarModoGuardado()`. Quita el `ResizeObserver` de `--altura-barra-superior` (solo lo usaban los paneles). Comentarios actualizados (index.html → buscador.html). |
| `publico/Sistema/manejaPersonalizacion.js` | Nuevos exports: `aplicarModoGuardado()` (solo color/logos) y `renderizarPersonalizacionEn(el)` (selector embebido, sin título). Se mantiene `inicializarPersonalizacion()` / `alternarPanelPersonalizacion()` para `editor.html`. `pintarPanel` → `pintarSelector(destino, incluirTitulo)`. |
| `publico/Sistema/manejaConfiguracion.js` | En `editor.html`, la opción "Volver al Buscador" ahora apunta a `buscador.html` (antes `index.html`). Lo demás sin cambios; este módulo ya solo lo usa `editor.html`. |
| `servidor.js` | Import de `actualizarNombre`. Rutas de página nuevas (`buscador/notificaciones/sugerencias/configuracion.html`) con `requiereSesionParaPagina`. `/api/login` y `/api/sesion` devuelven `nombre`. Nueva ruta `POST /api/mi-cuenta` (guarda el apodo, máx. 40 chars, vacío = borrar). |
| `servidor/db/conexion.js` | Columna `nombre TEXT` en `usuarios` (en el `CREATE TABLE` y con `ALTER TABLE` para bases existentes). |
| `servidor/db/usuarios.js` | Nueva función `actualizarNombre(usuarioId, nombre)` (trim; vacío → `NULL`). |
| `servidor/paginasLegales.js` | Enlace "← Volver al buscador" → "← Volver al inicio". |
| `publico/guia-de-uso.html` | Igual: "← Volver al buscador" → "← Volver al inicio". |
| `publico/admin.html` | "← Ir al buscador" → "← Volver al inicio". |
| `publico/crear-cuenta.html` | "Ir al buscador" → "Ir al inicio". |
| `CLAUDE.md` | Sección `publico/` actualizada con la nueva estructura de páginas y el campo `nombre`. |

## Archivos ELIMINADOS

Ninguno. `manejaSugerencias.js`, `manejaBuzonSugerencias.js`, `manejaPanelesLaterales.js`
se conservan porque `editor.html` todavía los usa (su rediseño es una etapa
posterior — ver "Pendientes").

## Comportamiento nuevo del apodo ("Mi cuenta")

- `usuarios.nombre` es opcional. Se edita en `configuracion.html` → "Mi cuenta".
- Si está vacío, el saludo del inicio muestra el texto literal `[user]`
  (decisión del dueño: no inventar un nombre).
- Pendiente: un apartado "Mi cuenta" más completo con todos los datos que
  se tengan del usuario. Por ahora solo el apodo.

## Pendientes / etapas siguientes (dichas por el dueño)

1. Rediseñar `buscador.html` a pantalla completa con la distribución de los
   mockups `cuadritosMios.png` / `cuadritosMiosEjemplo.png` (rejilla de
   cuadros + paneles "Documentos seleccionados" y "Cuadernos"). Esto
   probablemente fusiona buscador + editor y permitiría limpiar los
   módulos de panel lateral que hoy se conservan por `editor.html`.
2. Burbuja "Música" en el inicio (aún no existe esa función).
3. Apartado "Mi cuenta" completo.

## Verificado (etapa 1)

Servidor arranca y corre la migración sin error. Probado con un usuario de
prueba (ya borrado): login, `/api/sesion` con `nombre`, `POST /api/mi-cuenta`
(guardar y borrar), y render de `index/buscador/notificaciones/sugerencias/configuracion.html`
sin errores de consola.

---

# Etapa 2 — logo nuevo + pantalla "Escritorio" (cuadrícula)

Fecha: 2026-09-01. **Tampoco subido a GitHub.**

## Logo del inicio

- Copiadas a `publico/imagenes/`: `artonseley-pagina.png` (ícono compás,
  fondo transparente, viene de `IMAGENES/´ARTONSELEY PAGINA.png`) y
  `artonseley-letras.png` (nombre en trazo grueso, transparente, viene de
  `IMAGENES/ARTONSELEY Letras.png`).
- `manejaPersonalizacion.js` → `MODOS[azul].logoIcono/logoLetras` ahora
  apuntan a esas dos (reemplazan `artonseley-logo-azul.jpg` /
  `-letras-azul.png`, que tenían fondo blanco). Esto también cambia el
  logo de `buscador.html` y `editor.html` (misma marca, versión mejor).
- `index.html`: `src` de la marca actualizados; `plataforma.css`
  `.inicio-marca` con alturas más chicas (ícono 34px, letras 18px).

## Pantalla "Escritorio" (nueva)

Decisiones del dueño: página aparte (el inicio de burbujas no cambia,
solo se le agregó una 6ª burbuja "🧩 Escritorio"); cada ventana es un
`<iframe>` de su página; la distribución se guarda en `localStorage`
(clave `escritorioLayout`), por navegador; mecánica confirmada tal cual.

| Archivo | Qué es |
|---|---|
| `publico/escritorio.html` (nuevo) | El lienzo: barra fija con "+ Agregar ventana" y "← Inicio", cuadrícula de cuadros (`.celda`), caja de piezas emergente. `<style>` propio + `plataforma.css`. |
| `publico/Sistema/escritorioPrincipal.js` (nuevo) | Toda la lógica: cuadrícula (CELDA=94, SEP=6), colocar/mover/redimensionar con snap y detección de choque (`cabe()`), persistencia, iframes que NO se recrean al repintar (Map `elementos`). |
| `publico/index.html` (mod) | 6ª burbuja "🧩 Escritorio" → `escritorio.html`. |
| `servidor.js` (mod) | `escritorio.html` agregada a la lista de rutas con `requiereSesionParaPagina`. |

Mecánica: cuadrícula de cuadros fijos; COLS depende del ancho de la
ventana, FILAS del alto y crece si una ventana llega más abajo. Cada
ventana empieza 1×1, se agranda por bordes (un eje) o esquinas (dos ejes)
hasta llenar el lienzo; no se enciman (fantasma verde/rojo mientras se
arrastra, y si el destino no cabe no se aplica). Cada una de las 5 es
única: la ✕ la quita y vuelve a la caja de piezas. El botón ⤢ de cada
ventana abre esa página a pantalla completa.

### Verificado (etapa 2)

Con usuario de prueba (ya borrado): logo nuevo se ve en inicio y
buscador; `escritorio.html` pinta la cuadrícula vacía con su pista;
arrastrar "Buscador" de la caja al lienzo lo coloca 1×1 y persiste al
recargar; redimensionar (asa) y mover (barra) cambian `{c,r,w,h}` y
guardan; un tamaño que chocaría con otra ventana se rechaza; una
distribución 3×2 + 3×2 + 2×1 se renderiza con los tres iframes cargando
bien (como `cuadritosMiosEjemplo.png`).

---

# Etapa 3 — Calendario con bóveda cifrada propia

Fecha: 2026-09-01. **Tampoco subido a GitHub.**

Decisiones del dueño: página propia + burbuja "📅 Calendario" + pieza en
el Escritorio; un mes a pantalla completa; navegación con los símbolos
exactos `<` `>` (mes) y `<<` `>>` (año); al hacer clic en un día,
formulario Título* / Situación / Información (solo Título obligatorio);
varias notas por día, editables y borrables; **bóveda cifrada separada de
cuadernos, con su propia frase de 12 palabras** (se descartó la idea
original de 5 palabras: no es BIP-39, no detecta errores de dedo y es más
débil); borrado automático de notas de más de un mes **opcional**, casilla
en Configuración, **apagado por defecto**; color por día de una paleta
fija de 8 colores.

| Archivo | Qué es |
|---|---|
| `publico/Sistema/almacenamientoCalendario.js` (nuevo) | IndexedDB APARTE: base `artonseley_calendario::<correo>`, stores `configuracion` / `eventos` / `dias`. Copia del patrón de `almacenamientoCifradoIndexedDB.js` pero independiente: borrar/restablecer la bóveda de cuadernos no toca nada de aquí. |
| `publico/Sistema/bovedaCalendario.js` (nuevo) | Orquesta la bóveda del calendario: incógnito, crear frase (12 palabras) + verificar 3 + activar, desbloquear, "¿perdiste tus 12 palabras?" (restablecer), "olvidar en este dispositivo". Reutiliza `criptografiaCuadernos.js` TAL CUAL (BIP-39 + AES-256-GCM). Semilla recordada en `localStorage` con clave `artonseley::calendario_semilla_dispositivo::<correo>`. Verificador propio: `ARTONSELEY_CALENDARIO_OK`. |
| `publico/Sistema/calendarioPrincipal.js` (nuevo) | Entry point de `calendario.html`: pide `/api/sesion` → `inicializarBovedaCalendario` → al desbloquear carga y descifra todo, corre el barrido de notas viejas si la casilla está encendida, y pinta el mes. Panel de día: selector de color + lista de notas + formulario. Todo se cifra por registro. |
| `publico/calendario.html` (nuevo) | `<style>` propio (CSS de la bóveda con las MISMAS clases que usa `bovedaCalendario.js`, + CSS del calendario) + `plataforma.css`. Rejilla `display:grid` 7 columnas que llena la pantalla. Sub-vistas de la bóveda: `vistaBovedaCargando/Incognito/Configuracion/Verificacion/Desbloqueo`. |
| `publico/index.html` (mod) | 7ª burbuja "📅 Calendario". |
| `publico/Sistema/escritorioPrincipal.js` (mod) | `calendario` agregado a `VENTANAS` (pieza del Escritorio). |
| `publico/configuracion.html` (mod) | Bloque "Calendario" con la casilla `#casillaBorradoCalendario`. |
| `publico/Sistema/paginaConfiguracion.js` (mod) | `configurarBorradoCalendario(email)`: lee/escribe `calendario::borradoAutomatico::<correo>` en `localStorage` ('1' = encendido). Apagado por defecto. |
| `servidor.js` (mod) | `calendario.html` agregada a la lista de rutas con `requiereSesionParaPagina`. |

**Modelo de datos (en memoria tras descifrar):**
- `eventos`: `{ id, fecha:'YYYY-MM-DD', titulo, situacion, situacionPreset, informacion, creadoEn, actualizadoEn }` — un registro cifrado por nota en el store `eventos`.
- `coloresPorFecha`: `fecha -> { id, fecha, color }` — un registro cifrado por día con color en el store `dias`. "Sin color" borra el registro.

**Barrido automático:** al abrir el calendario, si la casilla está
encendida, borra cada nota cuya `fecha + 1 mes < hoy` (00:00). NO toca los
colores de los días.

### Verificado (etapa 3)

Con el usuario admin de prueba del navegador: se genera la frase de 12
palabras, se verifican 3 al azar, se activa la bóveda; el calendario pinta
"Septiembre 2026" a pantalla completa con `<< < > >>` + "Hoy"; `>` pasa a
octubre y `>>` a 2027; clic en el 15 abre el panel; se guarda una nota
(Título + preset "Pendiente" + detalle + información) y se le pone color
azul al día; al RECARGAR, la bóveda se auto-desbloquea (semilla en
localStorage), el día 15 sigue azul y con su nota (descifrado correcto).
La casilla de Configuración escribe/borra la clave en localStorage.
`editor.html` (cuadernos) sigue con SU propia frase distinta — las dos
bóvedas son independientes.

## Pendientes (siguen)

1. `cuadritosMios` a fondo: probablemente esto ya lo cubre la pantalla
   Escritorio; confirmar con el dueño si quiere además rediseñar el
   `buscador.html` interno.
2. Burbuja "Música".
3. Apartado "Mi cuenta" completo.
4. Optar por migrar los iframes del Escritorio a componentes nativos si
   molesta el scroll interno (el dueño eligió iframe como MVP).
5. `artonseley-pagina.png` pesa 533 KB (1101×1101) — conviene optimizar/
   reescalar para producción.
6. Calendario: no hay export/import de respaldo `.arton` como sí tienen
   los cuadernos — agregarlo si el dueño lo pide.
7. `bovedaCalendario.js` duplica bastante de `manejaBovedaCifrada.js`. Si
   surge una 3ª bóveda, conviene generalizar a una fábrica compartida.

---

# Etapa 4 — Nota de ejemplo del Calendario, pie del Escritorio y apartado de Música

Fecha: 2026-09-01. **Tampoco subido a GitHub.**

Tres cosas que pidió el dueño:

1. **Nota de ejemplo en el Calendario.** La primera vez que alguien abre el
   Calendario (bóveda recién creada, sin notas) se le siembra una nota
   "Ejemplo de nota!" con los campos Situación e Información llenos de texto
   que explica qué se puede escribir. Bandera en `localStorage`
   (`calendario::ejemploSembrado::<correo>`): si el usuario la borra, no
   reaparece; si ya tiene notas propias, no se inyecta.

2. **Pie de página del Escritorio.** Un pie fijo, chico pero legible:
   *"Puedes usar más espacio hacia los lados agrandando la ventana.
   ¡Inténtalo!"*.

3. **Apartado de Música** (8ª burbuja + página propia + pieza del Escritorio).
   Reproductor con barra de volumen fija (silenciar / volumen / pausa /
   detener), lista de canciones desplazable (imagen + nombre + espectrómetro
   que sale de una línea central), y un bloque para programar una playlist
   (canción + minutos). Las canciones se suben desde el panel de
   administración. La música **sigue sonando al navegar entre páginas** de
   artonseley.site mientras no esté la pausa global.

## Decisiones del dueño (Etapa 4)

- Música: subida de archivos con `multer`, tabla `canciones` solo con
  metadatos, archivos en `CARPETA_DATOS/musica/` (disco persistente, junto a
  `artonseley.db`).
- Fin de la playlist: en los **últimos 10 segundos del tiempo total** (suma de
  los minutos de cada entrada), sin importar la canción ni el momento, fade-out
  de 10 s y se detiene TODO el audio. La playlist no se repite.
- Entre entradas de la playlist: crossfade de 5 s. Bucle de una sola canción:
  fade de 1 s en cada reinicio. Canción suelta = bucle infinito.
- Continuidad entre páginas: se acepta el micro-corte (~0.2 s) al cambiar de
  página, disimulado por el fade-in de 1 s (limitación real de un sitio
  multipágina sin recargar).

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `publico/musica.html` | Página del reproductor: barra fija (volumen/silencio/pausa/detener), lista desplazable de canciones (imagen + nombre + `<canvas>` de espectrómetro), bloque "Programar playlist". `<style>` propio + `plataforma.css`. |
| `publico/Sistema/musicaPrincipal.js` | Entry point de `musica.html`. Solo interfaz: pinta la lista (`/api/canciones`), conecta la barra y el armador de playlist, y anima el espectrómetro de la canción activa leyendo el `AnalyserNode` del motor. |
| `publico/Sistema/reproductorGlobal.js` | **El motor.** Se incluye en TODAS las páginas con sesión. Estado en `localStorage` (`artonseley::reproductor`). Reanuda al cargar cada página con fade-in de 1 s. NO suena dentro de un `<iframe>` (reenvía a `window.top.__reproductorArtonseley`). Grafo Web Audio: `<audio>` → MediaElementSource → ganancia de fade → ganancia de volumen → AnalyserNode → destino. Maneja bucle, crossfades de playlist (5 s), fundido final (10 s) y el chip "▶ Reanudar música" si el navegador bloquea el autoplay. |
| `servidor/db/canciones.js` | CRUD de la tabla `canciones` (listar, buscar, crear con `orden` = máx+1, renombrar, `moverCancion` sube/baja intercambiando `orden`, eliminar devuelve la fila para borrar sus archivos). |
| `servidor/musicaArchivos.js` | Carpeta `CARPETA_DATOS/musica/` + `multer` (`diskStorage`, nombre `<uuid>.<ext>`, audio ≤ 20 MB, imagen ≤ 4 MB, `fileFilter` por tipo). Helpers `rutaArchivoMusica` (guarda contra `../`), `borrarArchivoDeMusica`. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `publico/Sistema/calendarioPrincipal.js` | Nueva `sembrarNotaEjemploSiAplica()` (llamada en `alDesbloquear`, entre `cargarDatos` y `render`). Bandera `calendario::ejemploSembrado::<correo>`. |
| `publico/escritorio.html` | `.escritorio-pie` (pie fijo abajo, 22px, Arial 11px). `.lienzo-scroll { bottom: 22px }` para no taparlo. `<footer>` nuevo + `<script>` de `reproductorGlobal.js`. |
| `publico/index.html` | 8ª burbuja "🎵 Música" → `musica.html`. `<script>` de `reproductorGlobal.js`. Comentario actualizado (Música ya existe). |
| `publico/buscador.html`, `editor.html`, `notificaciones.html`, `sugerencias.html`, `configuracion.html`, `calendario.html` | `<script type="module" src="Sistema/reproductorGlobal.js">` antes del entry point de cada página. |
| `publico/admin.html` | Nueva `<section>` "Música" (título + audio + imagen + lista con ↑/↓, Renombrar, Eliminar). |
| `publico/Sistema/manejaAdmin.js` | Bloque de música: `cargarCanciones()`, `moverCancion`, `renombrarCancion` (usa `abrirModalConCampos`), `eliminarCancion` (usa `abrirModal`), envío del formulario con `FormData` (NO pasa por `peticionAdmin`, que fija JSON). `cargarCanciones()` agregado al arranque. |
| `publico/Sistema/escritorioPrincipal.js` | `{ id: 'musica', nombre: 'Música', icono: '🎵', url: 'musica.html' }` en `VENTANAS`. |
| `servidor.js` | Imports de `db/canciones.js` y `musicaArchivos.js`. `musica.html` en la lista de `requiereSesionParaPagina`. Rutas `GET /api/canciones`, `GET /api/musica/audio/:id`, `GET /api/musica/imagen/:id` (sesión, sin licencia). Rutas admin `GET/POST/PATCH/DELETE /api/admin/canciones` (el POST usa `multer` envuelto para traducir sus errores a 400 en español y limpiar archivos huérfanos). |
| `servidor/db/conexion.js` | Tabla `canciones` en el `db.exec(...)` del esquema. |
| `package.json` | Dependencia `multer` (`^2.0.1`). Correr `npm install`. |
| `CLAUDE.md` | Sección de Música (página, motor, rutas, tabla, carpeta). |

## Archivos ELIMINADOS

Ninguno.

## Verificado (Etapa 4)

Con un usuario admin de prueba (`pruebamusica@test.com`, **ya borrado**) en un
servidor de prueba (`PORT=3999`, para no tocar el que el dueño tenía corriendo
en :3000):

- **Backend, con `curl`:** login; subir las dos canciones de prueba
  (`ikoliks...` con imagen, `alex-morgan...` sin imagen); `GET /api/canciones`
  y `/api/admin/canciones`; `GET /api/musica/audio/1` con `Range` → `206` con
  contenido parcial; imagen → `200 image/png`; canción sin portada → `404`;
  título vacío → `400` y se borra el archivo huérfano; audio que en realidad es
  imagen → `400` (fileFilter); `PATCH` mover (intercambia `orden`) y renombrar;
  `DELETE` → borra la fila y los dos archivos de `data/musica/`.
- **Navegador (Chrome):** `musica.html` pinta las dos canciones (imagen +
  nombre + canvas); clic en una fila pone `modo:'cancion'`, resalta la fila y
  persiste en `localStorage`; volumen, silencio (🔊/🔇), pausa (⏸/▶) y
  "Detener" (limpia el estado y conserva el volumen) actualizan el motor;
  armar una playlist de 2 entradas muestra "Duración total: 5 min" e
  "Iniciar playlist" pone `modo:'playlist'` con el arreglo correcto.
- **`reproductorGlobal.js`** se carga sin errores de consola en `index.html`,
  `escritorio.html` y `calendario.html`; dentro de un `<iframe>` NO crea su
  propio motor (`window.__reproductorArtonseley` queda `undefined` ahí) y
  `musica.html` embebida muestra el aviso "La reproducción se controla desde
  la pestaña de Música".
- **Escritorio:** el pie se ve pegado abajo (`bottom` del `<footer>` = borde de
  la ventana); "🎵 Música" aparece en la caja de piezas.
- **Calendario:** al activar una bóveda nueva aparece "Ejemplo de nota!" en el
  día de hoy con Situación ("Pendiente" + detalle) e Información (párrafo
  explicativo) llenas; borrarla y recargar → NO reaparece (la bandera en
  `localStorage` queda en `'1'`).
- Pendiente de prueba manual del dueño (el autoplay y la salida de audio real
  no se pueden verificar por automatización sin un gesto de usuario de verdad):
  que se **oiga** la música, los fundidos de 1/5/10 s, y la continuidad real al
  navegar entre páginas.

### Corrección (mismo día) — la música volvía a empezar al cambiar de página

`reproductorGlobal.js` tenía dos problemas que hacían que al navegar la canción
arrancara desde el segundo 0:

1. **`guardar()` pisaba la posición con 0.** El `setInterval(guardar, 2000)` y
   el `visibilitychange` guardaban `audio.currentTime` aunque la canción
   todavía no se hubiera reanudado en esa página (o el navegador bloqueara el
   autoplay), y `currentTime` es 0 en ese momento. Ahora `guardar()` solo toma
   la posición cuando el audio **está sonando de verdad** (`audioEstaSonando()`:
   `!paused && !ended && readyState>=2 && currentTime>0`); si no, deja
   `posicion`/`guardadoEn` como estaban. Al pausar se anota la posición ANTES
   de parar; al reanudar de una pausa se pone `guardadoEn = ahora` para retomar
   exactamente donde se quedó.
2. **El grafo de Web Audio dejaba el audio mudo.** `createMediaElementSource`
   enruta el audio del `<audio>` SOLO por el grafo; con el `AudioContext`
   suspendido (sin gesto del usuario) no salía sonido y el `src` a veces ni se
   cargaba. Ahora el volumen y los fundidos se hacen sobre **`audio.volume`**
   directamente (un `setInterval` que lo mueve ~30 veces/s), que siempre
   funciona. El `AudioContext` + `AnalyserNode` se arman aparte y **solo** para
   el espectrómetro de `musica.html`, de forma perezosa y únicamente después de
   que hubo un gesto del usuario en la página (`navigator.userActivation`); si
   falla, se sigue sin espectrómetro y la reproducción no se ve afectada.

Verificado en el navegador: al recargar/navegar con una canción "sonando",
`localStorage` conserva `posicion` (ya no se pisa con 0) y la página pide
`/api/musica/audio/<id>` para retomar. Sin errores de consola.

---

# Etapa 5 — Recordatorio diario del calendario (notificación del sistema, Web Push)

Fecha: 2026-09-01. **Tampoco subido a GitHub.**

El dueño quiere que Artonseley le recuerde al usuario, **con el sitio cerrado**,
que revise su calendario. Un aviso al día.

## Decisiones del dueño (Etapa 5)

- **Privacidad a tope.** Las notas del calendario están cifradas de extremo a
  extremo; el servidor no las ve. La notificación **no lleva nada del
  calendario** — texto FIJO:
  > "Debido a la privacidad, no sabemos si tienes una nota en el día de hoy de
  > tu calendario. ¡Ven y comprobémoslo!"
- El servidor manda un "ping" **todos los días a ciegas**. No se entera de nada.
- Un aviso al día, a partir de las **7:00 a.m.** hora local del dispositivo; si
  la computadora estaba apagada, llega al encender (el servicio de push lo
  encola, TTL 16 h).
- Dominio: **www.artonseley.site**.
- Como la notificación no lleva contenido, **el Service Worker NO descifra
  nada** — no toca la bóveda ni la semilla. El modelo cero-conocimiento queda
  intacto.

## Cómo funciona

1. Configuración → interruptor "Recordatorios del calendario" → permiso de
   notificaciones → se registra `/sw.js` → `pushManager.subscribe` con la clave
   pública VAPID → `POST /api/recordatorios/suscribir` (con el `offsetMinutos`
   del dispositivo).
2. El servidor, cada 30 min (temporizador interno) o vía cron externo a
   `POST /api/tareas/recordatorios`, revisa cada suscripción: si en su hora
   local ya pasaron las 7:00 y no se le mandó hoy, le manda un push vacío.
3. `sw.js` recibe el push y muestra la notificación con el texto fijo. Al hacer
   clic, abre/enfoca `/calendario.html`.

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `publico/sw.js` | El único Service Worker. Solo maneja el evento `push` (muestra la notificación de texto fijo) y `notificationclick` (abre el calendario). No es PWA offline: sin caché ni handler de `fetch`. Su texto DEBE coincidir con `MENSAJE_RECORDATORIO` del servidor. |
| `publico/manifest.webmanifest` | Manifest PWA mínimo (nombre, ícono = favicon, `display: standalone`). Enlazado desde `index.html`. Sobre todo para el alta en iOS. |
| `publico/Sistema/recordatoriosCalendario.js` | Helper del cliente: `soportado()`, `estado()`, `activar()`, `desactivar()`, `sincronizar()`. Registra el SW, se suscribe con la clave VAPID (`GET /api/recordatorios/clave-publica`) y manda la suscripción + `offsetMinutos = -new Date().getTimezoneOffset()`. Bandera local `recordatorios::activado::<correo>` solo para la sincronización silenciosa. |
| `servidor/db/suscripcionesPush.js` | CRUD de la tabla `suscripciones_push` (upsert por `endpoint`, listar, marcar enviada, borrar por endpoint). |
| `servidor/recordatoriosCalendario.js` | `configurarWebPush()` (setVapidDetails; `false` si faltan claves), `MENSAJE_RECORDATORIO`, y `barrerYEnviar()`: recorre las suscripciones, calcula fecha/hora local de cada una desde su `offset_minutos`, y a las que les toca (hora >= 7 y `ultimo_envio != fecha_local`) les manda `webpush.sendNotification` con payload `{tipo:'recordatorio-calendario'}`, TTL 16 h. 404/410 → borra la suscripción muerta. |
| `servidor/scripts/generarVapid.js` | `npm run generar-vapid` — imprime el par VAPID para pegar en `.env`. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `servidor.js` | Imports de `db/suscripcionesPush.js`, `recordatoriosCalendario.js`, `VAPID_PUBLICA`/`TOKEN_TAREAS`. CSP: `worker-src` y `manifest-src` explícitos (`'self'`). Ruta `GET /sw.js` (antes de `express.static`, con `Cache-Control: no-cache` y `Service-Worker-Allowed: /`). Rutas `GET /api/recordatorios/clave-publica`, `POST /api/recordatorios/suscribir` (valida forma + `offsetMinutos` en `[-840,840]`), `POST /api/recordatorios/cancelar`, `POST /api/tareas/recordatorios` (404 sin `TOKEN_TAREAS`, si no exige `Authorization: Bearer`). Temporizador interno tras `app.listen` (`iniciarRecordatoriosCalendario`): barrido al arrancar + cada 30 min; no corre en `NODE_ENV=test` ni sin claves VAPID. |
| `servidor/config.js` | Exporta `VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_SUBJECT` (por defecto `mailto:soporte@artonseley.site`), `TOKEN_TAREAS`. `console.warn` en producción si faltan las VAPID. |
| `servidor/db/conexion.js` | Tabla `suscripciones_push` (usuario_id, endpoint UNIQUE, p256dh, auth, offset_minutos, ultimo_envio). |
| `package.json` | Dependencia `web-push` + script `generar-vapid`. Correr `npm install`. |
| `.env.example` | `VAPID_PUBLICA`, `VAPID_PRIVADA`, `VAPID_SUBJECT`, `TOKEN_TAREAS`. |
| `publico/configuracion.html` | Bloque "Recordatorios del calendario" (`#casillaRecordatorios` + `#estadoRecordatorios` + párrafo de límites). |
| `publico/Sistema/paginaConfiguracion.js` | `configurarRecordatorios(email)`: pinta el estado, engancha el `change` (activar/desactivar), y llama `sincronizar()` al cargar. Deshabilita la casilla si `!soportado()`. |
| `publico/Sistema/calendarioPrincipal.js` | Import dinámico de `recordatoriosCalendario.js` → `sincronizar(usuarioEmail)` al abrir el calendario (renueva suscripción / actualiza huso). |
| `publico/index.html` | `<link rel="manifest" href="manifest.webmanifest">`. |
| `CLAUDE.md`, `README.md` | Documentación de la función. |

## Archivos ELIMINADOS

Ninguno.

## Verificado (Etapa 5)

Servidor de prueba en `PORT=3999` con claves VAPID y `TOKEN_TAREAS` de prueba:

- **Arranque:** crea la tabla `suscripciones_push`; el log dice "Recordatorios
  del calendario: activos (barrido cada 30 min)". Sin claves VAPID diría
  "desactivados".
- **`/sw.js`:** responde con `Cache-Control: no-cache`, `Service-Worker-Allowed: /`
  y `Content-Type: application/javascript`. `/manifest.webmanifest` → 200.
- **Rutas (con `curl`):** `GET /api/recordatorios/clave-publica` → 401 sin
  sesión, devuelve la clave con sesión. `POST /suscribir` → 400 con payload mal
  formado, 400 con `offsetMinutos` fuera de rango, 200 y fila en la base con el
  payload correcto (upsert por endpoint). `POST /api/tareas/recordatorios` → 404
  sin `TOKEN_TAREAS`, 401 con token equivocado, 200 con el token correcto
  devolviendo `{enviadas, borradas, errores}`.
- **Barrido:** con `offset_minutos` que da hora local >= 7 → intenta enviar
  (con un endpoint falso: `errores: 1`, sin marcar `ultimo_envio`, y el log
  registra el motivo — reintentará). Con `offset_minutos` que da hora local < 7
  → `{enviadas:0, errores:0}`, no toca nada.
- **Navegador (localhost):** Configuración pinta el bloque, la casilla queda
  habilitada; `recordatoriosCalendario.js` carga sin errores, `soportado()` da
  `true`, `estado()` da `desactivado`; `navigator.serviceWorker.register('/sw.js')`
  registra el SW con scope raíz (`http://localhost:3999/`) y queda activo. Sin
  errores de consola ni de CSP.
- **Pendiente de prueba manual del dueño** (la automatización no puede dar el
  permiso de notificaciones — es un diálogo nativo del navegador): conceder el
  permiso, que se cree la suscripción real, que llegue el push y se vea la
  notificación, y que al hacer clic abra el calendario. Se puede probar rápido
  con DevTools → Application → Service Workers → "Push" (evento simulado) con
  payload `{"tipo":"recordatorio-calendario"}`.

Usuario de prueba (`pruebapush@test.com`) y su fila en `suscripciones_push`
**ya borrados**.

---

# Etapa 6 — Calculadora Jurídica Financiera (Fase 1: laboral) + dos ajustes de UI

Fecha: 2026-09-03. **Tampoco subido a GitHub.**

Tres cosas en esta etapa: dos ajustes de interfaz que pidió el dueño y la
primera fase de una función nueva.

## Ajuste 1 — Buscador sin los íconos 🔔/⚙️

En `buscador.html` la barra superior tenía enlaces a Notificaciones y
Configuración que ya son redundantes (están como burbujas en el inicio, al que
se vuelve con el logo) y estorbaban con la nueva interfaz. Se quitaron el
`<div class="grupo-iconos-superior">` y su CSS (`.grupo-iconos-superior`,
`.boton-icono`); comentarios de la barra actualizados.

## Ajuste 2 — Escritorio como botón principal en el inicio

En `index.html` la burbuja "🧩 Escritorio" se sacó de la rejilla y se puso
arriba, sola y centrada, como **botón principal**: un cuadro de **300 px de
ancho fijo** (≈ un tercio de los 900 px de `.rejilla-accesos`, pero el CSS
lleva el valor en píxeles, no en %). Clases nuevas en `plataforma.css`:
`.acceso-principal` (contenedor centrado) y `.burbuja-principal` (el cuadro
grande: 300×200, ícono 46 px, borde de 3 px). Las otras 8 burbujas quedan en la
rejilla debajo.

## Función nueva — Calculadora Jurídica Financiera (Fase 1)

Burbuja "🧮 Calculadora" + `calculadora.html` + pieza del Escritorio. Adaptación
de un plan de una sesión anterior (escrito para la arquitectura vieja) al
sistema actual. **Todo el cálculo en `servidor/`**, el cliente solo manda datos
y pinta — igual que `/api/buscar`.

### Decisiones del dueño (Etapa 6)

- Solo la **Fase 1** (indemnización / liquidación laboral) + el **esqueleto**
  para enchufar las fases 2 (INPC/intereses) y 3 (pensión) después.
- Fase 1 **completa**: todas las causas de separación, cálculo del SDI, salarios
  vencidos, selector de zona (general / frontera norte), desglose renglón por
  renglón con el artículo de la LFT.
- El **tope de 2× salario mínimo** (Arts. 485-486 LFT) es un **interruptor**
  (`tope2xSM`: `solo-prima` [por defecto, criterio SCJN] / `todo` / `ninguno`),
  con nota que explica la discusión.
- **El dueño redacta los Términos y el Aviso.** Yo solo dejé una **nota
  `<!-- PENDIENTE -->` dentro de cada `.md`** (invisible en el sitio gracias al
  arreglo del renderer) marcando qué cláusula falta. El descargo **dentro de la
  calculadora** sí lo puse yo (en pantalla y en cada resultado).

### Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `servidor/calculadoras/registro.js` | El "esqueleto": mapa `tipo → módulo` (`CALCULADORAS`) + carga de `indicesEconomicos.json` (`obtenerIndicesEconomicos`, `indicesEconomicosListos`). Agregar una fase = un archivo + una línea aquí. |
| `servidor/calculadoras/indemnizacionLaboral.js` | Fase 1. `validar(entradas) → string[]` y `calcular(entradas, indices)`. Funciones puras. Fórmulas LFT: 3 meses (Art. 48), 20 días/año o mitad del tiempo si < 1 año (Art. 50), prima de antigüedad 12 días/año con tope a 2× SM (Art. 162), salarios vencidos con interés del 2% mensual tras 12 meses (Art. 48 reforma 2012), aguinaldo (Art. 87), vacaciones proporcionales con la tabla del Art. 76 reforma 2023, prima vacacional (Art. 80). Devuelve `desglose` (con `grupo`, `concepto`, `detalle`, `monto`, `fundamento`), `totales`, `supuestos`, `avisos` y `descargo`. |
| `servidor/datos/indicesEconomicos.json` | Salario mínimo (general y frontera norte), UMA, año. **Valores en 0** — el dueño los llena; mientras estén en 0 la ruta responde `{tipo:'mensaje'}` en vez de calcular. Se relee al reiniciar. |
| `publico/calculadora.html` | Formulario (fechas, salario, zona, causa, SDI directo o calculado, meses de juicio, prestaciones devengadas, interruptor del tope) + `#resultadoCalculo`. `<style>` propio + `plataforma.css`. Descargo destacado arriba y repetido en el resultado. |
| `publico/Sistema/calculadoraPrincipal.js` | Entry point: `aplicarModoGuardado()`, chequeo de sesión, muestra/oculta campos según causa y modo SDI, `POST /api/calculadora/indemnizacion-laboral`, y pinta según `datos.tipo` (`resultado` = total + tabla agrupada + supuestos + avisos + descargo; `errores`; `mensaje`). Sin lógica de cálculo. |

### Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `servidor.js` | Import de `calculadoras/registro.js`. `calculadora.html` en la lista de `requiereSesionParaPagina`. Ruta `POST /api/calculadora/:tipo` (`jsonEstandar` + `requiereSesionAPI` + `requiereLicenciaVigente`): 404 si el tipo no existe, `400 {tipo:'errores'}` si `validar` regresa errores, `{tipo:'mensaje'}` si faltan índices, si no `calcular`. |
| `servidor/renderizarMarkdownLegal.js` | Ignora líneas/bloques de comentario HTML (`<!-- ... -->`), de una o varias líneas. Así el dueño deja notas dentro de los `.md` legales sin que salgan en la página pública. |
| `publico/index.html` | Burbuja "🧮 Calculadora". (+ el "Ajuste 2": Escritorio como botón principal.) |
| `publico/Sistema/escritorioPrincipal.js` | `{ id: 'calculadora', nombre: 'Calculadora', icono: '🧮', url: 'calculadora.html' }` en `VENTANAS`. |
| `publico/buscador.html` | Sin los íconos 🔔/⚙️ (Ajuste 1). |
| `publico/plataforma.css` | `.acceso-principal` / `.burbuja-principal` (Ajuste 2). |
| `Terminos_y_Condiciones_Artonseley.md` | Nota `<!-- ⚠️ PENDIENTE (Calculadora...) -->` cerca de la Cláusula 8. |
| `Aviso_de_Privacidad_Artonseley.md` | Nota `<!-- ⚠️ PENDIENTE (Calculadora...) -->` en la Sección II. |
| `CLAUDE.md` | Documentación de la calculadora + el renderer + los ajustes de UI. |

### Archivos ELIMINADOS

Ninguno.

### Verificado (Etapa 6)

- **Prueba unitaria de `indemnizacionLaboral.js`** (con índices de prueba
  278.80 / 419.88): despido injustificado 7 años, salario $1000, SDI calculado
  → 3 meses = 90 × SDI, 20 días/año = 20 × antigüedad × SDI, prima = 12 ×
  antigüedad × min(salario, 2×SM); el interruptor `solo-prima` / `todo` /
  `ninguno` cambia solo los renglones que debe; renuncia < 15 años → sin prima
  ni indemnización, ≥ 15 → con prima; despido justificado → prima sí,
  indemnización no; **reinstalación → solo salarios vencidos (bug corregido:
  antes colaba la prima de antigüedad)**; validaciones (fecha mal, salario 0,
  baja < ingreso, mínimos de ley del aguinaldo/prima) devuelven la lista de
  errores.
- **Ruta HTTP** (con `curl`, usuario de prueba con licencia): tipo inexistente
  → 404; body vacío → `400 {tipo:'errores'}`; caso válido → `{tipo:'resultado'}`
  con total y desglose; índices en 0 → `{tipo:'mensaje'}`; licencia vencida →
  403; sin sesión → 401.
- **Navegador (localhost):** la página pide sesión; el formulario muestra/oculta
  "Resultado esperado", "Meses de juicio" y el bloque de SDI según la causa y el
  modo; "Calcular" pinta el total, la tabla agrupada (Indemnización /
  Prestaciones devengadas) con el fundamento por renglón, los supuestos, los
  avisos y el descargo; `{tipo:'mensaje'}` se muestra sin romper nada. Burbuja
  "🧮 Calculadora" en el inicio; pieza "Calculadora" en la caja del Escritorio;
  el Escritorio se ve como botón grande centrado; el buscador ya no trae los
  íconos. Sin errores de consola.
- **Legal:** `/terminos-y-condiciones.html` y `/avisos-de-privacidad.html` **no**
  muestran los `<!-- PENDIENTE -->` (el renderer los quita) y el resto del texto
  sigue igual.
- `servidor/datos/indicesEconomicos.json` quedó con los valores en **0** (los
  llena el dueño). Usuarios de prueba (`pruebacalc@test.com`,
  `pruebavencida@test.com`) **ya borrados**.

## Etapa 6 (continuación) — Índices económicos en el panel + verificación de sesión

Fecha: 2026-09-03/04.

### Los índices económicos ahora se editan en el panel de administración

Ya no viven en un JSON que hay que editar a mano y reiniciar. Se movieron a la
base de datos y el administrador los captura desde `admin.html`.

| Archivo | Cambio |
|---|---|
| `servidor/db/conexion.js` (mod) | Tabla `indices_economicos` de UNA fila (`id INTEGER PRIMARY KEY CHECK (id = 1)`), con `INSERT OR IGNORE ... VALUES (1)` para que la fila exista siempre. Columnas: `anio`, `salario_minimo_general`, `salario_minimo_frontera_norte`, `uma`, `actualizado_en`. |
| `servidor/db/indicesEconomicos.js` (nuevo) | `obtenerIndicesEconomicos()` y `guardarIndicesEconomicos({...})`, siempre en camelCase (mapea a/desde las columnas snake_case). |
| `servidor/calculadoras/registro.js` (mod) | Ya no lee el JSON: re-exporta `obtenerIndicesEconomicos` de `servidor/db/indicesEconomicos.js`. Sin caché — el cambio del panel surte efecto de inmediato. |
| `servidor/datos/indicesEconomicos.json` | **Eliminado.** |
| `servidor.js` (mod) | Import de `guardarIndicesEconomicos`. Rutas `GET /api/admin/indices-economicos` y `PUT /api/admin/indices-economicos` (valida año 2000-2100 y montos 0-100000). |
| `publico/admin.html` (mod) | Sección "Índices económicos (calculadora)": 4 campos (año, SM general, SM Frontera Norte, UMA) + guardar. |
| `publico/Sistema/manejaAdmin.js` (mod) | `cargarIndicesEconomicos()` + envío del formulario con `PUT`. Avisa si faltan valores. Agregado al arranque. |
| `CLAUDE.md` (mod) | Actualizado (DB + panel, ya no JSON). |

Verificado: la migración crea y siembra la fila en 0; `GET` devuelve los
valores; `PUT` con datos inválidos → 400 con los errores juntos, con datos
válidos → guarda y devuelve `actualizado_en`; **la calculadora toma los valores
nuevos sin reiniciar** (`{tipo:'mensaje'}` con ceros → `{tipo:'resultado'}` tras
el `PUT`); `PUT` sin sesión admin → 401. En el navegador: la sección carga con
los valores, guarda desde el formulario, y muestra "Faltan valores" si se
guardan ceros. Índices dejados en **0** y usuario de prueba (`pruebaidx@test.com`)
**borrado**.

### Verificación de que TODAS las páginas nuevas piden sesión

Probado con `curl` sin cookie: `/`, `/index.html`, `/buscador.html`,
`/editor.html`, `/notificaciones.html`, `/sugerencias.html`,
`/configuracion.html`, `/escritorio.html`, `/calendario.html`, `/musica.html`,
`/calculadora.html` y `/admin.html` responden **302 → `/login.html`**. Las
públicas a propósito (`/login.html`, `/crear-cuenta.html`, `/guia-de-uso.html`,
`/terminos-y-condiciones.html`, `/avisos-de-privacidad.html`, `/sw.js`,
`/manifest.webmanifest`) responden 200. Con sesión válida, las protegidas
responden 200. El gateo ya estaba completo en `servidor.js` (listas de
`requiereSesionParaPagina` / `requiereAdminParaPagina`); esta verificación solo
lo confirmó de punta a punta.

### El botón "Escritorio" del inicio quedó más aplastado

`plataforma.css` `.burbuja-principal`: de 300×200 (ícono y texto en columna) a
**380×120** (ícono y texto en una fila), ícono 40 px. Móvil: alto 100 px. Los
80 px que se le quitaron de alto se pasaron al ancho, como pidió el dueño.

---

## Pendiente del dueño (Etapa 6)

1. Capturar en **admin.html → "Índices económicos"** el salario mínimo general,
   el de la Frontera Norte y la UMA vigentes (ya no hace falta reiniciar).
2. Redactar las cláusulas legales marcadas con `<!-- PENDIENTE -->` en los dos
   `.md` y borrar esos comentarios.
3. Fases 2 (actualización INPC + intereses moratorios) y 3 (pensión
   alimenticia), cuando el dueño lo indique.

---

# Etapa 7 — Generador de Plantillas y Documentos (Fase 1)

Fecha: 2026-09-04. **Tampoco subido a GitHub.**

Función nueva: una biblioteca de "machotes" (contratos, demandas, recursos…) con
marcadores `{{clave}}` que el abogado llena y exporta. Adaptación de un plan de
una sesión anterior + el diagrama `arquitectura_generador_plantillas.png`.

## Arquitectura (del diagrama, respetada)

- **Servidor:** solo el TEXTO de cada plantilla (tabla `plantillas`), con sus
  marcadores. El admin la crea / edita / versiona desde el panel.
- **Navegador:** el motor de fusión (`Sistema/fusionPlantilla.js`) sustituye los
  marcadores por lo que capturó el abogado y exporta. Los datos del
  cliente/expediente **nunca tocan el servidor**. (La bóveda cifrada de
  "Expedientes" reutilizables es la Fase 2, todavía no.)

## Decisiones del dueño (Etapa 7)

- **Solo la Fase 1** + el esqueleto: burbuja + página + pieza del Escritorio;
  tabla + CRUD en admin; barra lateral de categorías colapsables; por plantilla,
  formulario de captura + fusión + vista previa + exportar. Sin Expedientes.
- **Contenido:** yo monté el motor + **3 plantillas de EJEMPLO** cortas,
  marcadas "⚠️ EJEMPLO — no usar ante autoridad". La biblioteca real la carga el
  dueño / su mamá (abogada) desde el panel.
- **Variables:** se **auto-detectan** los `{{marcadores}}` del cuerpo; el
  formulario se arma solo, usando el nombre como etiqueta.
- **Exportar:** "Descargar como Word (.doc)" (Blob de HTML compatible con Word,
  sin librería) + "Imprimir / Guardar como PDF" (`window.print()` con
  `@media print`). Cero dependencias nuevas.

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `servidor/plantillas/ejemplos.js` | Las 3 plantillas de EJEMPLO (esqueletos cortos con la advertencia en el primer renglón). Se siembran solo si la tabla `plantillas` está vacía. |
| `servidor/plantillas/extraerVariables.js` | `extraerVariables(cuerpo)` → escanea `{{clave}}` / `{{clave.subclave}}`, dedupe, y arma una etiqueta legible (`cliente.nombre` → `Cliente — Nombre`). |
| `servidor/db/plantillas.js` | CRUD de la tabla `plantillas`: `listarPlantillas` (sin cuerpo, para la barra lateral), `listarPlantillasParaAdmin` (todo), `buscarPlantillaPorId`, `crearPlantilla`, `actualizarPlantilla` (sube `version`), `eliminarPlantilla`. |
| `publico/plantillas.html` | Barra superior + barra lateral (categorías colapsables) + área principal. Descargo destacado arriba. `#paraImprimir` + `@media print` para el PDF. `<style>` propio + `plataforma.css`. |
| `publico/Sistema/plantillasPrincipal.js` | Entry point: `GET /api/plantillas` → agrupa por categoría → barra lateral; al elegir una, `GET /api/plantillas/:id`, arma el formulario desde `variables`; "Generar" → `fusionar` → vista previa con los `[falta: x]` resaltados + botones de exportar. |
| `publico/Sistema/fusionPlantilla.js` | El motor: `fusionar(cuerpo, valores)` (marcador sin valor → `[falta: clave]`), `tieneFaltantes`, `descargarComoWord(titulo, texto)` (`.doc` HTML), `imprimir(titulo, texto)`. Reutilizable por la Fase 2. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `servidor/db/conexion.js` | Tabla `plantillas` (`categoria`, `titulo`, `cuerpo`, `version`, fechas). Tras el esquema: si la tabla está vacía, siembra `PLANTILLAS_EJEMPLO`. Import de `../plantillas/ejemplos.js`. |
| `servidor.js` | Imports de `db/plantillas.js` y `plantillas/extraerVariables.js`. `plantillas.html` en `requiereSesionParaPagina`. `GET /api/plantillas` y `GET /api/plantillas/:id` (sesión + licencia). Admin: `GET/POST/PUT/DELETE /api/admin/plantillas` (POST/PUT con `jsonDocumentoLegal` 5 MB; `validarPlantilla` común; `PUT` sube la versión). |
| `publico/index.html` | Burbuja "📝 Plantillas". |
| `publico/Sistema/escritorioPrincipal.js` | `{ id: 'plantillas', nombre: 'Plantillas', icono: '📝', url: 'plantillas.html' }` en `VENTANAS`. |
| `publico/admin.html` | Sección "Plantillas de documentos": lista + formulario (categoría con `<datalist>`, título, cuerpo `<textarea>` con marcadores detectados en vivo, editar/eliminar). |
| `publico/Sistema/manejaAdmin.js` | `cargarPlantillasAdmin()`, envío del formulario (`POST` / `PUT`), `editarPlantilla` (precarga + "v1 → v2"), `eliminarPlantilla` (modal), detección de marcadores en vivo, cancelar edición. Agregado al arranque. |
| `Terminos_y_Condiciones_Artonseley.md` | Nota `<!-- ⚠️ PENDIENTE (Generador de Plantillas) -->` cerca de la Cláusula 8. |
| `Aviso_de_Privacidad_Artonseley.md` | Nota `<!-- ⚠️ PENDIENTE (Generador de Plantillas) -->` en la Sección II. |
| `CLAUDE.md` | Documentación de la función. |

## Archivos ELIMINADOS

Ninguno.

## Verificado (Etapa 7)

- **Arranque:** la migración crea `plantillas` y siembra las 3 de ejemplo (solo
  si estaba vacía). `extraerVariables` (prueba unitaria) dedupe y arma etiquetas.
- **Backend con `curl`** (usuario de prueba con licencia): `GET /api/plantillas`
  → lista sin `cuerpo`; `GET /api/plantillas/2` → `cuerpo` + `variables` (11
  marcadores del machote de demanda); id inexistente → 404. Admin: `POST` crea,
  `POST` con campos vacíos → 400 con los errores juntos, `PUT` sube `version`,
  `DELETE` borra. Sin sesión → 401 (API) / 302 → `/login.html` (página).
- **Navegador:** burbuja "📝 Plantillas" en el inicio; pieza en el Escritorio;
  la barra lateral agrupa por categoría y colapsa; elegir una plantilla arma el
  formulario (etiquetas legibles); llenar dejando 2 campos vacíos + "Generar" →
  vista previa con el texto fusionado y `[falta: fecha]` / `[falta: abogado.nombre]`
  resaltados en rojo + aviso; "Descargar como Word (.doc)" no truena y escapa
  `& < >`; `#paraImprimir` existe para el PDF. En el admin: lista las 3, la
  detección de marcadores en vivo funciona, crear/editar (sube versión)/eliminar
  (con confirmación) OK. Sin errores de consola.
- **Legal:** `/terminos-y-condiciones.html` y `/avisos-de-privacidad.html` **no**
  muestran las notas `<!-- PENDIENTE -->`.
- Usuario de prueba (`pruebaplt@test.com`) y plantillas de prueba **borrados**;
  quedan solo las 3 de EJEMPLO.

## Pendiente (Etapa 7)

1. El dueño / su mamá cargan la biblioteca real de plantillas desde el panel
   (y, si quieren, borran las 3 de EJEMPLO).
2. Redactar las cláusulas legales marcadas con `<!-- PENDIENTE -->` y borrar
   esos comentarios.
3. Fase 2: bóveda cifrada de "Expedientes" reutilizables (3ª bóveda — conviene
   generalizar el patrón que hoy duplican `manejaBovedaCifrada.js` y
   `bovedaCalendario.js`) con autocompletado hacia las plantillas.
4. Fase 3: que el usuario edite / cree sus propias plantillas (copia local
   cifrada).

---

# Etapa 8 — "Pestañas": un navegador interno + botón principal en el inicio

Fecha: 2026-09-04. **Tampoco subido a GitHub.**

Función nueva que pidió el dueño: un apartado **PESTAÑAS**, a la derecha de
Escritorio en la pantalla de inicio y del mismo tamaño. Es un navegador
interno: una herramienta ocupa toda la ventana y arriba hay una tira de
pestañas tipo Chrome/Edge para saltar entre las demás. También se puede abrir
como ventana del Escritorio y, al revés, el Escritorio se puede abrir como
pestaña dentro de Pestañas.

## Decisiones del dueño (Etapa 8)

- **Pestañas repetidas: SÍ.** Se puede tener 2+ pestañas de la misma
  herramienta a la vez (como un navegador real). Cada pestaña tiene su propio
  identificador (`uid`) y su propio `<iframe>` independiente.
- **Botón "+" con menú desplegable**, sin página intermedia: al tocar "+" se
  abre un menú con las herramientas; eliges una y se abre directo en una
  pestaña nueva. Al cerrar la **última** pestaña se muestra una rejilla para
  elegir otra (misma lista que el menú).
- **Cruce completo Escritorio ↔ Pestañas:** "Pestañas" se agrega como ventana
  del Escritorio y "Escritorio" se puede abrir como pestaña dentro de
  Pestañas. (Sí, esto permite iframes anidados si el usuario se empeña; cada
  nivel es solo un iframe más, se aceptó como en el MVP del Escritorio.)

## Cómo funciona

- `pestanas.html` es una página completa con sesión (igual que el resto). Barra
  fija arriba: marca → inicio, tira de pestañas desplazable en horizontal,
  botón "+", enlace "← Inicio". Debajo, a pantalla completa, un `<iframe>` por
  pestaña **apilados**; solo el de la pestaña activa se ve (se alternan con el
  atributo `hidden`, **no** se recrean, así el iframe conserva su estado al
  cambiar de pestaña).
- Estado en `localStorage` (por navegador, no sigue a la cuenta), igual que el
  Escritorio: `pestanasAbiertas` = arreglo `[{ uid, appId }]`, `pestanasActiva`
  = `uid` de la activa. Al cargar se validan contra la lista de áreas y se
  descartan las entradas corruptas.

## Lista de áreas compartida

Antes, `escritorioPrincipal.js` tenía su propio arreglo `VENTANAS` con las 9
áreas. Se sacó a un módulo nuevo, `Sistema/areasDelSistema.js`, que exporta
`AREAS` (ahora 11: las 9 + Escritorio + Pestañas) y `AREA_POR_ID`. Cada
pantalla filtra su propia área:

- El Escritorio usa `AREAS.filter(a => a.id !== 'escritorio')`.
- Pestañas usa `AREAS.filter(a => a.id !== 'pestanas')`.

Agregar un área nueva al sistema en el futuro = una entrada en `AREAS` y las dos
pantallas la toman.

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `publico/Sistema/areasDelSistema.js` | Lista única `AREAS` / `AREA_POR_ID` (`{ id, nombre, icono, url }`) que comparten el Escritorio y Pestañas. |
| `publico/Sistema/pestanasPrincipal.js` | Toda la lógica de Pestañas: estado (`pestanas` + `activa`), persistencia en `localStorage`, render de la tira y de los iframes (Map `marcos` por `uid`, no se recrean), menú del "+", rejilla de la pantalla vacía, cerrar/activar pestaña. |
| `publico/pestanas.html` | El navegador interno: `<style>` propio (tira de pestañas, menú, área de contenido, pantalla vacía) + `plataforma.css`. Incluye `reproductorGlobal.js` como todas las páginas con sesión. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `publico/Sistema/escritorioPrincipal.js` | Ya no define `VENTANAS` a mano: `import { AREAS }` y `const VENTANAS = AREAS.filter(a => a.id !== 'escritorio')`. Así "Pestañas" aparece automáticamente en la caja de piezas. Comentarios de cabecera actualizados. |
| `publico/index.html` | 2º botón PRINCIPAL "🗂️ Pestañas" dentro de `.acceso-principal`, junto a "🧩 Escritorio" y del mismo tamaño. Comentario de cabecera actualizado. |
| `publico/plataforma.css` | `.acceso-principal` pasa a `flex-wrap: wrap` + `gap: 18px` para sostener los dos botones principales lado a lado (en móvil se apilan). Comentario actualizado. |
| `servidor.js` | `/pestanas.html` agregado a la lista de rutas con `requiereSesionParaPagina`. |
| `CLAUDE.md` | Sección "Page structure" con `pestanas.html`, `areasDelSistema.js` y los dos botones principales (380×120). Música: `pestanas` agregado a la lista de páginas con sesión. |

## Archivos ELIMINADOS

Ninguno.

## Verificado (Etapa 8)

- `node --check` de los tres archivos JS nuevos/tocados y de `servidor.js`: OK.
- **Servidor de prueba** (`PORT=3999`, `CARPETA_DATOS` a una base aparte en
  scratch para no tocar `data/artonseley.db`; usuario `pruebapestanas@test.com`
  y su base **ya borrados**):
  - Sin sesión: `/pestanas.html` → **302 → `/login.html`** (igual que el resto).
  - Con sesión: `/pestanas.html` → 200 y trae los `id` esperados
    (`tiraPestanas`, `botonNueva`, `menuNueva`, `areaContenido`, `sinPestanas`,
    `rejillaAreas`).
  - `Sistema/pestanasPrincipal.js`, `Sistema/areasDelSistema.js` y las
    dependencias (`manejaPersonalizacion.js`, `reproductorGlobal.js`) se sirven
    200 `application/javascript`.
  - `index.html` con sesión trae los dos `href="escritorio.html"` /
    `href="pestanas.html"` de los botones principales.
- **Pendiente de prueba en el navegador (el dueño):** la extensión de Chrome no
  estaba conectada en esta sesión, así que no se pudo hacer la prueba visual.
  Falta confirmar a mano:
  1. En el inicio se ven Escritorio y Pestañas como dos botones grandes del
     mismo tamaño (y en móvil se apilan).
  2. En `pestanas.html`: "+" abre el menú y coloca la pestaña nueva; se pueden
     tener dos pestañas de la misma herramienta; cambiar de pestaña no recarga
     el iframe (lo escrito se conserva); cerrar pestañas mueve la activa a la
     vecina; cerrar la última muestra la rejilla; al recargar, las pestañas y
     la activa se restauran desde `localStorage`.
  3. En el Escritorio, "Pestañas" aparece en la caja de piezas y funciona como
     ventana; dentro de Pestañas, "Escritorio" funciona como pestaña.
  4. La música sigue sonando al entrar/salir de `pestanas.html`.

## Pendiente (Etapa 8)

1. Prueba visual en el navegador (los 4 puntos de arriba).
2. Si el dueño quiere: reordenar las pestañas arrastrándolas (hoy salen en el
   orden en que se abrieron; no hay drag para reordenar).
3. Si molesta el scroll interno de los iframes, aplica el mismo pendiente que
   el Escritorio (migrar a componentes nativos en vez de iframe).

## Etapa 8 (continuación) — dos ajustes pedidos por el dueño

Fecha: 2026-09-04.

1. **Botón "+" de Pestañas, más a la izquierda y que se recorra.** Estaba fijo
   del lado derecho de la barra (la tira de pestañas tenía `flex: 1` y lo
   empujaba). Ahora el botón vive DENTRO de `#tiraPestanas`, como última pieza
   (`pestanasPrincipal.js` lo reinserta al final en cada `render()`): queda
   pegado a la pestaña de más a la derecha y se va corriendo hacia la derecha
   con cada pestaña nueva, igual que en Chrome/Edge. Con 0 pestañas queda
   pegado a la marca, del lado izquierdo.
2. **Plantillas: quitar el autocompletado del navegador (tarjetas guardadas,
   etc.) en el formulario de captura.** Cada `<input>` ya llevaba
   `autocomplete="off"` (evita que el navegador RECUERDE lo capturado), pero
   el dueño reportó que en "Recibo de honorarios" → campo de Expediente
   seguía apareciendo el "cuadrito" flotante para rellenar con datos ya
   guardados (tarjetas bancarias). Se agregó `autocomplete="off"` también al
   `<form>` (`plantillasPrincipal.js` → `pintarFormulario()`): ese atributo a
   nivel de formulario es el que apaga esa sugerencia flotante en los
   navegadores que la muestran por formulario y no por campo.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `publico/pestanas.html` | El botón `#botonNueva` pasa a vivir dentro de `#tiraPestanas`; `.boton-nueva` usa `align-self: flex-end` para nivelarse con el borde inferior de las pestañas (que se estiran a toda la tira). |
| `publico/Sistema/pestanasPrincipal.js` | `render()` reinserta `botonNueva` como último hijo de `tira` después de pintar las pestañas (se había ido con el `tira.innerHTML = ''`). |
| `publico/Sistema/plantillasPrincipal.js` | `pintarFormulario()` agrega `form.autocomplete = 'off'`. |

### Verificado

`node --check` de los tres archivos: OK. **Pendiente de prueba visual del
dueño** (sin extensión de Chrome conectada en esta sesión): confirmar que el
botón "+" se ve pegado a la última pestaña y se corre al agregar una nueva, y
que ya no aparece el cuadrito de autocompletar en el campo de Expediente de
"Recibo de honorarios".

### Corrección — `autocomplete="off"` no bastaba, seguía saliendo el cuadrito

El dueño probó en su navegador y el cuadrito de "tarjetas guardadas" seguía
apareciendo pese al `autocomplete="off"` del `<input>` y del `<form>`. Esto es
un comportamiento CONOCIDO y a propósito de Chrome/Edge: para los campos que
el navegador clasifica como de pago o dirección, ignora deliberadamente el
valor `"off"` (tanto en el campo como en el formulario) para "ayudar" al
usuario — no es un descuido del sitio.

El truco que sí respetan: darle al `autocomplete` un valor que NO sea `"off"`
ni ningún término reconocido (p. ej. `no-autocompletar-expediente-numero`).
Al no reconocerlo como "apagado" ni como un tipo de campo conocido, el
navegador no le aplica su clasificación automática y dejar de ofrecer datos
guardados. Se cambió en `publico/Sistema/plantillasPrincipal.js` →
`pintarFormulario()`: el `<form>` usa `no-autocompletar-formulario-plantilla`
y cada `<input>` usa `no-autocompletar-<clave del marcador>` (un valor
distinto por campo).
