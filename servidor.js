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
import { SECRETO_COOKIES, DIAS_DURACION_SESION, MINUTOS_BLOQUEO_LOGIN, CONFIA_EN_PROXY, VAPID_PUBLICA, TOKEN_TAREAS } from './servidor/config.js';
import {
  buscarUsuarioPorEmail,
  buscarUsuarioPorId,
  crearUsuario,
  actualizarLicencia,
  actualizarNombre,
  registrarIntentoFallido,
  resetearIntentosFallidos,
  listarUsuarios,
  suspenderUsuario,
  reactivarUsuario,
  moverUsuarioAPapelera,
  restaurarUsuarioDePapelera
} from './servidor/db/usuarios.js';
import { calcularVigenciaLicencia } from './servidor/calcularVigenciaLicencia.js';
import { manejarPaginaLegal } from './servidor/paginasLegales.js';
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
  buscarSolicitudRegistroPorId,
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
  listarCanciones,
  buscarCancionPorId,
  crearCancion,
  renombrarCancion,
  moverCancion,
  eliminarCancion
} from './servidor/db/canciones.js';
import {
  subidaDeCancion,
  rutaArchivoMusica,
  borrarArchivoDeMusica,
  LIMITE_IMAGEN_BYTES
} from './servidor/musicaArchivos.js';
import {
  guardarSuscripcion,
  eliminarSuscripcionPorEndpoint
} from './servidor/db/suscripcionesPush.js';
import { configurarWebPush, barrerYEnviar } from './servidor/recordatoriosCalendario.js';
import {
  CALCULADORAS,
  obtenerIndicesEconomicos,
  indicesEconomicosListos
} from './servidor/calculadoras/registro.js';
import { guardarIndicesEconomicos } from './servidor/db/indicesEconomicos.js';
import {
  listarPlantillas,
  listarPlantillasParaAdmin,
  buscarPlantillaPorId,
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla
} from './servidor/db/plantillas.js';
import { extraerVariables } from './servidor/plantillas/extraerVariables.js';
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
      'style-src': ["'self'", "'unsafe-inline'"],
      // El Service Worker de los recordatorios (publico/sw.js) y el
      // manifest se sirven del mismo origen. Se declaran explícitos porque
      // algunos navegadores exigen worker-src/manifest-src aparte de
      // default-src, aunque el valor sea el mismo ('self').
      'worker-src': ["'self'"],
      'manifest-src': ["'self'"]
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

// index.html dejó de ser el buscador: ahora es la pantalla de inicio
// (las "burbujas" de acceso). El buscador, las notificaciones, el buzón
// de sugerencias y la configuración pasaron a ser páginas completas
// propias, cada una con su enlace "← Volver al inicio". Todas piden
// sesión igual que index.html (no rol admin).
app.get(
  ['/buscador.html', '/notificaciones.html', '/sugerencias.html', '/configuracion.html', '/escritorio.html', '/pestanas.html', '/calendario.html', '/musica.html', '/calculadora.html', '/plantillas.html'],
  requiereSesionParaPagina,
  (peticion, respuesta) => {
    respuesta.sendFile(path.join(__dirname, 'publico', path.basename(peticion.path)));
  }
);

app.get('/admin.html', requiereAdminParaPagina, (peticion, respuesta) => {
  respuesta.sendFile(path.join(__dirname, 'publico', 'admin.html'));
});

// "Mis cuadernos": la nueva interfaz de edición de texto (cuadernos +
// notas), accesible desde Configuración ⚙️ (ver manejaConfiguracion.js).
// Misma protección que index.html: solo requiere sesión, no rol admin.
app.get('/editor.html', requiereSesionParaPagina, (peticion, respuesta) => {
  respuesta.sendFile(path.join(__dirname, 'publico', 'editor.html'));
});

// Términos y Condiciones y Aviso de Privacidad: su texto vive en los
// .md de la raíz del proyecto (Terminos_y_Condiciones_Artonseley.md y
// Aviso_de_Privacidad_Artonseley.md) y la página se genera a partir de
// ahí en cada carga (ver servidor/paginasLegales.js). Para cambiar el
// texto basta editar el .md y volver a desplegar — ya no hay archivos
// .html de estas dos en publico/. Van antes de express.static para
// ganarle a cualquier archivo con ese nombre que quedara ahí.
app.get('/terminos-y-condiciones.html', (peticion, respuesta) =>
  manejarPaginaLegal('terminos-y-condiciones.html', respuesta));
