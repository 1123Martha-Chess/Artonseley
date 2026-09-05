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

// Cuántas sesiones (dispositivos/navegadores con sesión iniciada a la vez)
// se permiten por cuenta antes de que el login rechace uno más. Es "por
// lo mientras" 2 — el propio dueño puede pedir que cambie más adelante,
// así que vive aquí como variable de entorno y no como número fijo en el
// código. Una cuenta concreta puede tener su propio límite distinto (ver
// usuarios.limite_sesiones en servidor/db/usuarios.js): este valor solo
// aplica cuando esa columna está vacía (NULL).
export const LIMITE_SESIONES_POR_DEFECTO = Number(process.env.LIMITE_SESIONES_POR_DEFECTO || 2);

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

// Claves VAPID para los "Recordatorios del calendario" (Web Push). Se
// generan UNA sola vez con `npm run generar-vapid` y se pegan en .env
// (ver README). Sin ellas, la función simplemente no se activa: el
// servidor arranca igual, solo que el interruptor de Configuración no
// hace nada útil y el trabajo diario de envío no corre.
//   - VAPID_SUBJECT: un "mailto:" o URL de contacto, requerido por el
//     protocolo para que el servicio de push sepa a quién reclamar.
export const VAPID_PUBLICA = process.env.VAPID_PUBLICA || '';
export const VAPID_PRIVADA = process.env.VAPID_PRIVADA || '';
export const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:soporte@artonseley.site';

// Token para que un cron EXTERNO (ej. cron-job.org) pueda disparar el
// envío diario de recordatorios pegando a POST /api/tareas/recordatorios.
// Solo hace falta si el hosting duerme el proceso (Render Free) y por eso
// el temporizador interno no es de fiar. Si se deja vacío, esa ruta
// responde 404 (no existe).
export const TOKEN_TAREAS = process.env.TOKEN_TAREAS || '';

if (process.env.NODE_ENV === 'production' && !process.env.SECRETO_COOKIES) {
  console.warn(
    '⚠️  SECRETO_COOKIES no está definido: se está usando un secreto de desarrollo ' +
    'inseguro para firmar las cookies de sesión. Define SECRETO_COOKIES como variable ' +
    'de entorno antes de desplegar a producción (ver README).'
  );
}

if (process.env.NODE_ENV === 'production' && (!VAPID_PUBLICA || !VAPID_PRIVADA)) {
  console.warn(
    '⚠️  VAPID_PUBLICA / VAPID_PRIVADA no están definidas: los "Recordatorios del ' +
    'calendario" (notificaciones Web Push) quedan desactivados. Genera un par con ' +
    '"npm run generar-vapid" y ponlas en las variables de entorno (ver README).'
  );
}
