// sectores.js
// -------------------------------------------------------------------
// Antes los "sectores" (Sector Penal, Sector Fiscal, etc.) eran un
// objeto SECTORES fijo dentro de publico/Sistema/sistemaDeBotones.js,
// así que agregar uno nuevo significaba editar código. Ahora viven en
// esta tabla y el panel de administración puede crearlos/borrarlos sin
// tocar nada; cada documento legal guarda el id del sector al que
// pertenece (columna sector_id en documentos_legales, ver conexion.js).
// Un documento sin sector asignado se sigue agrupando bajo "Otros" del
// lado del cliente (ver sistemaDeBotones.js), igual que antes.
// -------------------------------------------------------------------

import { db } from './conexion.js';

export function listarSectores() {
  return db.prepare('SELECT * FROM sectores ORDER BY nombre').all();
}

export function buscarSectorPorId(id) {
  return db.prepare('SELECT * FROM sectores WHERE id = ?').get(id);
}

export function buscarSectorPorNombre(nombre) {
  return db.prepare('SELECT * FROM sectores WHERE nombre = ?').get(nombre);
}

export function crearSector(nombre) {
  const info = db.prepare('INSERT INTO sectores (nombre) VALUES (?)').run(nombre);
  return db.prepare('SELECT * FROM sectores WHERE id = ?').get(info.lastInsertRowid);
}

// ON DELETE SET NULL en documentos_legales.sector_id se encarga de que
// los documentos que tenían este sector no se queden huérfanos: solo
// pasan a no tener sector (se agrupan en "Otros" del lado del cliente).
export function eliminarSector(id) {
  db.prepare('DELETE FROM sectores WHERE id = ?').run(id);
}
