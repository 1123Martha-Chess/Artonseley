// limitadores.js
// -------------------------------------------------------------------
// Límites de peticiones por IP (express-rate-limit), para frenar abuso
// automatizado antes de que llegue siquiera a la lógica de cada ruta.
// Esto es ADEMÁS del bloqueo por usuario que ya existe en el login
// (servidor/db/usuarios.js, tras varios intentos fallidos): aquella
// protege una cuenta puntual; esto protege al servidor de que una sola
// IP dispare cientos de peticiones por segundo, sin importar contra
// qué cuenta.
//
// Los números son deliberadamente generosos (no queremos bloquear a una
// oficina completa compartiendo la misma IP en un día normal de
// trabajo) — están para frenar un ataque automatizado, no para limitar
// el uso legítimo.
// -------------------------------------------------------------------

import rateLimit from 'express-rate-limit';

const QUINCE_MINUTOS = 15 * 60 * 1000;

function limitador({ maximo, mensaje }) {
  return rateLimit({
    windowMs: QUINCE_MINUTOS,
    max: maximo,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: mensaje }
  });
}

// Intentos de login por IP (independiente del bloqueo por cuenta, que
// ya existe y es más estricto: 5 intentos por USUARIO). Este es más
// laxo porque cubre el caso de varias personas o varias cuentas
// intentando entrar desde la misma red.
export const limitadorLogin = limitador({
  maximo: 20,
  mensaje: 'Demasiados intentos de inicio de sesión desde esta conexión. Intenta de nuevo en unos minutos.'
});

// Evita que alguien mande cientos de sugerencias automáticas.
export const limitadorSugerencias = limitador({
  maximo: 10,
  mensaje: 'Mandaste demasiadas sugerencias en poco tiempo. Intenta de nuevo más tarde.'
});

// Evita que el formulario público de "Crear Cuenta" se use para llenar
// la bandeja de solicitudes con miles de filas automatizadas.
export const limitadorSolicitudesRegistro = limitador({
  maximo: 10,
  mensaje: 'Mandaste demasiadas solicitudes en poco tiempo. Intenta de nuevo más tarde.'
});

// Límite general para el resto de /api (búsquedas, panel de
// administración, etc.) — mucho más laxo, solo para frenar un abuso
// evidente, no el uso normal del sistema.
export const limitadorGeneralAPI = limitador({
  maximo: 300,
  mensaje: 'Demasiadas peticiones desde esta conexión. Intenta de nuevo en unos minutos.'
});
