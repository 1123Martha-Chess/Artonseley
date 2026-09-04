// recordatoriosCalendario.js
// -------------------------------------------------------------------
// Lado del cliente de los "Recordatorios del calendario" (Web Push).
// Lo usan configuracion.html (el interruptor) y calendario.html (para
// mantener viva la suscripción y actualizar el huso horario).
//
// El flujo: pedir permiso de notificaciones -> registrar el Service
// Worker (/sw.js) -> suscribirse a push con la clave pública VAPID del
// servidor -> mandar la suscripción a /api/recordatorios/suscribir.
// A partir de ahí el servidor manda un "ping" diario y el Service Worker
// muestra el aviso (texto fijo, sin nada del calendario).
// -------------------------------------------------------------------

const RUTA_SW = '/sw.js';

function claveBandera(email) {
  return `recordatorios::activado::${email}`;
}

function marcarBandera(email, activado) {
  try {
    if (activado) localStorage.setItem(claveBandera(email), '1');
    else localStorage.removeItem(claveBandera(email));
  } catch {
    /* sin localStorage: solo se pierde el "recuerda que lo activó" para la sincronización */
  }
}

function banderaEncendida(email) {
  try {
    return localStorage.getItem(claveBandera(email)) === '1';
  } catch {
    return false;
  }
}

// ¿Este navegador puede hacer notificaciones Web Push? (Necesita HTTPS o
// localhost: por la IP de la LAN no hay Service Workers.)
export function soportado() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window &&
    window.isSecureContext
  );
}

// Estado actual para pintar el interruptor:
//   'no-soportado' | 'permiso-denegado' | 'activado' | 'desactivado'
export async function estado() {
  if (!soportado()) return 'no-soportado';
  if (Notification.permission === 'denied') return 'permiso-denegado';
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    const suscripcion = registro && (await registro.pushManager.getSubscription());
    return suscripcion ? 'activado' : 'desactivado';
  } catch {
    return 'desactivado';
  }
}

function base64UrlAUint8Array(base64Url) {
  const relleno = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + relleno).replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

async function obtenerClavePublica() {
  const respuesta = await fetch('/api/recordatorios/clave-publica');
  if (!respuesta.ok) throw new Error('No se pudo obtener la clave de notificaciones.');
  const { clavePublica } = await respuesta.json();
  if (!clavePublica) throw new Error('El servidor no tiene configuradas las notificaciones.');
  return clavePublica;
}

async function suscribirYRegistrar() {
  const registro = await navigator.serviceWorker.register(RUTA_SW);
  await navigator.serviceWorker.ready;

  const clavePublica = await obtenerClavePublica();
  const suscripcion =
    (await registro.pushManager.getSubscription()) ||
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlAUint8Array(clavePublica)
    }));

  const respuesta = await fetch('/api/recordatorios/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suscripcion: suscripcion.toJSON(),
      offsetMinutos: -new Date().getTimezoneOffset()
    })
  });
  if (!respuesta.ok) throw new Error('No se pudo guardar la suscripción.');
  return suscripcion;
}

// Devuelve: 'activado' | 'permiso-denegado' | 'no-soportado' | 'error'
export async function activar(email) {
  if (!soportado()) return 'no-soportado';

  const permiso = await Notification.requestPermission();
  if (permiso !== 'granted') return 'permiso-denegado';

  try {
    await suscribirYRegistrar();
    marcarBandera(email, true);
    return 'activado';
  } catch (error) {
    console.error('recordatoriosCalendario.js: no se pudo activar:', error);
    return 'error';
  }
}

export async function desactivar(email) {
  marcarBandera(email, false);
  try {
    const registro = await navigator.serviceWorker.getRegistration();
    const suscripcion = registro && (await registro.pushManager.getSubscription());
    if (suscripcion) {
      await fetch('/api/recordatorios/cancelar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: suscripcion.endpoint })
      }).catch(() => {});
      await suscripcion.unsubscribe().catch(() => {});
    }
  } catch (error) {
    console.error('recordatoriosCalendario.js: no se pudo desactivar del todo:', error);
  }
  return 'desactivado';
}

// Si el usuario ya había activado los recordatorios en este navegador,
// vuelve a registrar/suscribir en silencio: renueva suscripciones vencidas
// y actualiza el huso horario si viajó. No pide permiso (si ya no lo tiene,
// no hace nada). Se llama al abrir configuracion.html y calendario.html.
export async function sincronizar(email) {
  if (!soportado()) return;
  if (!banderaEncendida(email)) return;
  if (Notification.permission !== 'granted') return;
  try {
    await suscribirYRegistrar();
  } catch (error) {
    console.error('recordatoriosCalendario.js: sincronización falló:', error);
  }
}
