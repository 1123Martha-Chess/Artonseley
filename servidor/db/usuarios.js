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
    SELECT id, email, rol, licencia_vence_en, licencia_vitalicia, activo, suspendido_hasta, eliminado_en,
           limite_sesiones, plan, despacho_id, despacho_puesto, encuestas_canjeadas, modalidad_desde, creado_en
    FROM usuarios
    ORDER BY creado_en DESC
  `).all();
}

// licenciaVenceEn debe venir ya como fecha ISO (ver servidor/scripts/crearUsuario.js,
// que es quien decide si esa fecha sale de "hoy + N meses" o de una fecha exacta).
// licenciaVitalicia (Plan Fundador, acceso de por vida): cuando es true, la
// cuenta NUNCA se trata como vencida sin importar lo que diga
// licencia_vence_en (ver requiereLicenciaVigente en servidor/auth/middleware.js)
// — licencia_vence_en de cualquier forma se guarda con un valor lejano, solo
// como respaldo para cualquier código que llegara a comparar fechas sin
// revisar primero la bandera.
const FECHA_LEJANA_VITALICIA = '2200-01-01T00:00:00.000Z';

export function crearUsuario({ email, hashContrasena, rol = 'abogado', licenciaVenceEn, licenciaVitalicia = false }) {
  const info = db.prepare(`
    INSERT INTO usuarios (email, hash_contrasena, rol, licencia_vence_en, licencia_vitalicia)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    normalizarEmail(email),
    hashContrasena,
    rol,
    licenciaVitalicia ? FECHA_LEJANA_VITALICIA : licenciaVenceEn,
    licenciaVitalicia ? 1 : 0
  );

  return buscarUsuarioPorId(info.lastInsertRowid);
}

export function actualizarLicencia(usuarioId, { licenciaVenceEn, licenciaVitalicia = false }) {
  db.prepare('UPDATE usuarios SET licencia_vence_en = ?, licencia_vitalicia = ? WHERE id = ?').run(
    licenciaVitalicia ? FECHA_LEJANA_VITALICIA : licenciaVenceEn,
    licenciaVitalicia ? 1 : 0,
    usuarioId
  );
}

// Para "cambiar contraseña" desde el panel o desde la terminal (ver
// servidor/scripts/cambiarContrasena.js): repone la contraseña de una
// cuenta YA EXISTENTE — a diferencia de crearUsuario, no toca nada más
// (rol, licencia, etc.). Es el mecanismo real de recuperación de acceso
// hoy: el Titular avisa por correo/WhatsApp que perdió su contraseña, el
// Responsable verifica que es él y le repone una nueva a mano.
export function actualizarContrasena(usuarioId, hashContrasena) {
  db.prepare('UPDATE usuarios SET hash_contrasena = ? WHERE id = ?').run(hashContrasena, usuarioId);
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

// Borrado DEFINITIVO, solo desde la papelera (ver el resguardo en
// servidor.js: exige eliminado_en). A diferencia de moverUsuarioAPapelera,
// esto sí quita la fila por completo — no se puede deshacer — y libera el
// correo para que se pueda volver a registrar una cuenta nueva con él
// (email es UNIQUE, así que mientras la fila siga ahí, aunque esté en la
// papelera, ese correo sigue "ocupado"). Las tablas con clave foránea a
// usuarios (sesiones, suscripciones_push, encuestas_respuestas, …) tienen
// ON DELETE CASCADE / SET NULL en su esquema (ver conexion.js), así que
// esto también se lleva sus filas relacionadas.
export function eliminarUsuarioDefinitivamente(usuarioId) {
  db.prepare('DELETE FROM usuarios WHERE id = ?').run(usuarioId);
}

// Límite de sesiones simultáneas que el admin fija a mano para ESTA
// cuenta (ver POST /api/admin/usuarios/:id/limite-sesiones en
// servidor.js). "limite" en null vuelve a dejar la cuenta en el valor
// por defecto (LIMITE_SESIONES_POR_DEFECTO, ver servidor/config.js).
// Quien llama a esto también debe borrar las sesiones activas del
// usuario (ver borrarSesionesDeUsuario en sesiones.js), tal como pidió
// el dueño: cambiar este número deja la cuenta en un estado limpio y
// conocido en vez de arrastrar sesiones que ya contaban contra el límite
// anterior.
export function fijarLimiteSesiones(usuarioId, limite) {
  db.prepare('UPDATE usuarios SET limite_sesiones = ? WHERE id = ?').run(limite, usuarioId);
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
