// suscripcionesPush.js
// -------------------------------------------------------------------
// Acceso a la tabla "suscripciones_push" (ver conexion.js): las
// suscripciones Web Push de "Recordatorios del calendario".
//
// Aquí NO hay nada del calendario: solo el endpoint + claves que el
// protocolo Web Push necesita para entregarle un "ping" diario al
// navegador de cada dispositivo donde el usuario activó los recordatorios.
// El aviso lo arma el navegador (texto fijo, sin contenido).
// -------------------------------------------------------------------

import { db } from './conexion.js';

// Alta o actualización por endpoint: el navegador puede renovar la
// suscripción (mismo endpoint, claves nuevas) o el usuario puede cambiar
// de huso horario — en ambos casos se sobrescribe la fila y se reinicia
// "ultimo_envio" para que el siguiente barrido la considere de nuevo.
export function guardarSuscripcion({ usuarioId, endpoint, p256dh, auth, offsetMinutos }) {
  db.prepare(
    `INSERT INTO suscripciones_push (usuario_id, endpoint, p256dh, auth, offset_minutos, ultimo_envio)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT(endpoint) DO UPDATE SET
       usuario_id = excluded.usuario_id,
       p256dh = excluded.p256dh,
       auth = excluded.auth,
       offset_minutos = excluded.offset_minutos,
       ultimo_envio = NULL`
  ).run(usuarioId, endpoint, p256dh, auth, offsetMinutos);
}

export function eliminarSuscripcionPorEndpoint(endpoint) {
  db.prepare('DELETE FROM suscripciones_push WHERE endpoint = ?').run(endpoint);
}

export function listarSuscripciones() {
  return db.prepare('SELECT * FROM suscripciones_push').all();
}

export function marcarEnviada(id, fechaLocal) {
  db.prepare('UPDATE suscripciones_push SET ultimo_envio = ? WHERE id = ?').run(fechaLocal, id);
}
