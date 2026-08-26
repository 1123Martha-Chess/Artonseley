// servidor.js
// -------------------------------------------------------------------
// Punto de entrada del backend. Hace tres cosas:
//   1) Sirve la carpeta publico/ como sitio estático (HTML, CSS, y el
//      JS del cliente, que es delgado y nunca trae leyes ni lógica de
//      búsqueda). index.html en particular solo se sirve a quien tenga
//      una sesión válida (ver requiereSesionParaPagina más abajo);
//      login.html, crear-cuenta.html, y las páginas informativas (guía,
//      términos, avisos) son públicas.
//   2) Expone la API que usa el cliente para buscar, iniciar/cerrar
//      sesión, y mandar sugerencias. Los datos de leyes y la lógica de
//      búsqueda viven en servidor/ y NUNCA se mandan como archivos
//      descargables al navegador.
//   3) Autentica: sesión por cookie firmada + licencia vigente para
//      poder buscar, y bloqueo temporal tras varios intentos de login
//      fallidos.
//
// Para correrlo (primera vez):
//   npm install
//   npm run migrar-datos                                  (carga las leyes de ejemplo a SQLite)
//   npm run crear-usuario -- tu@correo.com "contraseña" admin 24
//   npm start
// -------------------------------------------------------------------

import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { obtenerDocumentosDisponibles, invalidarCacheDeLeyes } from './servidor/LectorDeJSON.js';
import { procesarBusqueda } from './servidor/procesarBusqueda.js';
import { SECRETO_COOKIES, DIAS_DURACION_SESION, MINUTOS_BLOQUEO_LOGIN, CONFIA_EN_PROXY } from './servidor/config.js';
import {
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  registrarIntentoFallido,
  resetearIntentosFallidos,
  listarUsuarios,
  suspenderUsuario,
  reactivarUsuario,
  moverUsuarioAPapelera,
  restaurarUsuarioDePapelera
} from './servidor/db/usuarios.js';
import { crearSesion, borrarSesion, borrarSesionesDeUsuario } from './servidor/db/sesiones.js';
import { verificarContrasena, hashContrasena } from './servidor/auth/contrasenas.js';
import {
  requiereSesionAPI,
  requiereSesionParaPagina,
  requiereAdminParaPagina,
  requiereLicenciaVigente,
  requiereAdmin,
  obtenerUsuarioDesdeCookie
} from './servidor/auth/middleware.js';
import { guardarSugerencia, listarSugerencias, eliminarSugerencia } from './servidor/db/sugerencias.js';
import {
  guardarSolicitudRegistro,
  listarSolicitudesRegistro,
  eliminarSolicitudRegistro
} from './servidor/db/solicitudesRegistro.js';
import {
  listarDocumentosConConteo,
  buscarDocumentoPorId,
  buscarDocumentoPorNombre,
  crearDocumentoConArticulos,
  reemplazarArticulosDeDocumento,
  eliminarDocumento
} from './servidor/db/documentosLegales.js';
import { validarDocumentoLegal, normalizarArticulos, normalizarTextos } from './servidor/admin/validarDocumentoLegal.js';
import {
  listarNotificacionesActivas,
  listarTodasLasNotificaciones,
  crearNotificacion,
  actualizarActivaDeNotificacion,
  eliminarNotificacion
} from './servidor/db/notificaciones.js';
import {
  listarSectores,
  buscarSectorPorId,
  buscarSectorPorNombre,
  crearSector,
  eliminarSector
} from './servidor/db/sectores.js';
import {
  limitadorLogin,
  limitadorSugerencias,
  limitadorGeneralAPI,
  limitadorSolicitudesRegistro
} from './servidor/seguridad/limitadores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Busca la dirección de la computadora dentro de tu red WiFi (ej. 192.168.1.5),
// que es la que necesita tu celular para poder abrir la página.
function obtenerIPLocal() {
  const interfaces = os.networkInterfaces();
  for (const nombre in interfaces) {
    for (const detalle of interfaces[nombre]) {
      if (detalle.family === 'IPv4' && !detalle.internal) {
        return detalle.address;
      }
    }
  }
  return null;
}

const app = express();
const PUERTO = process.env.PORT || 3000;