app.get('/avisos-de-privacidad.html', (peticion, respuesta) =>
  manejarPaginaLegal('avisos-de-privacidad.html', respuesta));

// El Service Worker de los "Recordatorios del calendario". Va antes de
// express.static y con cabeceras propias: sin caché agresiva (para que un
// cambio en sw.js llegue pronto) y Service-Worker-Allowed: / para que su
// alcance pueda ser toda la raíz del sitio aunque el archivo viva en
// publico/. No lleva lógica de negocio ni datos — solo muestra la
// notificación (ver publico/sw.js).
app.get('/sw.js', (peticion, respuesta) => {
  respuesta.set('Cache-Control', 'no-cache');
  respuesta.set('Service-Worker-Allowed', '/');
  respuesta.type('application/javascript');
  respuesta.sendFile(path.join(__dirname, 'publico', 'sw.js'));
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
    nombre: usuario.nombre,
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
    nombre: peticion.usuario.nombre,
    rol: peticion.usuario.rol,
    licenciaVenceEn: peticion.usuario.licencia_vence_en,
    licenciaVigente: new Date(peticion.usuario.licencia_vence_en) > new Date()
  });
});

// "Mi cuenta": por ahora lo único editable es el apodo con el que la
// pantalla de inicio saluda al usuario (ver configuracion.html →
// sección "Mi cuenta"). Mandar cadena vacía lo borra y el saludo vuelve
// a "[user]". El límite de largo evita guardar un texto absurdo que
// desacomode el saludo.
const LARGO_MAXIMO_NOMBRE = 40;

