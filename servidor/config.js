// config.js
// -------------------------------------------------------------------
// Configuración leída de variables de entorno, con valores por defecto
// razonables para desarrollo local. Nada de lo que aquí se controla
// (duración de la sesión, intentos de login permitidos, etc.) está fijo
// en el código de negocio — así que ajustar, por ejemplo, cuánto dura
// una sesión es cuestión de variable de entorno, no de tocar código.
//
// La duración de la LICENCIA de un usuario (los 24 meses de la versión
// fundadores) no vive aquí: se decide artículo por artículo al crear
// cada usuario (ver servidor/scripts/crearUsuario.js), porque es una
// decisión de negocio por persona/promoción, no una constante global
// del sistema.
//
// Lee un archivo .env en la raíz del proyecto si existe (ver
// .env.example) para no tener que exportar variables de entorno a mano
// en cada sesión de terminal durante desarrollo.
// -------------------------------------------------------------------

import 'dotenv/config';

export const SECRETO_COOKIES =
  process.env.SECRETO_COOKIES || 'secreto-de-desarrollo-cambialo-en-produccion';

export const DIAS_DURACION_SESION = Number(process.env.DIAS_DURACION_SESION || 7);
export const LIMITE_INTENTOS_LOGIN = Number(process.env.LIMITE_INTENTOS_LOGIN || 5);
export const MINUTOS_BLOQUEO_LOGIN = Number(process.env.MINUTOS_BLOQUEO_LOGIN || 15);

// Actívalo (CONFIA_EN_PROXY=1) SOLO si el hosting pone un proxy/balanceador
// propio delante de tu app (Render, Railway, cPanel con Passenger, Cloudflare,
// nginx, etc. — es el caso normal en PaaS). Sin esto, Express ve la IP del
// proxy en vez de la del visitante real: express-rate-limit termina
// agrupando a TODOS los usuarios bajo una sola IP (la del proxy), así que
// una sola persona haciendo varios intentos de login podría bloquear el
// acceso de todos los demás. Actívalo únicamente cuando sepas que hay un
// proxy de confianza delante — si el servidor recibe tráfico directo de
// internet sin proxy, activarlo permitiría que cualquiera falsifique su IP
// con la cabecera X-Forwarded-For y así evada estos límites.
export const CONFIA_EN_PROXY = process.env.CONFIA_EN_PROXY === '1';

if (process.env.NODE_ENV === 'production' && !process.env.SECRETO_COOKIES) {
  console.warn(
    '⚠️  SECRETO_COOKIES no está definido: se está usando un secreto de desarrollo ' +
    'inseguro para firmar las cookies de sesión. Define SECRETO_COOKIES como variable ' +
    'de entorno antes de desplegar a producción (ver README).'
  );
}