// Ver el comentario de CONFIA_EN_PROXY en servidor/config.js: necesario en
// PaaS (Render, Railway, etc.) para que req.ip sea la IP real del visitante
// y no la del proxy del hosting — de eso depende que los límites de
// peticiones por IP (servidor/seguridad/limitadores.js) funcionen bien.
if (CONFIA_EN_PROXY) {
  app.set('trust proxy', 1);
}

// La cookie de sesión (ver fijarCookieDeSesion más abajo) no tiene un
// "domain" explícito, así que queda pegada al host exacto que la puso:
// si el login se hace en artonseley.site (sin "www") esa cookie no sirve
// en www.artonseley.site, y viceversa. Sin este redirect, alguien que
// llega por el host "equivocado" (muy común en celular: autocompletado
// del navegador, un resultado de búsqueda, un enlace compartido) ve el
// login funcionar (POST /api/login responde 200 y pone la cookie) pero
// la redirección a index.html cae en el otro host, que no tiene esa
// cookie — requiereSesionParaPagina lo manda de regreso a login.html
// como si nada hubiera pasado. En escritorio casi no se nota porque la
// URL casi siempre se escribe o se guarda una sola vez, siempre igual.
// Solo aplica con NODE_ENV=production (el mismo interruptor que ya usa
// fijarCookieDeSesion para la cookie "secure"): así nunca afecta al
// localhost ni a la IP de LAN que se usan en desarrollo.
const HOST_CANONICO = 'www.artonseley.site';
if (process.env.NODE_ENV === 'production') {
  app.use((peticion, respuesta, siguiente) => {
    if (peticion.hostname === HOST_CANONICO) {
      return siguiente();
    }
    respuesta.redirect(301, `https://${HOST_CANONICO}${peticion.originalUrl}`);
  });
}

// helmet agrega cabeceras HTTP de seguridad básicas (X-Content-Type-Options,
// X-Frame-Options, Strict-Transport-Security, etc.) con una sola línea.
// Se ajusta un solo punto de su Content-Security-Policy por defecto:
// TODAS las páginas de este sitio usan <style> y algún style="" embebido
// directo en el HTML (es la convención de todo el proyecto, no algo
// aislado), así que se permite explícitamente. Los scripts, en cambio,
// SIEMPRE son archivos externos (<script type="module" src="...">) —
// no hay ni uno inline en ningún .html — así que ahí sí se deja el
// valor por defecto, estricto (script-src 'self'), que es la parte de
// la CSP que de verdad importa contra inyección de código.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'style-src': ["'self'", "'unsafe-inline'"]
    }
  }
}));

// Dos tamaños de límite para el body JSON, según qué tan grande puede
// ser legítimamente cada petición: la mayoría de rutas (login, buscar,
// sugerencias, notificaciones) nunca necesitan más que un puñado de
// campos de texto cortos; solo cargar una ley completa desde el panel
// de administración puede pesar varios megabytes (cientos de artículos
// con su texto). Usar el límite chico como default en vez de uno solo
// generoso para todo evita que una petición pública (sin sesión de
// admin) pueda mandar varios MB de body sin motivo.
const jsonEstandar = express.json({ limit: '50kb' });
const jsonDocumentoLegal = express.json({ limit: '5mb' });

app.use(cookieParser(SECRETO_COOKIES));

// Límite general de peticiones por IP para toda la API (ver
// servidor/seguridad/limitadores.js) — es la red de seguridad de
// fondo; /api/login y /api/sugerencias además tienen su propio límite,
// más estricto, directamente en su ruta.
app.use('/api', limitadorGeneralAPI);

// index.html solo se sirve con sesión activa (si no, redirige al login);
// admin.html además exige rol admin. Van ANTES de express.static para
// interceptar esas rutas específicas; el resto de publico/ (login.html,
// CSS, JS del cliente, páginas informativas) se sigue sirviendo tal
// cual como sitio estático.
app.get(['/', '/index.html'], requiereSesionParaPagina, (peticion, respuesta) => {
  respuesta.sendFile(path.join(__dirname, 'publico', 'index.html'));
});

app.get('/admin.html', requiereAdminParaPagina, (peticion, respuesta) => {
  respuesta.sendFile(path.join(__dirname, 'publico', 'admin.html'));
});

app.use(express.static(path.join(__dirname, 'publico')));