app.post('/api/mi-cuenta', jsonEstandar, requiereSesionAPI, (peticion, respuesta) => {
  const nombre = String(peticion.body?.nombre ?? '').trim();
  if (nombre.length > LARGO_MAXIMO_NOMBRE) {
    return respuesta.status(400).json({
      error: `Ese nombre es muy largo (máximo ${LARGO_MAXIMO_NOMBRE} caracteres).`
    });
  }
  actualizarNombre(peticion.usuario.id, nombre);
  respuesta.json({ ok: true, nombre: nombre || null });
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

// Calculadora Jurídica Financiera. Igual que el buscador: todo el cálculo
// vive en servidor/ (servidor/calculadoras/), el cliente solo manda los
// datos que capturó el usuario y pinta el desglose. Requiere sesión +
// licencia vigente (es función para abogados, como la búsqueda). El
// resultado sigue el patrón { tipo: 'resultado' | 'errores' | 'mensaje' }.
app.post('/api/calculadora/:tipo', jsonEstandar, requiereSesionAPI, requiereLicenciaVigente, (peticion, respuesta) => {
  try {
    const calculadora = CALCULADORAS[peticion.params.tipo];
    if (!calculadora) {
      return respuesta.status(404).json({ error: 'Esa calculadora no existe.' });
    }

    const errores = calculadora.validar(peticion.body ?? {});
    if (errores.length > 0) {
      return respuesta.status(400).json({ tipo: 'errores', errores });
    }

    const indices = obtenerIndicesEconomicos();
    if (!indicesEconomicosListos(indices)) {
      return respuesta.json({
        tipo: 'mensaje',
        mensaje: 'La calculadora todavía no tiene cargados los valores económicos vigentes (salario mínimo, UMA). Contacta al administrador.'
      });
    }

    respuesta.json(calculadora.calcular(peticion.body, indices));
  } catch (error) {
    console.error('Error en POST /api/calculadora/:tipo:', error);
    respuesta.status(500).json({ error: 'Ocurrió un error al calcular.' });
  }
});

// Generador de Plantillas y Documentos. El servidor solo guarda el TEXTO
// de cada machote (con marcadores {{clave}}); el motor de fusión y los
// datos del cliente/expediente viven 100% en el navegador del abogado.
// Requiere sesión + licencia vigente, como el buscador.
app.get('/api/plantillas', requiereSesionAPI, requiereLicenciaVigente, (peticion, respuesta) => {
  respuesta.json({ plantillas: listarPlantillas() });
});

app.get('/api/plantillas/:id', requiereSesionAPI, requiereLicenciaVigente, (peticion, respuesta) => {
  const plantilla = buscarPlantillaPorId(Number(peticion.params.id));
  if (!plantilla) {
    return respuesta.status(404).json({ error: 'Esa plantilla ya no existe.' });
  }
  respuesta.json({
    id: plantilla.id,
    categoria: plantilla.categoria,
    titulo: plantilla.titulo,
    cuerpo: plantilla.cuerpo,
    version: plantilla.version,
    variables: extraerVariables(plantilla.cuerpo)
  });
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
// Música: el reproductor (publico/Sistema/reproductorGlobal.js, incluido
// en todas las páginas con sesión) pide la lista de canciones y luego el
// audio/imagen de cada una por id. Solo requiere sesión — igual que el
// Calendario y los Cuadernos, la música no es un dato legal y no depende
// de que la licencia esté vigente. Los archivos se sirven con res.sendFile,
// que ya responde peticiones Range (206) para poder hacer seek/streaming.
// El administrador gestiona las canciones más abajo, bajo /api/admin.
// ---------------------------------------------------------------------
app.get('/api/canciones', requiereSesionAPI, (peticion, respuesta) => {
  const canciones = listarCanciones().map((c) => ({
    id: c.id,
    titulo: c.titulo,
    orden: c.orden,
    tieneImagen: !!c.archivo_imagen
  }));
  respuesta.json({ canciones });
});

function enviarArchivoDeCancion(respuesta, nombreArchivo, mime) {
  const ruta = rutaArchivoMusica(nombreArchivo);
  if (!ruta) {
    return respuesta.status(404).json({ error: 'Archivo no encontrado.' });
  }
  if (mime) respuesta.type(mime);
  respuesta.sendFile(ruta, (error) => {
    if (error && !respuesta.headersSent) {
      respuesta.status(404).json({ error: 'Archivo no encontrado.' });
    }
  });
}

app.get('/api/musica/audio/:id', requiereSesionAPI, (peticion, respuesta) => {
  const cancion = buscarCancionPorId(Number(peticion.params.id));
  if (!cancion) {
    return respuesta.status(404).json({ error: 'Esa canción ya no existe.' });
  }
  enviarArchivoDeCancion(respuesta, cancion.archivo_audio, cancion.mime_audio);
});

app.get('/api/musica/imagen/:id', requiereSesionAPI, (peticion, respuesta) => {
  const cancion = buscarCancionPorId(Number(peticion.params.id));
  if (!cancion || !cancion.archivo_imagen) {
    return respuesta.status(404).json({ error: 'Esa canción no tiene portada.' });
  }
  enviarArchivoDeCancion(respuesta, cancion.archivo_imagen, cancion.mime_imagen);
});

// ---------------------------------------------------------------------
// Recordatorios del calendario (notificaciones Web Push). El servidor
// solo guarda la suscripción del navegador y le manda un "ping" diario
// (ver servidor/recordatoriosCalendario.js). NO ve nada del calendario:
// el aviso lo arma el Service Worker con un texto fijo. Sesión requerida,
// sin licencia — igual que el calendario en sí.
// ---------------------------------------------------------------------
app.get('/api/recordatorios/clave-publica', requiereSesionAPI, (peticion, respuesta) => {
  if (!VAPID_PUBLICA) {
    return respuesta.status(503).json({ error: 'Los recordatorios no están disponibles en este momento.' });
  }
  respuesta.json({ clavePublica: VAPID_PUBLICA });
});

app.post('/api/recordatorios/suscribir', jsonEstandar, requiereSesionAPI, (peticion, respuesta) => {
  const { suscripcion, offsetMinutos } = peticion.body ?? {};
  const endpoint = suscripcion?.endpoint;
  const p256dh = suscripcion?.keys?.p256dh;
  const auth = suscripcion?.keys?.auth;

  if (typeof endpoint !== 'string' || !endpoint || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return respuesta.status(400).json({ error: 'La suscripción no tiene la forma esperada.' });
  }
  if (endpoint.length > 1000) {
    return respuesta.status(400).json({ error: 'La suscripción no es válida.' });
  }

  const offset = Number(offsetMinutos);
  if (!Number.isInteger(offset) || offset < -840 || offset > 840) {
    return respuesta.status(400).json({ error: 'La zona horaria no es válida.' });
  }

  guardarSuscripcion({ usuarioId: peticion.usuario.id, endpoint, p256dh, auth, offsetMinutos: offset });
  respuesta.json({ ok: true });
});

app.post('/api/recordatorios/cancelar', jsonEstandar, requiereSesionAPI, (peticion, respuesta) => {
  const endpoint = peticion.body?.endpoint;
  if (typeof endpoint === 'string' && endpoint) {
    eliminarSuscripcionPorEndpoint(endpoint);
  }
  respuesta.json({ ok: true });
});

// Disparador para un cron EXTERNO (ver TOKEN_TAREAS en servidor/config.js).
// Si no hay token configurado, esta ruta no existe. Con token, exige
// "Authorization: Bearer <token>". Es el plan B para hostings que duermen
// el proceso y por eso el temporizador interno no corre.
app.post('/api/tareas/recordatorios', jsonEstandar, async (peticion, respuesta) => {
  if (!TOKEN_TAREAS) {
    return respuesta.status(404).json({ error: 'No encontrado.' });
  }
  if (peticion.get('authorization') !== `Bearer ${TOKEN_TAREAS}`) {
    return respuesta.status(401).json({ error: 'No autorizado.' });
  }
  try {
    const resumen = await barrerYEnviar();
    respuesta.json({ ok: true, ...resumen });
  } catch (error) {
    console.error('Error en POST /api/tareas/recordatorios:', error);
    respuesta.status(500).json({ error: 'No se pudo procesar el envío.' });
  }
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

// ---------------------------------------------------------------------
// Alta y renovación de cuentas DESDE EL PANEL (antes solo se podía con
// "npm run crear-usuario" / "npm run actualizar-licencia" en la terminal
// del servidor). Con decenas o cientos de usuarios eso es inviable, así
// que estas tres rutas hacen lo mismo por HTTP, protegidas por sesión +
// rol admin como todo lo demás bajo /api/admin.
// ---------------------------------------------------------------------

// Crear una cuenta a mano (cliente que ya pagó y se da de alta directo,
// o un segundo administrador). La persona podrá iniciar sesión de
// inmediato con el correo y la contraseña que ponga el admin.
app.post('/api/admin/usuarios', jsonEstandar, (peticion, respuesta) => {
  const { email, contrasena, rol = 'abogado', vigencia } = peticion.body ?? {};

  const emailLimpio = String(email ?? '').trim().toLowerCase();
  if (!emailLimpio || emailLimpio.length > 254 || !PATRON_EMAIL.test(emailLimpio)) {
    return respuesta.status(400).json({ error: 'Escribe un correo electrónico válido.' });
  }
  if (String(contrasena ?? '').length < MINIMO_CONTRASENA_REGISTRO || String(contrasena ?? '').length > 200) {
    return respuesta.status(400).json({
      error: `La contraseña debe tener entre ${MINIMO_CONTRASENA_REGISTRO} y 200 caracteres.`
    });
  }
  if (rol !== 'abogado' && rol !== 'admin') {
    return respuesta.status(400).json({ error: 'El rol debe ser "abogado" o "admin".' });
  }
  if (buscarUsuarioPorEmail(emailLimpio)) {
    return respuesta.status(409).json({ error: 'Ya existe una cuenta con este correo.' });
  }

  let licenciaVenceEn;
  try {
    licenciaVenceEn = calcularVigenciaLicencia(vigencia, { porDefectoMeses: 24 });
  } catch (error) {
    return respuesta.status(400).json({ error: error.message });
  }

  const usuario = crearUsuario({
    email: emailLimpio,
    hashContrasena: hashContrasena(String(contrasena)),
    rol,
    licenciaVenceEn
  });

  respuesta.json({ ok: true, usuario: usuarioAJSON(usuario) });
});

// Renovar (o corregir) la fecha de vencimiento de licencia de una cuenta
// existente. "vigencia" = número de meses a partir de hoy, o una fecha
// AAAA-MM-DD.
app.post('/api/admin/usuarios/:id/licencia', jsonEstandar, (peticion, respuesta) => {
  const id = Number(peticion.params.id);
  const usuario = buscarUsuarioPorId(id);
  if (!usuario) {
    return respuesta.status(404).json({ error: 'Ese usuario no existe.' });
  }

  let licenciaVenceEn;
  try {
    licenciaVenceEn = calcularVigenciaLicencia(peticion.body?.vigencia);
  } catch (error) {
    return respuesta.status(400).json({ error: error.message });
  }

  actualizarLicencia(id, licenciaVenceEn);
  respuesta.json({ ok: true, licenciaVenceEn });
});

// Aprobar una solicitud del formulario público "Crear Cuenta": crea la
// cuenta real reutilizando la contraseña que la persona ya eligió (su
// hash quedó guardado en la solicitud, ver solicitudesRegistro.js) y
// quita la solicitud de la bandeja. El admin solo define rol y vigencia.
app.post('/api/admin/solicitudes-registro/:id/aprobar', jsonEstandar, (peticion, respuesta) => {
  const solicitud = buscarSolicitudRegistroPorId(Number(peticion.params.id));
  if (!solicitud) {
    return respuesta.status(404).json({ error: 'Esa solicitud ya no está en la bandeja.' });
  }

  const { rol = 'abogado', vigencia } = peticion.body ?? {};
  if (rol !== 'abogado' && rol !== 'admin') {
    return respuesta.status(400).json({ error: 'El rol debe ser "abogado" o "admin".' });
  }
  if (buscarUsuarioPorEmail(solicitud.email)) {
    return respuesta.status(409).json({
      error: 'Ya existe una cuenta con este correo. Descarta la solicitud.'
    });
  }

  let licenciaVenceEn;
  try {
    licenciaVenceEn = calcularVigenciaLicencia(vigencia, { porDefectoMeses: 24 });
  } catch (error) {
    return respuesta.status(400).json({ error: error.message });
  }

  const usuario = crearUsuario({
    email: solicitud.email,
    hashContrasena: solicitud.hash_contrasena,
    rol,
    licenciaVenceEn
  });
  eliminarSolicitudRegistro(solicitud.id);

  respuesta.json({ ok: true, usuario: usuarioAJSON(usuario) });
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

// ---------------------------------------------------------------------
// Índices económicos (panel de administración). El admin captura el
// salario mínimo general, el de la Frontera Norte y la UMA vigentes; la
// Calculadora Jurídica Financiera los usa. Mientras los salarios mínimos
// valgan 0, la calculadora responde un aviso en vez de calcular.
// ---------------------------------------------------------------------
app.get('/api/admin/indices-economicos', (peticion, respuesta) => {
  respuesta.json({ indices: obtenerIndicesEconomicos() });
});

app.put('/api/admin/indices-economicos', jsonEstandar, (peticion, respuesta) => {
  const { anio, salarioMinimoGeneral, salarioMinimoFronteraNorte, uma } = peticion.body ?? {};

  const esNumero = (valor) => typeof valor === 'number' && Number.isFinite(valor);
  const errores = [];

  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    errores.push('El año debe ser un número entre 2000 y 2100.');
  }
  for (const [nombre, valor] of [
    ['El salario mínimo general', salarioMinimoGeneral],
    ['El salario mínimo de la Frontera Norte', salarioMinimoFronteraNorte],
    ['La UMA', uma]
  ]) {
    if (!esNumero(valor) || valor < 0 || valor > 100000) {
      errores.push(`${nombre} debe ser un número de 0 o más.`);
    }
  }

  if (errores.length > 0) {
    return respuesta.status(400).json({ error: errores.join(' ') });
  }

  const indices = guardarIndicesEconomicos({ anio, salarioMinimoGeneral, salarioMinimoFronteraNorte, uma });
  respuesta.json({ ok: true, indices });
});

// ---------------------------------------------------------------------
// Plantillas de documentos (panel de administración). El admin crea,
// edita (sube la versión) y borra los machotes de la biblioteca. Usa
// jsonDocumentoLegal (5 MB) porque el cuerpo de una plantilla puede ser
// largo. Solo texto — nunca datos de clientes.
// ---------------------------------------------------------------------
const LARGO_MAXIMO_CUERPO_PLANTILLA = 100000;

function validarPlantilla(cuerpoPeticion) {
  const categoria = String(cuerpoPeticion?.categoria ?? '').trim();
  const titulo = String(cuerpoPeticion?.titulo ?? '').trim();
  const cuerpo = String(cuerpoPeticion?.cuerpo ?? '');
  const errores = [];
  if (!categoria || categoria.length > 80) errores.push('La categoría es obligatoria (máximo 80 caracteres).');
  if (!titulo || titulo.length > 200) errores.push('El título es obligatorio (máximo 200 caracteres).');
  if (!cuerpo.trim()) errores.push('El cuerpo de la plantilla no puede estar vacío.');
  if (cuerpo.length > LARGO_MAXIMO_CUERPO_PLANTILLA) errores.push('El cuerpo es demasiado largo.');
  return { categoria, titulo, cuerpo, errores };
}

app.get('/api/admin/plantillas', (peticion, respuesta) => {
  respuesta.json({ plantillas: listarPlantillasParaAdmin() });
});

app.post('/api/admin/plantillas', jsonDocumentoLegal, (peticion, respuesta) => {
  const { categoria, titulo, cuerpo, errores } = validarPlantilla(peticion.body);
  if (errores.length > 0) {
    return respuesta.status(400).json({ error: errores.join(' ') });
  }
  const plantilla = crearPlantilla({ categoria, titulo, cuerpo });
  respuesta.json({ ok: true, plantilla: { id: plantilla.id, titulo: plantilla.titulo } });
});

app.put('/api/admin/plantillas/:id', jsonDocumentoLegal, (peticion, respuesta) => {
  const existente = buscarPlantillaPorId(Number(peticion.params.id));
  if (!existente) {
    return respuesta.status(404).json({ error: 'Esa plantilla ya no existe.' });
  }
  const { categoria, titulo, cuerpo, errores } = validarPlantilla(peticion.body);
  if (errores.length > 0) {
    return respuesta.status(400).json({ error: errores.join(' ') });
  }
  const plantilla = actualizarPlantilla(existente.id, { categoria, titulo, cuerpo });
  respuesta.json({ ok: true, plantilla: { id: plantilla.id, version: plantilla.version } });
});

app.delete('/api/admin/plantillas/:id', (peticion, respuesta) => {
  const existente = buscarPlantillaPorId(Number(peticion.params.id));
  if (!existente) {
    return respuesta.status(404).json({ error: 'Esa plantilla ya no existe.' });
  }
  eliminarPlantilla(existente.id);
  respuesta.json({ ok: true });
});

// ---------------------------------------------------------------------
// Música (panel de administración). El admin sube una canción (audio
// obligatorio + imagen opcional), la renombra, la reordena o la borra.
// Los archivos van a CARPETA_DATOS/musica/ (ver servidor/musicaArchivos.js);
// la tabla "canciones" solo guarda los metadatos.
// ---------------------------------------------------------------------
const LARGO_MAXIMO_TITULO_CANCION = 120;

app.get('/api/admin/canciones', (peticion, respuesta) => {
  const canciones = listarCanciones().map((c) => ({
    id: c.id,
    titulo: c.titulo,
    orden: c.orden,
    tieneImagen: !!c.archivo_imagen,
    creadoEn: c.creado_en
  }));
  respuesta.json({ canciones });
});

// El middleware de subida (multer) se envuelve para traducir sus errores
// (archivo muy grande, tipo no permitido) a un 400 con mensaje en español
// en vez de dejar que caiga en el manejador de errores genérico como 500.
app.post('/api/admin/canciones', (peticion, respuesta) => {
  subidaDeCancion()(peticion, respuesta, async (errorSubida) => {
    const audio = peticion.files?.audio?.[0];
    const imagen = peticion.files?.imagen?.[0];

    // Ante cualquier problema, hay que limpiar lo que multer ya haya
    // escrito en disco para no dejar archivos huérfanos.
    const limpiarArchivos = async () => {
      if (audio) await borrarArchivoDeMusica(audio.filename);
      if (imagen) await borrarArchivoDeMusica(imagen.filename);
    };

    if (errorSubida) {
      await limpiarArchivos();
      const mensaje =
        errorSubida.code === 'LIMIT_FILE_SIZE'
          ? 'El archivo es demasiado grande (el audio admite hasta 20 MB).'
          : errorSubida.message || 'No se pudo subir el archivo.';
      return respuesta.status(400).json({ error: mensaje });
    }

    const titulo = String(peticion.body?.titulo ?? '').trim();
    if (!titulo) {
      await limpiarArchivos();
      return respuesta.status(400).json({ error: 'Escribe un título para la canción.' });
    }
    if (titulo.length > LARGO_MAXIMO_TITULO_CANCION) {
      await limpiarArchivos();
      return respuesta.status(400).json({
        error: `El título es muy largo (máximo ${LARGO_MAXIMO_TITULO_CANCION} caracteres).`
      });
    }
    if (!audio) {
      await limpiarArchivos();
      return respuesta.status(400).json({ error: 'Falta el archivo de audio.' });
    }
    if (imagen && imagen.size > LIMITE_IMAGEN_BYTES) {
      await limpiarArchivos();
      return respuesta.status(400).json({ error: 'La portada es muy grande (máximo 4 MB).' });
    }

    try {
      const cancion = crearCancion({
        titulo,
        archivoAudio: audio.filename,
        mimeAudio: audio.mimetype,
        archivoImagen: imagen?.filename || null,
        mimeImagen: imagen?.mimetype || null
      });
      respuesta.json({ ok: true, cancion: { id: cancion.id, titulo: cancion.titulo } });
    } catch (error) {
      console.error('Error en POST /api/admin/canciones:', error);
      await limpiarArchivos();
      respuesta.status(500).json({ error: 'No se pudo guardar la canción.' });
    }
  });
});

app.patch('/api/admin/canciones/:id', jsonEstandar, (peticion, respuesta) => {
  const cancion = buscarCancionPorId(Number(peticion.params.id));
  if (!cancion) {
    return respuesta.status(404).json({ error: 'Esa canción ya no existe.' });
  }

  const { titulo, mover } = peticion.body ?? {};

  if (mover === 'subir' || mover === 'bajar') {
    moverCancion(cancion.id, mover);
    return respuesta.json({ ok: true });
  }

  const tituloLimpio = String(titulo ?? '').trim();
  if (!tituloLimpio) {
    return respuesta.status(400).json({ error: 'El título no puede estar vacío.' });
  }
  if (tituloLimpio.length > LARGO_MAXIMO_TITULO_CANCION) {
    return respuesta.status(400).json({
      error: `El título es muy largo (máximo ${LARGO_MAXIMO_TITULO_CANCION} caracteres).`
    });
  }
  renombrarCancion(cancion.id, tituloLimpio);
  respuesta.json({ ok: true });
});

app.delete('/api/admin/canciones/:id', async (peticion, respuesta) => {
  const fila = eliminarCancion(Number(peticion.params.id));
  if (!fila) {
    return respuesta.status(404).json({ error: 'Esa canción ya no existe.' });
  }
  await borrarArchivoDeMusica(fila.archivo_audio);
  if (fila.archivo_imagen) await borrarArchivoDeMusica(fila.archivo_imagen);
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
  iniciarRecordatoriosCalendario();
});

// Temporizador interno de los "Recordatorios del calendario": cada 30 min
// revisa si a alguna suscripción ya le toca su aviso del día (hora local
// >= 7 y no se le mandó hoy) y le manda el push. 30 min de margen está
// bien: "a partir de las 7:00" no es al minuto, y el servicio de push
// encola el mensaje si el equipo estaba apagado. En NODE_ENV=test no
// arranca (para no mandar pushes de verdad desde una prueba). Si no hay
// claves VAPID, tampoco: configurarWebPush() devuelve false.
function iniciarRecordatoriosCalendario() {
  if (process.env.NODE_ENV === 'test') return;
  if (!configurarWebPush()) {
    console.log('  - Recordatorios del calendario: desactivados (faltan claves VAPID).');
    return;
  }
  console.log('  - Recordatorios del calendario: activos (barrido cada 30 min).');
  const barrer = () => barrerYEnviar().catch((error) =>
    console.error('recordatoriosCalendario: barrido falló:', error));
  barrer();
  setInterval(barrer, 30 * 60 * 1000);
}
