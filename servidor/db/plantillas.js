// plantillas.js
// -------------------------------------------------------------------
// Acceso a la tabla "plantillas" (ver conexion.js): la biblioteca de
// machotes del Generador de Plantillas y Documentos. Aquí solo vive el
// TEXTO de la plantilla; los datos con que se llena (cliente, expediente)
// nunca tocan el servidor.
//
// El administrador la gestiona desde el panel (rutas /api/admin/plantillas
// en servidor.js). El abogado la consume con GET /api/plantillas[/:id].
// -------------------------------------------------------------------

import { db } from './conexion.js';

// Para la barra lateral del abogado: sin el cuerpo, agrupadas por categoría.
export function listarPlantillas() {
  return db
    .prepare('SELECT id, categoria, titulo FROM plantillas ORDER BY categoria COLLATE NOCASE, titulo COLLATE NOCASE')
    .all();
}

// Para el panel de administración: todo.
export function listarPlantillasParaAdmin() {
  return db
    .prepare('SELECT id, categoria, titulo, cuerpo, version, actualizado_en FROM plantillas ORDER BY categoria COLLATE NOCASE, titulo COLLATE NOCASE')
    .all();
}

export function buscarPlantillaPorId(id) {
  return db.prepare('SELECT * FROM plantillas WHERE id = ?').get(id);
}

export function crearPlantilla({ categoria, titulo, cuerpo }) {
  const info = db
    .prepare('INSERT INTO plantillas (categoria, titulo, cuerpo) VALUES (?, ?, ?)')
    .run(categoria, titulo, cuerpo);
  return buscarPlantillaPorId(info.lastInsertRowid);
}

export function actualizarPlantilla(id, { categoria, titulo, cuerpo }) {
  db.prepare(
    `UPDATE plantillas
       SET categoria = ?, titulo = ?, cuerpo = ?,
           version = version + 1,
           actualizado_en = datetime('now')
     WHERE id = ?`
  ).run(categoria, titulo, cuerpo, id);
  return buscarPlantillaPorId(id);
}

export function eliminarPlantilla(id) {
  db.prepare('DELETE FROM plantillas WHERE id = ?').run(id);
}