function fijarCookieDeSesion(respuesta, token, expiraEn) {
  respuesta.cookie('sesion', token, {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    expires: new Date(expiraEn)
  });
}

// Login: valida credenciales, cuenta intentos fallidos por usuario y
// bloquea temporalmente tras varios seguidos (ver servidor/config.js
// para el límite y la duración del bloqueo). limitadorLogin además
// frena intentos automatizados por IP (independiente del bloqueo por
// cuenta, que es por usuario).
app.post('/api/login', limitadorLogin, jsonEstandar, (peticion, respuesta) => {
  const { email, contrasena } = peticion.body ?? {};

  if (!email || !contrasena) {
    return respuesta.status(400).json({ error: 'Escribe tu correo y tu contraseña.' });
  }

  // Límite de tamaño explícito en los dos campos: nada legítimo necesita
  // un correo o una contraseña de miles de caracteres, y esto evita
  // mandarle a bcrypt o a la consulta de la base de datos un valor
  // absurdamente largo sin motivo.
  if (String(email).length > 254 || String(contrasena).length > 200) {
    return respuesta.status(400).json({ error: 'Correo o contraseña incorrectos.' });
  }

  // Mismo mensaje sin importar si el correo no existe o la contraseña
  // es incorrecta, para no darle pistas a quien intente adivinar qué
  // correos sí están registrados.
  const credencialesInvalidas = () =>
    respuesta.status(401).json({ error: 'Correo o contraseña incorrectos.' });

  const usuario = buscarUsuarioPorEmail(String(email));
  if (!usuario) return credencialesInvalidas();

  if (usuario.bloqueado_hasta && new Date(usuario.bloqueado_hasta) > new Date()) {
    // toLocaleTimeString('es-MX') ya termina en punto (ej. "11:41 p. m."),
    // así que el mensaje no le agrega otro al final para no verse "p. m..".
    const hora = new Date(usuario.bloqueado_hasta).toLocaleTimeString('es-MX');
    return respuesta.status(429).json({
      error: `Demasiados intentos fallidos. Vuelve a intentar después de las ${hora}`
    });
  }

  // Una cuenta eliminada (mandada a la papelera desde el panel) se
  // revisa antes que la suspensión: aunque las dos ponen activo = 0,
  // el mensaje debe ser el correcto para cada caso.
  if (usuario.eliminado_en) {
    return respuesta.status(403).json({
      error: 'Esta cuenta fue eliminada. Contacta al administrador.'
    });
  }

  // La suspensión (activo = 0) es una decisión explícita del admin,
  // independiente de si la licencia sigue vigente — corta el acceso de
  // inmediato, sin esperar a que venza la licencia.
  if (!usuario.activo) {
    // Igual que con bloqueado_hasta más abajo: toLocaleString('es-MX') ya
    // termina en punto (ej. "12:08 a. m."), así que el mensaje no
    // concatena otro punto justo después para no verse "a. m..".
    const mensajeHasta = usuario.suspendido_hasta
      ? ` hasta el ${new Date(usuario.suspendido_hasta).toLocaleString('es-MX')}`
      : '';
    return respuesta.status(403).json({
      error: `Tu cuenta está suspendida${mensajeHasta} — contacta al administrador.`
    });
  }

  if (!verificarContrasena(String(contrasena), usuario.hash_contrasena)) {
    registrarIntentoFallido(usuario.id, MINUTOS_BLOQUEO_LOGIN);
    return credencialesInvalidas();
  }

  resetearIntentosFallidos(usuario.id);
  const { token, expiraEn } = crearSesion(usuario.id);
  fijarCookieDeSesion(respuesta, token, expiraEn);

  respuesta.json({
    ok: true,
    email: usuario.email,
    rol: usuario.rol,
    licenciaVenceEn: usuario.licencia_vence_en
  });
});

app.post('/api/logout', (peticion, respuesta) => {
  const token = peticion.signedCookies?.sesion;
  if (token) borrarSesion(token);
  respuesta.clearCookie('sesion');
  respuesta.json({ ok: true });
});

