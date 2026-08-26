// notificaciones.js
// -------------------------------------------------------------------
// Reemplaza el arreglo NOTIFICACIONES que antes estaba fijo en
// publico/Sistema/manejaSugerencias.js. Ahora el panel de
// administración puede crear notificaciones y activarlas/desactivarlas
// sin tocar código; el cliente las pide con GET /api/notificaciones
// (ver servidor.js).
// -------------------------------------------------------------------

import { db } from './conexion.js';

// Para el panel 🔔 del sitio principal: solo las activas, más nuevas primero.
export function listarNotificacionesActivas() {
  return db.prepare('SELECT * FROM notificaciones WHERE activa = 1 ORDER BY creado_en DESC').all();
}

// Para el panel de administración: todas, para poder activar/desactivar.
export function listarTodasLasNotificaciones() {
  return db.prepare('SELECT * FROM notificaciones ORDER BY creado_en DESC').all();
}

export function crearNotificacion({ texto, color }) {
  const info = db.prepare('INSERT INTO notificaciones (texto, color) VALUES (?, ?)').run(texto, color || null);
  return db.prepare('SELECT * FROM notificaciones WHERE id = ?').get(info.lastInsertRowid);
}

export function actualizarActivaDeNotificacion(id, activa) {
  db.prepare('UPDATE notificaciones SET activa = ? WHERE id = ?').run(activa ? 1 : 0, id);
}

export function eliminarNotificacion(id) {
  db.prepare('DELETE FROM notificaciones WHERE id = ?').run(id);
}
