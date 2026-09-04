// canciones.js
// -------------------------------------------------------------------
// Acceso a la tabla "canciones" del apartado "Música" (ver conexion.js).
// Aquí solo se guardan los metadatos; los archivos de audio e imagen los
// maneja servidor/musicaArchivos.js. El administrador sube/borra/ordena
// canciones desde el panel (rutas /api/admin/canciones en servidor.js) y
// el reproductor las pide con GET /api/canciones.
// -------------------------------------------------------------------

import { db, ejecutarEnTransaccion } from './conexion.js';

// Para el reproductor y el panel: todas, en el orden que definió el admin
// (y como desempate, las más viejas primero).
export function listarCanciones() {
  return db.prepare('SELECT * FROM canciones ORDER BY orden ASC, id ASC').all();
}

export function buscarCancionPorId(id) {
  return db.prepare('SELECT * FROM canciones WHERE id = ?').get(id);
}

// "orden" arranca al final de la lista (máximo actual + 1), así una canción
// nueva aparece hasta abajo hasta que el admin la mueva.
export function crearCancion({ titulo, archivoAudio, mimeAudio, archivoImagen, mimeImagen }) {
  const { maximo } = db.prepare('SELECT COALESCE(MAX(orden), 0) AS maximo FROM canciones').get();
  const info = db
    .prepare(
      `INSERT INTO canciones (titulo, archivo_audio, mime_audio, archivo_imagen, mime_imagen, orden)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(titulo, archivoAudio, mimeAudio, archivoImagen || null, mimeImagen || null, maximo + 1);
  return db.prepare('SELECT * FROM canciones WHERE id = ?').get(info.lastInsertRowid);
}

export function renombrarCancion(id, titulo) {
  db.prepare('UPDATE canciones SET titulo = ? WHERE id = ?').run(titulo, id);
}

// Sube o baja una canción una posición, intercambiando el "orden" con su
// vecina. direccion: 'subir' (más arriba en la lista) o 'bajar'.
export function moverCancion(id, direccion) {
  const actual = buscarCancionPorId(id);
  if (!actual) return;

  const vecina =
    direccion === 'subir'
      ? db.prepare('SELECT * FROM canciones WHERE orden < ? OR (orden = ? AND id < ?) ORDER BY orden DESC, id DESC LIMIT 1').get(actual.orden, actual.orden, id)
      : db.prepare('SELECT * FROM canciones WHERE orden > ? OR (orden = ? AND id > ?) ORDER BY orden ASC, id ASC LIMIT 1').get(actual.orden, actual.orden, id);

  if (!vecina) return; // ya está en el extremo

  ejecutarEnTransaccion(() => {
    db.prepare('UPDATE canciones SET orden = ? WHERE id = ?').run(vecina.orden, actual.id);
    db.prepare('UPDATE canciones SET orden = ? WHERE id = ?').run(actual.orden, vecina.id);
  });
}

// Devuelve la fila borrada para que quien llame pueda borrar también sus
// archivos de disco (ver servidor.js).
export function eliminarCancion(id) {
  const fila = buscarCancionPorId(id);
  if (!fila) return null;
  db.prepare('DELETE FROM canciones WHERE id = ?').run(id);
  return fila;
}