// Ruta pública (a propósito, sin requiereSesionAPI): la usan crear-cuenta.html,
// terminos-y-condiciones.html, avisos-de-privacidad.html, guia-de-uso.html
// y cualquier otra página pública para saber, una sola vez al cargar, si
// este navegador ya tiene una sesión iniciada — nunca debe responder 401,
// a diferencia de /api/sesion, que si exige sesión.
app.get('/api/auth/estado-dispositivo', (peticion, respuesta) => {
  const usuario = obtenerUsuarioDesdeCookie(peticion);
  respuesta.json({ cuentaLigada: !!usuario });
});

const MINIMO_CONTRASENA_REGISTRO = 8;
const PATRON_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// El formulario público "Crear Cuenta" (ver crear-cuenta.html) NO crea una
// cuenta en la tabla "usuarios" directamente — deja una solicitud para que
// el administrador la revise y, si corresponde, dé de alta la cuenta real
// a mano con "npm run crear-usuario" (ver el comentario en
// servidor/db/solicitudesRegistro.js sobre por qué se decidió así).
app.post('/api/auth/solicitudes-registro', limitadorSolicitudesRegistro, jsonEstandar, (peticion, respuesta) => {
  const { email, contrasena, aceptoTerminos } = peticion.body ?? {};

  if (!email || !contrasena || aceptoTerminos !== true) {
    return respuesta.status(400).json({
      error: 'Escribe un correo, una contraseña, y acepta los Términos y Condiciones y los Avisos de Privacidad.'
    });
  }

  const emailLimpio = String(email).trim().toLowerCase();

  if (emailLimpio.length > 254 || !PATRON_EMAIL.test(emailLimpio)) {
    return respuesta.status(400).json({ error: 'Escribe un correo electrónico válido.' });
  }
  if (String(contrasena).length < MINIMO_CONTRASENA_REGISTRO || String(contrasena).length > 200) {
    return respuesta.status(400).json({
      error: `La contraseña debe tener al menos ${MINIMO_CONTRASENA_REGISTRO} caracteres.`
    });
  }

  if (buscarUsuarioPorEmail(emailLimpio)) {
    return respuesta.status(409).json({ error: 'Ya existe una cuenta con este correo. Inicia sesión.' });
  }

  guardarSolicitudRegistro({
    email: emailLimpio,
    hashContrasena: hashContrasena(String(contrasena)),
    ip: peticion.ip,
    userAgent: peticion.get('user-agent')
  });

  respuesta.json({ ok: true });
});

// Para que el frontend sepa si ya hay sesión (y el estado de la
// licencia) sin tener que intentar una búsqueda primero.
app.get('/api/sesion', requiereSesionAPI, (peticion, respuesta) => {
  respuesta.json({
    email: peticion.usuario.email,
    rol: peticion.usuario.rol,
    licenciaVenceEn: peticion.usuario.licencia_vence_en,
    licenciaVigente: new Date(peticion.usuario.licencia_vence_en) > new Date()
  });
});

// Lista de documentos disponibles (para pintar los botones de sectores).
// Requiere sesión y licencia vigente, igual que la búsqueda.
app.get('/api/documentos', requiereSesionAPI, requiereLicenciaVigente, async (peticion, respuesta) => {
  try {
    const documentos = await obtenerDocumentosDisponibles();
    respuesta.json({ documentos });
  } catch (error) {
    console.error('Error en /api/documentos:', error);
    respuesta.status(500).json({ error: 'No se pudo obtener la lista de documentos.' });
  }
});

// Búsqueda principal. El cliente manda el texto y los documentos
// seleccionados; el servidor hace todo el trabajo y regresa el
// resultado ya listo para pintar.
app.post('/api/buscar', jsonEstandar, requiereSesionAPI, requiereLicenciaVigente, async (peticion, respuesta) => {
  try {
    const { texto, documentos } = peticion.body ?? {};
    const resultado = await procesarBusqueda(texto, documentos ?? null);
    respuesta.json(resultado);
  } catch (error) {
    console.error('Error en /api/buscar:', error);
    respuesta.status(500).json({ error: 'Ocurrió un error al buscar.' });
  }
});

const LARGO_MAXIMO_SUGERENCIA = 2000;

