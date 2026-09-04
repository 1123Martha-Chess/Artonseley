// recordatoriosCalendario.js
// -------------------------------------------------------------------
// El envío del "ping" diario de los Recordatorios del calendario.
//
// Idea: el servidor NO sabe nada del calendario del usuario (las notas
// están cifradas de extremo a extremo). Una vez al día, cuando en el
// huso horario de ese dispositivo ya pasaron las 7:00 a.m., le manda un
// push VACÍO. El Service Worker del navegador (publico/sw.js) recibe ese
// push y muestra una notificación con un texto FIJO — sin nada del
// calendario. El usuario abre el sitio y ahí sí, ya descifrado en su
// navegador, ve lo que tiene anotado.
//
// Si el dispositivo está apagado, el servicio de push (Google / Mozilla /
// Apple) encola el mensaje y lo entrega cuando el navegador vuelve,
// mientras no venza el TTL.
// -------------------------------------------------------------------

import webpush from 'web-push';
import { VAPID_PUBLICA, VAPID_PRIVADA, VAPID_SUBJECT } from './config.js';
import {
  listarSuscripciones,
  eliminarSuscripcionPorEndpoint,
  marcarEnviada
} from './db/suscripcionesPush.js';

// Texto de la notificación. OJO: publico/sw.js tiene su PROPIA copia de
// este texto (un Service Worker no puede importar de aquí). Si cambias
// uno, cambia el otro.
export const MENSAJE_RECORDATORIO =
  'Debido a la privacidad, no sabemos si tienes una nota en el día de hoy de tu calendario. ¡Ven y comprobémoslo!';

const HORA_MINIMA = 7;              // no antes de las 7:00 a.m. locales
const TTL_SEGUNDOS = 16 * 60 * 60;  // el push se encola hasta 16 h si el equipo está apagado

let configurado = false;

// Deja Web Push listo con las claves VAPID. Devuelve false (y no se envía
// nada) si faltan las claves — el resto del sitio funciona igual.
export function configurarWebPush() {
  if (configurado) return true;
  if (!VAPID_PUBLICA || !VAPID_PRIVADA) return false;
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLICA, VAPID_PRIVADA);
  configurado = true;
  return true;
}

// Fecha ('YYYY-MM-DD') y hora (0-23) LOCALES del dispositivo, a partir de
// su offset en minutos (= -new Date().getTimezoneOffset(), lo que manda
// el cliente). Se calcula desplazando "ahora" y leyendo en UTC.
function momentoLocal(offsetMinutos) {
  const local = new Date(Date.now() + offsetMinutos * 60000);
  const fecha = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  return { fecha, hora: local.getUTCHours() };
}

function esSuscripcionMuerta(error) {
  return error && (error.statusCode === 404 || error.statusCode === 410);
}

// Recorre todas las suscripciones y manda el push a las que ya les toca
// hoy (hora local >= 7 y no se les mandó ya hoy). Devuelve un resumen.
export async function barrerYEnviar() {
  if (!configurarWebPush()) {
    return { enviadas: 0, borradas: 0, errores: 0, sinClaves: true };
  }

  const resumen = { enviadas: 0, borradas: 0, errores: 0 };
  const carga = JSON.stringify({ tipo: 'recordatorio-calendario' });

  for (const fila of listarSuscripciones()) {
    const { fecha, hora } = momentoLocal(fila.offset_minutos);
    if (hora < HORA_MINIMA) continue;
    if (fila.ultimo_envio === fecha) continue;

    const suscripcion = {
      endpoint: fila.endpoint,
      keys: { p256dh: fila.p256dh, auth: fila.auth }
    };

    try {
      await webpush.sendNotification(suscripcion, carga, { TTL: TTL_SEGUNDOS, urgency: 'normal' });
      marcarEnviada(fila.id, fecha);
      resumen.enviadas++;
    } catch (error) {
      if (esSuscripcionMuerta(error)) {
        eliminarSuscripcionPorEndpoint(fila.endpoint);
        resumen.borradas++;
      } else {
        console.error('recordatoriosCalendario.js: fallo al enviar push:', error.statusCode || error.message);
        resumen.errores++;
      }
    }
  }

  return resumen;
}
