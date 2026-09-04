// usuarios.js
// -------------------------------------------------------------------
// Todas las consultas de la tabla "usuarios" en un solo lugar: crear
// usuarios, buscarlos para el login, y llevar la cuenta de intentos
// fallidos para el bloqueo temporal contra fuerza bruta.
// -------------------------------------------------------------------

import { db } from './conexion.js';
import { LIMITE_INTENTOS_LOGIN } from '../config.js';

function normalizarEmail(email) {
  return String(email).toLowerCase().trim();
}

export function buscarUsuarioPorEmail(email) {
  return db.prepare('SELECT * FROM usuarios WHERE email = ?').get(normalizarEmail(email));
}

export function buscarUsuarioPorId(id) {
  return db.prepare('SELECT * FROM usuarios WHERE id = ?').get(id);
}

export function listarUsuarios() {
  return db.prepare(`
    SELECT id, email, rol, licencia_vence_en, activo, suspendido_hasta, eliminado_en, creado_en
    FROM usuarios
    ORDER BY creado_en DESC
  `).all();
}

// licenciaVenceEn debe venir ya como fecha ISO (ver servidor/scripts/crearUsuario.js,
// que es quien decide si esa fecha sale de "hoy + N meses" o de una fecha exacta).
export function crearUsuario({ email, hashContrasena, rol = 'abogado', licenciaVenceEn }) {
  const info = db.prepare(`
    INSERT INTO usuarios (email, hash_contrasena, rol, licencia_vence_en)
    VALUES (?, ?, ?, ?)
  `).run(normalizarEmail(email), hashContrasena, rol, licenciaVenceEn);

  return buscarUsuarioPorId(info.lastInsertRowid);
}

export function actualizarLicencia(usuarioId, licenciaVenceEn) {
  db.prepare('UPDATE usuarios SET licencia_vence_en = ? WHERE id = ?').run(licenciaVenceEn, usuarioId);
}

// Apodo opcional que el usuario elige en "Mi cuenta" (ver configuracion.html):
// solo sirve para el saludo de la pantalla de inicio. Un valor vacío o solo
// con espacios se guarda como NULL, para que el saludo vuelva a mostrar el
// texto literal "[user]".
export function actualizarNombre(usuarioId, nombre) {
  const limpio = String(nombre ?? '').trim();
  db.prepare('UPDATE usuarios SET nombre = ? WHERE id = ?').run(limpio || null, usuarioId);
}

// Suspender/reactivar es independiente de la licencia: sirve para
// cortarle el acceso a alguien de inmediato (ej. dejó de pagar antes de
// que venza su licencia, o hay que investigar algo) sin tener que tocar
// su fecha de vencimiento. "suspendidoHasta" es opcional (fecha ISO):
// si se manda, es solo informativa para que el admin sepa cuándo revisar
// la cuenta — la suspensión NO se levanta sola al llegar esa fecha, hay
// que reactivarla a mano desde el panel (ver el bloque de "Cuentas
// suspendidas" en admin.html), como medida extra contra descuidos.
// Quien llama a esto también debe borrar las sesiones activas del
// usuario (ver borrarSesionesDeUsuario en sesiones.js) para que la
// suspensión surta efecto de inmediato y no hasta que expire su cookie.
export function suspenderUsuario(usuarioId, suspendidoHasta) {
  db.prepare('UPDATE usuarios SET activo = 0, suspendido_hasta = ? WHERE id = ?').run(suspendidoHasta, usuarioId);
}

export function reactivarUsuario(usuarioId) {
  db.prepare('UPDATE usuarios SET activo = 1, suspendido_hasta = NULL WHERE id = ?').run(usuarioId);
}

// "Eliminar" una cuenta no borra la fila: la marca con eliminado_en y le
// corta el acceso, pero conserva todo (id, correo, licencia) para poder
// recuperarla desde la papelera del panel si fue un error. Un borrado de
// verdad (que sí quitara el correo y el id) no se podría deshacer, y el
// panel necesita poder deshacerlo — ver el bloque de "Cuentas eliminadas
// (papelera)" en admin.html.
export function moverUsuarioAPapelera(usuarioId) {
  db.prepare("UPDATE usuarios SET activo = 0, eliminado_en = datetime('now') WHERE id = ?").run(usuarioId);
}

export function restaurarUsuarioDePapelera(usuarioId) {
  db.prepare('UPDATE usuarios SET activo = 1, suspendido_hasta = NULL, eliminado_en = NULL WHERE id = ?').run(usuarioId);
}

// Se llama cuando la contraseña escrita en el login NO es correcta.
// A partir de LIMITE_INTENTOS_LOGIN intentos seguidos, bloquea la
// cuenta por MINUTOS_BLOQUEO_LOGIN minutos (ver servidor/config.js).
export function registrarIntentoFallido(usuarioId, minutosBloqueo) {
  const usuario = buscarUsuarioPorId(usuarioId);
  const intentos = usuario.intentos_fallidos + 1;
  const bloqueadoHasta = intentos >= LIMITE_INTENTOS_LOGIN
    ? new Date(Date.now() + minutosBloqueo * 60_000).toISOString()
    : usuario.bloqueado_hasta;

  db.prepare('UPDATE usuarios SET intentos_fallidos = ?, bloqueado_hasta = ? WHERE id = ?')
    .run(intentos, bloqueadoHasta, usuarioId);
}

// Se llama cuando el login SÍ fue exitoso, para que intentos viejos no
// se vayan acumulando de una sesión a otra.
export function resetearIntentosFallidos(usuarioId) {
  db.prepare('UPDATE usuarios SET intentos_fallidos = 0, bloqueado_hasta = NULL WHERE id = ?').run(usuarioId);
}