// Buzón de sugerencias: ahora requiere sesión (ya no es anónimo desde
// que todo el sitio vive detrás de login), y guarda quién la mandó.
// limitadorSugerencias frena a quien intente mandar cientos de forma
// automatizada.
app.post('/api/sugerencias', limitadorSugerencias, jsonEstandar, requiereSesionAPI, (peticion, respuesta) => {
  try {
    const { mensaje, urgencia } = peticion.body ?? {};
    const mensajeLimpio = String(mensaje ?? '').trim();

    if (!mensajeLimpio) {
      return respuesta.status(400).json({ error: 'El mensaje no puede estar vacío.' });
    }
    if (mensajeLimpio.length > LARGO_MAXIMO_SUGERENCIA) {
      return respuesta.status(400).json({
        error: `Tu mensaje es muy largo (máximo ${LARGO_MAXIMO_SUGERENCIA} caracteres).`
      });
    }

    guardarSugerencia({ usuarioId: peticion.usuario.id, mensaje: mensajeLimpio, urgencia });
    respuesta.json({ ok: true });
  } catch (error) {
    console.error('Error en /api/sugerencias:', error);
    respuesta.status(500).json({ error: 'No se pudo guardar la sugerencia.' });
  }
});

// Notificaciones activas para el panel 🔔 del sitio principal. Ya no es
// el arreglo fijo que vivía en manejaSugerencias.js — sale de la tabla
// "notificaciones", que el administrador gestiona desde admin.html.
app.get('/api/notificaciones', requiereSesionAPI, (peticion, respuesta) => {
  respuesta.json({ notificaciones: listarNotificacionesActivas() });
});

// ---------------------------------------------------------------------
// A partir de aquí, todo requiere sesión de administrador. Es el panel
// de administración (Fase 3): cargar/reemplazar/borrar leyes, ver la
// bandeja de sugerencias, ver usuarios y su licencia, y gestionar las
// notificaciones del panel 🔔.
// ---------------------------------------------------------------------
app.use('/api/admin', requiereSesionAPI, requiereAdmin);

// Bandeja de sugerencias: antes vivía en GET /api/sugerencias (ya
// cerrada a admins desde la Fase 2); se mueve aquí para agrupar todo lo
// de administración bajo /api/admin.
app.get('/api/admin/sugerencias', (peticion, respuesta) => {
  respuesta.json({ sugerencias: listarSugerencias() });
});

// La palomita (✓) y la tacha (✗) del panel hacen lo mismo: no importa
// cuál se presione, la sugerencia se borra de la bandeja (ver el
// comentario en servidor/db/sugerencias.js).
app.delete('/api/admin/sugerencias/:id', (peticion, respuesta) => {
  eliminarSugerencia(peticion.params.id);
  respuesta.json({ ok: true });
});

// Bandeja de solicitudes de "Crear Cuenta" (ver POST /api/auth/solicitudes-registro
// arriba): el admin la revisa aquí para verificar el correo contra su
// contacto previo con el cliente y luego dar de alta la cuenta real a
// mano con "npm run crear-usuario". "Descartar" quita la solicitud de la
// bandeja igual que con sugerencias — no hay un estado intermedio que
// conservar.
app.get('/api/admin/solicitudes-registro', (peticion, respuesta) => {
  respuesta.json({ solicitudes: listarSolicitudesRegistro() });
});

app.delete('/api/admin/solicitudes-registro/:id', (peticion, respuesta) => {
  eliminarSolicitudRegistro(peticion.params.id);
  respuesta.json({ ok: true });
});

// Usuarios agrupados en tres listas — activos, suspendidos, eliminados
// (papelera) — para que el panel pinte cada uno en su propio bloque sin
// tener que reclasificarlos en el cliente. "licenciaVigente" se calcula
// al momento de responder, no se guarda como columna, así que nunca
// queda desactualizada aunque nadie la recalcule a propósito.
function usuarioAJSON(usuario) {
  return {
    id: usuario.id,
    email: usuario.email,
    rol: usuario.rol,
    licenciaVenceEn: usuario.licencia_vence_en,
    licenciaVigente: new Date(usuario.licencia_vence_en) > new Date(),
    creadoEn: usuario.creado_en
  };
}

