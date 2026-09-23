# Notas — Apartado "Noticias Jurídicas"

Registro de la implementación del nuevo apartado pedido por el dueño: una
burbuja de "Noticias Jurídicas" (resumida como "¿Qué pasó en el DOF la semana
pasada?") con cuadros que el administrador redacta desde el panel — título,
fecha, cuerpo y de 1 a 8 fotos por cuadro. No recopila ningún dato del usuario
que lo lee (pedido explícito del dueño).

**Ajuste posterior (mismo día):** el dueño pidió quitar el botón "Ver fuente"
porque un enlace detrás de un botón genérico no deja ver a dónde lleva antes
de tocarlo. Se quitó el campo "enlace" por completo: ahora, si el admin
escribe una URL dentro del cuerpo de la noticia, el cliente la detecta sola y
la pinta en azul/subrayada (color fijo, independiente del acento elegido en
Personalización) mostrando la URL tal cual — así el Usuario ve la dirección
real antes de hacer clic. También se pidió que las fotos ocupen todo el ancho
del cuadro (antes eran una cuadrícula de miniaturas cuadradas); ahora van una
debajo de otra a `width: 100%`, sin recortar su proporción.

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
  a todo lo ancho (cada una abre a tamaño completo en pestaña nueva) y el
  cuerpo, con cualquier URL que contenga ya convertida en enlace azul real.

## Archivos modificados

- `servidor/db/conexion.js` — tablas nuevas `noticias_juridicas` (id, titulo,
  fecha, cuerpo, creado_en, actualizado_en — sin columna "enlace", ver el
  ajuste posterior arriba) y `noticias_juridicas_imagenes` (id, noticia_id,
  archivo, mime).
- `servidor.js` — importa lo anterior; rutas públicas
  `GET /api/noticias-juridicas` y `GET /api/noticias-juridicas/imagen/:id`;
  rutas de admin `GET/POST/PUT/DELETE /api/admin/noticias-juridicas` (POST y
  PUT son `multipart/form-data`, como Canciones); registra
  `/noticias-juridicas.html` en `requiereSesionParaPagina`.
- `publico/Sistema/areasDelSistema.js` — nueva entrada en `AREAS` (para que
  Escritorio y Pestañas también la ofrezcan).
- `publico/index.html` — nueva burbuja 📰 "Noticias Jurídicas".
- `publico/admin.html` — nueva sección "Noticias Jurídicas" (lista + formulario
  con título, fecha, cuerpo y el campo de fotos múltiple; el enlace se escribe
  dentro del cuerpo).
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
