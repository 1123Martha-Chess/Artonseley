// sugerencias.js
// -------------------------------------------------------------------
// Reemplaza al viejo servidor/datos/sugerencias.json (leer todo el
// archivo, agregarle una línea, y volver a guardarlo completo). Ahora
// cada sugerencia es una fila, y guardamos también quién la mandó
// (usuario_id) ya que /api/sugerencias ahora vive detrás de sesión.
// -------------------------------------------------------------------

import { db } from './conexion.js';

export function guardarSugerencia({ usuarioId = null, mensaje, urgencia }) {
  db.prepare('INSERT INTO sugerencias (usuario_id, mensaje, urgencia) VALUES (?, ?, ?)')
    .run(usuarioId, mensaje, urgencia || 'No especificada');
}

// Para el buzón que verá el administrador (panel de administración,
// Fase 3). Por ahora esto ya queda protegido detrás de GET /api/sugerencias
// (ver servidor.js), solo que sin una pantalla dedicada todavía.
export function listarSugerencias() {
  return db.prepare(`
    SELECT sugerencias.id, sugerencias.mensaje, sugerencias.urgencia, sugerencias.creado_en,
           usuarios.email AS usuario_email
    FROM sugerencias
    LEFT JOIN usuarios ON usuarios.id = sugerencias.usuario_id
    ORDER BY sugerencias.creado_en DESC
  `).all();
}

// El botón de "atendida" (palomita) y el de "descartar" (tacha) en el
// panel de administración hacen exactamente lo mismo: no hay un estado
// de "atendida/descartada" que conservar, la sugerencia ya cumplió su
// propósito en cuanto el administrador la vio, así que ambos botones
// simplemente la borran de la bandeja.
export function eliminarSugerencia(id) {
  db.prepare('DELETE FROM sugerencias WHERE id = ?').run(id);
}