app.get('/api/admin/usuarios', (peticion, respuesta) => {
  const todos = listarUsuarios();

  const activos = todos
    .filter(u => !u.eliminado_en && u.activo)
    .map(usuarioAJSON);

  const suspendidos = todos
    .filter(u => !u.eliminado_en && !u.activo)
    .map(u => ({
      ...usuarioAJSON(u),
      suspendidoHasta: u.suspendido_hasta,
      // Le indica al panel si ya pasó la fecha que el admin puso al
      // suspender, para resaltar "ya se cumplió el tiempo" — pero la
      // cuenta sigue suspendida hasta que alguien la reactive a mano.
      suspensionVencida: !!u.suspendido_hasta && new Date(u.suspendido_hasta) <= new Date()
    }));

  const eliminados = todos
    .filter(u => u.eliminado_en)
    .map(u => ({ ...usuarioAJSON(u), eliminadoEn: u.eliminado_en }));

  respuesta.json({ activos, suspendidos, eliminados });
});

// Suspender una cuenta a mano, por un tiempo que decide el admin (o
// indefinidamente si no manda "hasta"). Se borran de una vez todas sus
// sesiones (ver borrarSesionesDeUsuario) para que el corte de acceso sea
// inmediato y no espere a que su cookie expire. No se deja que un admin
// se suspenda a sí mismo — sería quedarse fuera del panel sin nadie más
// que pueda revertirlo desde ahí.
app.post('/api/admin/usuarios/:id/suspender', jsonEstandar, (peticion, respuesta) => {
  const id = Number(peticion.params.id);
  const { hasta } = peticion.body ?? {};

  if (hasta !== null && hasta !== undefined && Number.isNaN(new Date(hasta).getTime())) {
    return respuesta.status(400).json({ error: 'La fecha de suspensión no es válida.' });
  }

  const usuario = buscarUsuarioPorId(id);
  if (!usuario) {
    return respuesta.status(404).json({ error: 'Ese usuario no existe.' });
  }
  if (usuario.eliminado_en) {
    return respuesta.status(400).json({ error: 'Esta cuenta está en la papelera — restáurala primero si quieres suspenderla.' });
  }
  if (usuario.id === peticion.usuario.id) {
    return respuesta.status(400).json({ error: 'No puedes suspender tu propia cuenta.' });
  }

  suspenderUsuario(id, hasta || null);
  borrarSesionesDeUsuario(id);

  respuesta.json({ ok: true });
});

// Reactivar una cuenta suspendida (por error, o porque ya se cumplió el
// tiempo que se le puso). No se usa para sacar cuentas de la papelera —
// eso es POST /api/admin/usuarios/:id/restaurar, abajo.
app.post('/api/admin/usuarios/:id/reactivar', (peticion, respuesta) => {
  const id = Number(peticion.params.id);
  const usuario = buscarUsuarioPorId(id);
  if (!usuario) {
    return respuesta.status(404).json({ error: 'Ese usuario no existe.' });
  }
  if (usuario.eliminado_en) {
    return respuesta.status(400).json({ error: 'Esta cuenta está en la papelera — usa "Reactivar y reutilizar" para restaurarla.' });
  }

  reactivarUsuario(id);
  respuesta.json({ ok: true });
});

// "Eliminar" manda la cuenta a la papelera: no puede iniciar sesión y
// desaparece de la lista de cuentas activas, pero conserva su correo e
// id para poder restaurarla tal cual si fue un error (ver
// moverUsuarioAPapelera en db/usuarios.js). Mismo resguardo que suspender:
// un admin no puede eliminar su propia cuenta.
app.delete('/api/admin/usuarios/:id', (peticion, respuesta) => {
  const id = Number(peticion.params.id);
  const usuario = buscarUsuarioPorId(id);
  if (!usuario) {
    return respuesta.status(404).json({ error: 'Ese usuario no existe.' });
  }
  if (usuario.id === peticion.usuario.id) {
    return respuesta.status(400).json({ error: 'No puedes eliminar tu propia cuenta.' });
  }

  moverUsuarioAPapelera(id);
  borrarSesionesDeUsuario(id);

  respuesta.json({ ok: true });
});

