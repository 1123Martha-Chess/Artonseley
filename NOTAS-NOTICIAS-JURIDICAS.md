# Notas — Apartado "Noticias Jurídicas"

Registro de la implementación del nuevo apartado pedido por el dueño: una
burbuja de "Noticias Jurídicas" (resumida como "¿Qué pasó en el DOF la semana
pasada?") con cuadros que el administrador redacta desde el panel — título,
fecha, cuerpo, un enlace opcional y de 1 a 8 fotos por cuadro. No recopila
ningún dato del usuario que lo lee (pedido explícito del dueño).

## Decisiones tomadas

- **Sesión sí, licencia no.** Igual que Música/Calendario/Encuestas: cualquier
  cuenta con sesión ve las noticias, sin exigir licencia vigente — es
  contenido informativo, no el buscador legal de pago.
- **Orden automático por fecha.** Se muestran más recientes primero según la
  fecha que el admin le pone a cada noticia (no por cuándo se cargó), así no
  hace falta un botón de reordenar como en Canciones/Enlaces oficiales.
- **Edición de fotos: todo o nada.** Al editar una noticia, las fotos son
  opcionales: si el admin no elige ninguna se conservan las que ya tenía; si
  elige al menos una, reemplazan a TODAS las anteriores. No hay endpoint para
  borrar/agregar una foto suelta — se mantiene simple.
- **Fotos en disco, no en la base de datos** — mismo patrón que Música
  (`servidor/musicaArchivos.js`): viven en `CARPETA_DATOS/noticias-juridicas/`.

## Archivos nuevos

- `servidor/db/noticiasJuridicas.js` — CRUD de las tablas `noticias_juridicas`
  y `noticias_juridicas_imagenes`.
- `servidor/noticiasJuridicasArchivos.js` — subida (multer) y borrado de las
  fotos en disco, límite 4 MB por foto y 8 fotos por noticia.
- `publico/noticias-juridicas.html` + `publico/Sistema/noticiasJuridicasPrincipal.js`
  — la página pública: un cuadro (`.bloque`) por noticia con galería de fotos
  (cada una abre a tamaño completo en pestaña nueva), cuerpo y, si tiene, un
  botón "Ver fuente" que abre el enlace en pestaña nueva.

## Archivos modificados

- `servidor/db/conexion.js` — tablas nuevas `noticias_juridicas` (id, titulo,
  fecha, cuerpo, enlace, creado_en, actualizado_en) y
  `noticias_juridicas_imagenes` (id, noticia_id, archivo, mime).
- `servidor.js` — importa lo anterior; rutas públicas
  `GET /api/noticias-juridicas` y `GET /api/noticias-juridicas/imagen/:id`;
  rutas de admin `GET/POST/PUT/DELETE /api/admin/noticias-juridicas` (POST y
  PUT son `multipart/form-data`, como Canciones); registra
  `/noticias-juridicas.html` en `requiereSesionParaPagina`.
- `publico/Sistema/areasDelSistema.js` — nueva entrada en `AREAS` (para que
  Escritorio y Pestañas también la ofrezcan).
- `publico/index.html` — nueva burbuja 📰 "Noticias Jurídicas".
- `publico/admin.html` — nueva sección "Noticias Jurídicas" (lista + formulario
  con título, fecha, cuerpo, enlace y el campo de fotos múltiple).
- `publico/Sistema/manejaAdmin.js` — lógica de esa sección: listar, crear,
  editar (con reemplazo opcional de fotos), eliminar.

## Verificado

- `node --check` sobre todos los archivos `.js` nuevos/tocados.
- Arranque real del servidor (`npm start`): crea las tablas nuevas sin error.
- `GET /api/noticias-juridicas` y `GET /api/admin/noticias-juridicas` sin
  sesión → 401; `GET /noticias-juridicas.html` sin sesión → redirige a login;
  el archivo `Sistema/noticiasJuridicasPrincipal.js` se sirve (200).
- **Pendiente de que el dueño pruebe en el navegador** con una cuenta real:
  crear una noticia desde `admin.html` con 1–8 fotos, verla en
  `noticias-juridicas.html`, editarla, y borrarla.
