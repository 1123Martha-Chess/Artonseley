// informacionOficial.js
// -------------------------------------------------------------------
// Acceso a "informacion_oficial" (una sola fila, id = 1, con el texto de
// presentación) e "informacion_oficial_enlaces" (las dos listas fijas:
// cuentas oficiales y fuentes oficiales/DOF) — ver conexion.js. El
// administrador mantiene todo esto desde el panel (rutas
// /api/admin/informacion-oficial en servidor.js); la página pública
// "informacion-oficial.html" lo lee sin sesión con GET
// /api/informacion-oficial.
// -------------------------------------------------------------------

import { db, ejecutarEnTransaccion } from './conexion.js';

export function obtenerDescripcionOficial() {
  const fila = db.prepare('SELECT descripcion, actualizado_en FROM informacion_oficial WHERE id = 1').get();
  return { descripcion: fila?.descripcion ?? '', actualizadoEn: fila?.actualizado_en ?? null };
}

export function guardarDescripcionOficial(descripcion) {
  db.prepare(
    `UPDATE informacion_oficial SET descripcion = ?, actualizado_en = datetime('now') WHERE id = 1`
  ).run(descripcion);
  return obtenerDescripcionOficial();
}

export function listarEnlacesOficialesPorCategoria(categoria) {
  return db
    .prepare('SELECT * FROM informacion_oficial_enlaces WHERE categoria = ? ORDER BY orden ASC, id ASC')
    .all(categoria);
}

export function buscarEnlaceOficialPorId(id) {
  return db.prepare('SELECT * FROM informacion_oficial_enlaces WHERE id = ?').get(id);
}

// "orden" arranca al final de su categoría (máximo actual + 1 dentro de
// esa categoría), igual que crearCancion en canciones.js.
export function crearEnlaceOficial({ categoria, etiqueta, url }) {
  const { maximo } = db
    .prepare('SELECT COALESCE(MAX(orden), 0) AS maximo FROM informacion_oficial_enlaces WHERE categoria = ?')
    .get(categoria);
  const info = db
    .prepare('INSERT INTO informacion_oficial_enlaces (categoria, etiqueta, url, orden) VALUES (?, ?, ?, ?)')
    .run(categoria, etiqueta, url, maximo + 1);
  return buscarEnlaceOficialPorId(info.lastInsertRowid);
}

export function editarEnlaceOficial(id, { etiqueta, url }) {
  db.prepare('UPDATE informacion_oficial_enlaces SET etiqueta = ?, url = ? WHERE id = ?').run(etiqueta, url, id);
  return buscarEnlaceOficialPorId(id);
}

// Sube o baja un enlace una posición DENTRO de su misma categoría,
// intercambiando "orden" con su vecina — mismo mecanismo que
// moverCancion en canciones.js.
export function moverEnlaceOficial(id, direccion) {
  const actual = buscarEnlaceOficialPorId(id);
  if (!actual) return;

  const vecina =
    direccion === 'subir'
      ? db
          .prepare(
            `SELECT * FROM informacion_oficial_enlaces
             WHERE categoria = ? AND (orden < ? OR (orden = ? AND id < ?))
             ORDER BY orden DESC, id DESC LIMIT 1`
          )
          .get(actual.categoria, actual.orden, actual.orden, id)
      : db
          .prepare(
            `SELECT * FROM informacion_oficial_enlaces
             WHERE categoria = ? AND (orden > ? OR (orden = ? AND id > ?))
             ORDER BY orden ASC, id ASC LIMIT 1`
          )
          .get(actual.categoria, actual.orden, actual.orden, id);

  if (!vecina) return; // ya está en el extremo

  ejecutarEnTransaccion(() => {
    db.prepare('UPDATE informacion_oficial_enlaces SET orden = ? WHERE id = ?').run(vecina.orden, actual.id);
    db.prepare('UPDATE informacion_oficial_enlaces SET orden = ? WHERE id = ?').run(actual.orden, vecina.id);
  });
}

export function eliminarEnlaceOficial(id) {
  db.prepare('DELETE FROM informacion_oficial_enlaces WHERE id = ?').run(id);
}