// Restaurar una cuenta desde la papelera: queda exactamente como una
// cuenta activa normal (sin suspensión pendiente), con el mismo correo e
// id que tenía.
app.post('/api/admin/usuarios/:id/restaurar', (peticion, respuesta) => {
  const id = Number(peticion.params.id);
  const usuario = buscarUsuarioPorId(id);
  if (!usuario) {
    return respuesta.status(404).json({ error: 'Ese usuario no existe.' });
  }
  if (!usuario.eliminado_en) {
    return respuesta.status(400).json({ error: 'Esta cuenta no está en la papelera.' });
  }

  restaurarUsuarioDePapelera(id);
  respuesta.json({ ok: true });
});

// Documentos legales cargados, con cuántos artículos tiene cada uno.
app.get('/api/admin/documentos', (peticion, respuesta) => {
  const documentos = listarDocumentosConConteo().map(doc => ({
    id: doc.id,
    nombre: doc.nombre,
    ultimaReforma: doc.ultima_reforma,
    actualizadoEn: doc.actualizado_en,
    totalArticulos: doc.total_articulos,
    sectorId: doc.sector_id,
    sectorNombre: doc.sector_nombre
  }));
  respuesta.json({ documentos });
});

// Cargar un documento legal nuevo, o reemplazar uno que ya existía (si
// el body trae "documentoIdAReemplazar"). Valida todo ANTES de tocar la
// base de datos: si hay cualquier problema (artículo sin texto, texto
// huérfano, campo faltante...) no se guarda nada y se regresan todos
// los errores encontrados de una vez, para que el administrador los
// corrija todos en un solo intento.
app.post('/api/admin/documentos', jsonDocumentoLegal, (peticion, respuesta) => {
  try {
    const { nombre, ultimaReforma, documentoIdAReemplazar, sectorId, articulos, textos } = peticion.body ?? {};

    const articulosNormalizados = normalizarArticulos(articulos);
    const textosNormalizados = normalizarTextos(textos);
    const nombreLimpio = String(nombre ?? '').trim();

    const errores = validarDocumentoLegal({
      nombre: nombreLimpio,
      articulos: articulosNormalizados,
      textos: textosNormalizados
    });
    if (errores.length > 0) {
      return respuesta.status(400).json({ errores });
    }

    // sectorId es opcional (un documento puede quedar sin sector, y se
    // agrupa en "Otros" del lado del cliente) — pero si mandan uno,
    // tiene que existir de verdad; si no, el FK de la base de datos
    // tronaría con un error 500 poco claro en vez de este 400.
    let sectorIdLimpio = null;
    if (sectorId) {
      const sector = buscarSectorPorId(sectorId);
      if (!sector) {
        return respuesta.status(400).json({ errores: ['El sector seleccionado ya no existe. Recarga la página e inténtalo de nuevo.'] });
      }
      sectorIdLimpio = sector.id;
    }

    const textosPorId = new Map(textosNormalizados.map(t => [String(t.id), t.texto]));

    let documentoId;
    if (documentoIdAReemplazar) {
      const existente = buscarDocumentoPorId(documentoIdAReemplazar);
      if (!existente) {
        return respuesta.status(404).json({ errores: ['El documento que intentas reemplazar ya no existe.'] });
      }
      const otroConEseNombre = buscarDocumentoPorNombre(nombreLimpio);
      if (otroConEseNombre && otroConEseNombre.id !== existente.id) {
        return respuesta.status(409).json({ errores: [`Ya existe otro documento con el nombre "${nombreLimpio}".`] });
      }
      documentoId = reemplazarArticulosDeDocumento(existente.id, {
        nombre: nombreLimpio,
        ultimaReforma,
        sectorId: sectorIdLimpio,
        articulos: articulosNormalizados,
        textosPorId
      });
    } else {
      if (buscarDocumentoPorNombre(nombreLimpio)) {
        return respuesta.status(409).json({
          errores: [`Ya existe un documento con el nombre "${nombreLimpio}". Usa "reemplazar" si quieres actualizarlo.`]
        });
      }
      documentoId = crearDocumentoConArticulos({
        nombre: nombreLimpio,
        ultimaReforma,
        sectorId: sectorIdLimpio,
        articulos: articulosNormalizados,
        textosPorId
      });
    }

    invalidarCacheDeLeyes();
    respuesta.json({ ok: true, documentoId, totalArticulos: articulosNormalizados.length });
  } catch (error) {
    console.error('Error en POST /api/admin/documentos:', error);
    respuesta.status(500).json({ errores: ['Ocurrió un error al guardar el documento.'] });
  }
});

