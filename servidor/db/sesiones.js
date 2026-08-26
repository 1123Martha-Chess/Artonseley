// sesiones.js
// -------------------------------------------------------------------
// Sesiones guardadas en base de datos (un token opaco por sesión, no un
// JWT autocontenido): así, si necesitas "desconectar" a alguien de
// inmediato (venció su licencia, la revocas a mano, etc.) basta con
// borrar su fila aquí — con un JWT stateless eso no se puede sin de
// todas formas mantener una lista de revocación en algún lado, así que
// mejor ir directo a la tabla.
// -------------------------------------------------------------------

import crypto from 'node:crypto';
import { db } from './conexion.js';
import { DIAS_DURACION_SESION } from '../config.js';

export function crearSesion(usuarioId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiraEn = new Date(Date.now() + DIAS_DURACION_SESION * 24 * 60 * 60_000).toISOString();

  db.prepare('INSERT INTO sesiones (token, usuario_id, expira_en) VALUES (?, ?, ?)').run(token, usuarioId, expiraEn);

  return { token, expiraEn };
}

// Regresa la sesión solo si existe Y no ha expirado. Si ya expiró, la
// borra de una vez (limpieza perezosa: no hace falta un cron aparte
// para vaciar sesiones viejas).
export function obtenerSesionValida(token) {
  if (!token) return null;

  const sesion = db.prepare('SELECT * FROM sesiones WHERE token = ?').get(token);
  if (!sesion) return null;

  if (new Date(sesion.expira_en) < new Date()) {
    db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
    return null;
  }

  return sesion;
}

export function borrarSesion(token) {
  db.prepare('DELETE FROM sesiones WHERE token = ?').run(token);
}

// Se usa al suspender una cuenta desde el panel de administración: borra
// todas sus sesiones de una vez, así que si esa persona tiene el sitio
// abierto en otra pestaña u otro dispositivo, su próxima petición ya no
// encuentra sesión válida — no hay que esperar a que la cookie expire.
export function borrarSesionesDeUsuario(usuarioId) {
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId);
}
