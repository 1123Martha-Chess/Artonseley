// middleware.js
// -------------------------------------------------------------------
// Middlewares de Express para proteger rutas. Todos parten de la misma
// cookie firmada "sesion" (ver servidor.js, donde se configura
// cookie-parser con el secreto de servidor/config.js).
//
// Hay dos "sabores" de protección por sesión porque una ruta de API y
// una página HTML deben reaccionar distinto cuando no hay sesión:
//   - requiereSesionAPI          -> responde 401 en JSON (lo consume fetch()).
//   - requiereSesionParaPagina   -> redirige a login.html (lo sigue el navegador).
//
// requiereLicenciaVigente y requiereAdmin asumen que ya corrió
// requiereSesionAPI antes (dependen de req.usuario).
// -------------------------------------------------------------------

import { obtenerSesionValida, borrarSesion } from '../db/sesiones.js';
import { buscarUsuarioPorId } from '../db/usuarios.js';

// Además de exigir una sesión válida y no vencida, esto trata una cuenta
// suspendida O eliminada (ambas ponen activo = 0 — ver
// suspenderUsuario/moverUsuarioAPapelera en db/usuarios.js) como si no
// tuviera sesión. Normalmente ya no hace falta: suspender o eliminar
// desde el panel borra sus sesiones de una vez (ver
// borrarSesionesDeUsuario), pero esto es la red de seguridad para
// cualquier otro camino por el que una de esas cuentas quede con una
// sesión todavía viva en la tabla.
//
// Se exporta (no solo se usa aquí adentro) porque GET /api/auth/estado-dispositivo
// en servidor.js también la necesita: a diferencia de requiereSesionAPI,
// esa ruta es pública y debe responder igual haya o no sesión, nunca
// cortar la petición con un 401.
export function obtenerUsuarioDesdeCookie(req) {
  const token = req.signedCookies?.sesion;
  const sesion = obtenerSesionValida(token);
  if (!sesion) return null;

  const usuario = buscarUsuarioPorId(sesion.usuario_id);
  if (!usuario) return null;
  if (!usuario.activo) {
    borrarSesion(token);
    return null;
  }
  return usuario;
}

export function requiereSesionAPI(req, res, next) {
  const usuario = obtenerUsuarioDesdeCookie(req);
  if (!usuario) {
    return res.status(401).json({ error: 'Tu sesión no es válida o ya expiró. Inicia sesión de nuevo.' });
  }
  req.usuario = usuario;
  next();
}

export function requiereSesionParaPagina(req, res, next) {
  const usuario = obtenerUsuarioDesdeCookie(req);
  if (!usuario) {
    return res.redirect('/login.html');
  }
  req.usuario = usuario;
  next();
}

// Para admin.html: sin sesión manda a login.html (igual que cualquier
// otra página); con sesión pero sin rol admin manda al buscador en vez
// de un error crudo, porque "no tienes permiso" como página en blanco
// es peor experiencia que simplemente regresarlo a donde sí puede estar.
export function requiereAdminParaPagina(req, res, next) {
  const usuario = obtenerUsuarioDesdeCookie(req);
  if (!usuario) {
    return res.redirect('/login.html');
  }
  if (usuario.rol !== 'admin') {
    return res.redirect('/index.html');
  }
  req.usuario = usuario;
  next();
}

export function requiereLicenciaVigente(req, res, next) {
  const licenciaVigente = new Date(req.usuario.licencia_vence_en) > new Date();
  if (!licenciaVigente) {
    return res.status(403).json({
      error: `Tu licencia venció el ${new Date(req.usuario.licencia_vence_en).toLocaleDateString('es-MX')}. Contacta al administrador para renovarla.`
    });
  }
  next();
}

export function requiereAdmin(req, res, next) {
  if (req.usuario.rol !== 'admin') {
    return res.status(403).json({ error: 'No tienes permiso para acceder a esto.' });
  }
  next();
}
