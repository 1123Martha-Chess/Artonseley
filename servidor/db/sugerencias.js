// sugerencias.js
// -------------------------------------------------------------------
// El buzón de sugerencias es ANÓNIMO: no se guarda ni se expone qué
// cuenta mandó cada mensaje, ni la urgencia que haya elegido, ni cuándo
// lo mandó (ver el comentario de la tabla "sugerencias" en conexion.js —
// esas columnas siguen ahí sin usarse, nunca se borra una columna en
// este proyecto). "creado_en" es la única excepción: se sigue guardando,
// pero solo para poder calcular las 24 horas (ver
// eliminarSugerenciasVencidas más abajo, y el barrido en servidor.js) —
// nunca se lee de vuelta para mostrárselo al administrador.
// -------------------------------------------------------------------

import { db } from './conexion.js';

export function guardarSugerencia({ mensaje }) {
  db.prepare('INSERT INTO sugerencias (mensaje) VALUES (?)').run(mensaje);
}

// Para el buzón que ve el administrador. Deliberadamente NO incluye
// ningún dato de quién la mandó, ni la urgencia, ni la fecha/hora.
export function listarSugerencias() {
  return db.prepare('SELECT id, mensaje FROM sugerencias ORDER BY id DESC').all();
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
