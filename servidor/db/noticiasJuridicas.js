// noticiasJuridicas.js
// -------------------------------------------------------------------
// Acceso a las tablas "noticias_juridicas" y "noticias_juridicas_imagenes"
// del apartado "Noticias Jurídicas" (ver conexion.js). El administrador
// crea/edita/borra las noticias desde el panel (rutas /api/admin/noticias-
// juridicas en servidor.js); el usuario solo las lee con GET
// /api/noticias-juridicas. Los archivos de las fotos los maneja
// servidor/noticiasJuridicasArchivos.js — aquí solo se guardan sus nombres.
// -------------------------------------------------------------------

import { db, ejecutarEnTransaccion } from './conexion.js';

function imagenesDeNoticia(noticiaId) {
  return db
    .prepare('SELECT id, archivo, mime FROM noticias_juridicas_imagenes WHERE noticia_id = ? ORDER BY id ASC')
    .all(noticiaId);
}

// Más reciente primero (por la fecha que le puso el admin, no por cuándo
// se cargó), como corresponde a un resumen de "lo que pasó la semana
// pasada". id DESC como desempate entre noticias con la misma fecha.
export function listarNoticiasJuridicas() {
  const noticias = db.prepare('SELECT * FROM noticias_juridicas ORDER BY fecha DESC, id DESC').all();
  return noticias.map((noticia) => ({ ...noticia, imagenes: imagenesDeNoticia(noticia.id) }));
}

export function buscarNoticiaJuridicaPorId(id) {
  const noticia = db.prepare('SELECT * FROM noticias_juridicas WHERE id = ?').get(id);
  if (!noticia) return null;
  return { ...noticia, imagenes: imagenesDeNoticia(noticia.id) };
}

export function buscarImagenDeNoticiaPorId(imagenId) {
  return db.prepare('SELECT * FROM noticias_juridicas_imagenes WHERE id = ?').get(imagenId);
}

// imagenes: [{ archivo, mime }, ...], ya subidas a disco por
// servidor/noticiasJuridicasArchivos.js.
export function crearNoticiaJuridica({ titulo, fecha, cuerpo, imagenes }) {
  return ejecutarEnTransaccion(() => {
    const info = db
      .prepare('INSERT INTO noticias_juridicas (titulo, fecha, cuerpo) VALUES (?, ?, ?)')
      .run(titulo, fecha, cuerpo);
    const noticiaId = info.lastInsertRowid;

    const insertarImagen = db.prepare(
      'INSERT INTO noticias_juridicas_imagenes (noticia_id, archivo, mime) VALUES (?, ?, ?)'
    );
    for (const imagen of imagenes) {
      insertarImagen.run(noticiaId, imagen.archivo, imagen.mime);
    }

    return buscarNoticiaJuridicaPorId(noticiaId);
  });
}

// Solo actualiza el texto (título/fecha/cuerpo); las fotos se reemplazan
// aparte con reemplazarImagenesDeNoticia (ver más abajo).
export function actualizarNoticiaJuridica(id, { titulo, fecha, cuerpo }) {
  db.prepare(
    `UPDATE noticias_juridicas
     SET titulo = ?, fecha = ?, cuerpo = ?, actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(titulo, fecha, cuerpo, id);
  return buscarNoticiaJuridicaPorId(id);
}

// Devuelve los nombres de archivo VIEJOS para que quien llame los borre de
// disco (ver servidor.js), y dentro de la misma transacción los reemplaza
// por las imágenes nuevas.
export function reemplazarImagenesDeNoticia(id, imagenesNuevas) {
  return ejecutarEnTransaccion(() => {
    const viejas = imagenesDeNoticia(id);
    db.prepare('DELETE FROM noticias_juridicas_imagenes WHERE noticia_id = ?').run(id);

    const insertarImagen = db.prepare(
      'INSERT INTO noticias_juridicas_imagenes (noticia_id, archivo, mime) VALUES (?, ?, ?)'
    );
    for (const imagen of imagenesNuevas) {
      insertarImagen.run(id, imagen.archivo, imagen.mime);
    }

    return viejas;
  });
}

// Devuelve la fila borrada (con sus imágenes) para que quien llame pueda
// borrar también los archivos de disco (ver servidor.js). Las filas de
// noticias_juridicas_imagenes se van solas por el ON DELETE CASCADE.
export function eliminarNoticiaJuridica(id) {
  const noticia = buscarNoticiaJuridicaPorId(id);
  if (!noticia) return null;
  db.prepare('DELETE FROM noticias_juridicas WHERE id = ?').run(id);
  return noticia;
}
