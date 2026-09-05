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

// Cuenta cuántas sesiones VIVAS (no vencidas) tiene un usuario en este
// momento, sin borrar nada. La usa POST /api/login para decidir si la
// cuenta ya llegó a su límite de dispositivos simultáneos (ver
// LIMITE_SESIONES_POR_DEFECTO / usuarios.limite_sesiones). La comparación
// se hace contra un texto ISO 8601 generado igual que expira_en (con
// new Date().toISOString()), así la comparación de cadenas equivale a
// comparar fechas sin depender de las funciones de fecha de SQLite —
// mismo criterio que ya usa obtenerSesionValida, solo que en SQL en vez
// de en JavaScript, porque aquí conviene contar sin traer las filas.
export function contarSesionesActivasDeUsuario(usuarioId) {
  const fila = db
    .prepare('SELECT COUNT(*) AS total FROM sesiones WHERE usuario_id = ? AND expira_en > ?')
    .get(usuarioId, new Date().toISOString());
  return fila.total;
}

// Se usa al suspender una cuenta desde el panel de administración: borra
// todas sus sesiones de una vez, así que si esa persona tiene el sitio
// abierto en otra pestaña u otro dispositivo, su próxima petición ya no
// encuentra sesión válida — no hay que esperar a que la cookie expire.
export function borrarSesionesDeUsuario(usuarioId) {
  db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').run(usuarioId);
}