app.delete('/api/admin/documentos/:id', (peticion, respuesta) => {
  try {
    const documento = buscarDocumentoPorId(peticion.params.id);
    if (!documento) {
      return respuesta.status(404).json({ error: 'Ese documento ya no existe.' });
    }
    eliminarDocumento(documento.id);
    invalidarCacheDeLeyes();
    respuesta.json({ ok: true });
  } catch (error) {
    console.error('Error en DELETE /api/admin/documentos/:id:', error);
    respuesta.status(500).json({ error: 'No se pudo eliminar el documento.' });
  }
});

// Sectores (Sector Penal, Sector Fiscal, etc.): agrupan documentos en la
// barra izquierda del buscador (ver publico/Sistema/sistemaDeBotones.js).
// El administrador los crea aquí y luego los asigna a cada documento al
// cargarlo o reemplazarlo (ver POST /api/admin/documentos arriba).
app.get('/api/admin/sectores', (peticion, respuesta) => {
  respuesta.json({ sectores: listarSectores() });
});

const LARGO_MAXIMO_SECTOR = 100;

app.post('/api/admin/sectores', jsonEstandar, (peticion, respuesta) => {
  const nombre = String(peticion.body?.nombre ?? '').trim();
  if (!nombre) {
    return respuesta.status(400).json({ error: 'El nombre del sector no puede estar vacío.' });
  }
  if (nombre.length > LARGO_MAXIMO_SECTOR) {
    return respuesta.status(400).json({ error: `El nombre es muy largo (máximo ${LARGO_MAXIMO_SECTOR} caracteres).` });
  }
  if (buscarSectorPorNombre(nombre)) {
    return respuesta.status(409).json({ error: `Ya existe un sector llamado "${nombre}".` });
  }
  const sector = crearSector(nombre);
  respuesta.json({ ok: true, sector });
});

// Los documentos que tenían este sector no se borran ni se quedan sin
// dueño: el ON DELETE SET NULL de documentos_legales.sector_id hace que
// simplemente pasen a agruparse en "Otros" (ver sistemaDeBotones.js).
app.delete('/api/admin/sectores/:id', (peticion, respuesta) => {
  eliminarSector(peticion.params.id);
  respuesta.json({ ok: true });
});

// Notificaciones del panel 🔔: listar todas (activas e inactivas, para
// poder alternarlas), crear una nueva, activar/desactivar una existente,
// y eliminarla para siempre.
app.get('/api/admin/notificaciones', (peticion, respuesta) => {
  respuesta.json({ notificaciones: listarTodasLasNotificaciones() });
});

const LARGO_MAXIMO_NOTIFICACION = 300;

app.post('/api/admin/notificaciones', jsonEstandar, (peticion, respuesta) => {
  const texto = String(peticion.body?.texto ?? '').trim();
  if (!texto) {
    return respuesta.status(400).json({ error: 'El texto de la notificación no puede estar vacío.' });
  }
  if (texto.length > LARGO_MAXIMO_NOTIFICACION) {
    return respuesta.status(400).json({
      error: `El texto es muy largo (máximo ${LARGO_MAXIMO_NOTIFICACION} caracteres).`
    });
  }
  const notificacion = crearNotificacion({ texto, color: peticion.body?.color });
  respuesta.json({ ok: true, notificacion });
});

app.patch('/api/admin/notificaciones/:id', jsonEstandar, (peticion, respuesta) => {
  actualizarActivaDeNotificacion(peticion.params.id, Boolean(peticion.body?.activa));
  respuesta.json({ ok: true });
});

app.delete('/api/admin/notificaciones/:id', (peticion, respuesta) => {
  eliminarNotificacion(peticion.params.id);
  respuesta.json({ ok: true });
});

app.listen(PUERTO, '0.0.0.0', () => {
  const ipLocal = obtenerIPLocal();
  console.log('El sistema está corriendo:');
  console.log(`  - En esta computadora: http://localhost:${PUERTO}`);
  if (ipLocal) {
    console.log(`  - Desde tu celular (mismo WiFi que esta compu): http://${ipLocal}:${PUERTO}`);
  }
  console.log(`  - Duración de sesión: ${DIAS_DURACION_SESION} días.`);
});
