// solicitudesRegistro.js
// -------------------------------------------------------------------
// Bandeja de solicitudes de "Crear Cuenta" (mismo patrón que
// sugerencias.js): el formulario público no crea una cuenta en
// "usuarios" directamente, solo deja aquí el correo, el hash de la
// contraseña elegida y la constancia de que aceptó términos/avisos.
// El administrador la revisa desde admin.html y, si corresponde, da de
// alta la cuenta real a mano con "npm run crear-usuario".
// -------------------------------------------------------------------

import { db } from './conexion.js';

export function guardarSolicitudRegistro({ email, hashContrasena, ip, userAgent }) {
  db.prepare(`
    INSERT INTO solicitudes_registro (email, hash_contrasena, ip, user_agent)
    VALUES (?, ?, ?, ?)
  `).run(email, hashContrasena, ip || null, userAgent || null);
}

// hash_contrasena NUNCA se selecciona aquí: esta lista alimenta el panel
// de administración, y no hay motivo para que ese hash viaje por la API,
// ni siquiera hacia un admin autenticado.
export function listarSolicitudesRegistro() {
  return db.prepare(`
    SELECT id, email, acepto_terminos_en, ip, user_agent, creado_en
    FROM solicitudes_registro
    ORDER BY creado_en DESC
  `).all();
}

// Se llama una vez que el admin ya dio de alta (o rechazó) la solicitud,
// para quitarla de la bandeja — no hay un estado "atendida" que
// conservar, igual que con las sugerencias.
export function eliminarSolicitudRegistro(id) {
  db.prepare('DELETE FROM solicitudes_registro WHERE id = ?').run(id);
}
