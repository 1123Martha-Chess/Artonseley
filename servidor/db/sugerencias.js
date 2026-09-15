// sugerencias.js
// -------------------------------------------------------------------
// El buzón de sugerencias es ANÓNIMO: no se guarda ni se expone qué
// cuenta mandó cada mensaje (ver el comentario de la tabla "sugerencias"
// en conexion.js — la columna usuario_id sigue ahí sin usarse, nunca se
// borra una columna en este proyecto). Además cada sugerencia se borra
// sola a las 24 horas de mandarse, la haya revisado el administrador o
// no (ver eliminarSugerenciasVencidas, y el barrido en servidor.js).
// -------------------------------------------------------------------

import { db } from './conexion.js';

export function guardarSugerencia({ mensaje, urgencia }) {
  db.prepare('INSERT INTO sugerencias (mensaje, urgencia) VALUES (?, ?)')
    .run(mensaje, urgencia || 'No especificada');
}

// Para el buzón que ve el administrador. Deliberadamente NO incluye
// ningún dato de quién la mandó.
export function listarSugerencias() {
  return db.prepare('SELECT id, mensaje, urgencia, creado_en FROM sugerencias ORDER BY creado_en DESC').all();
}

// El botón de "atendida" (palomita) y el de "descartar" (tacha) en el
// panel de administración hacen exactamente lo mismo: no hay un estado
// de "atendida/descartada" que conservar, la sugerencia ya cumplió su
// propósito en cuanto el administrador la vio, así que ambos botones
// simplemente la borran de la bandeja.
export function eliminarSugerencia(id) {
  db.prepare('DELETE FROM sugerencias WHERE id = ?').run(id);
}

// Red de seguridad de privacidad: aunque el administrador nunca la haya
// revisado (ni le haya dado ✓ ni ✗), ninguna sugerencia sobrevive más de
// 24 horas. Se corre en un barrido periódico (ver servidor.js).
export function eliminarSugerenciasVencidas() {
  const info = db.prepare(`DELETE FROM sugerencias WHERE creado_en <= datetime('now', '-24 hours')`).run();
  return info.changes;
}
