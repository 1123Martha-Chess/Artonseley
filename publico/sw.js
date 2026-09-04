// sw.js — Service Worker de Artonseley
// -------------------------------------------------------------------
// Solo hace UNA cosa: los "Recordatorios del calendario". Cuando el
// servidor manda el "ping" diario (ver servidor/recordatoriosCalendario.js),
// aquí se recibe el evento "push" y se muestra una notificación del
// sistema con un TEXTO FIJO — sin nada del calendario, que sigue cifrado
// y solo se descifra dentro del sitio, en el navegador del usuario.
//
// NO es una PWA offline: no hay caché de recursos ni handler de "fetch".
//
// OJO: este texto tiene que coincidir con MENSAJE_RECORDATORIO de
// servidor/recordatoriosCalendario.js.
// -------------------------------------------------------------------

const MENSAJE =
  'Debido a la privacidad, no sabemos si tienes una nota en el día de hoy de tu calendario. ¡Ven y comprobémoslo!';

const URL_CALENDARIO = '/calendario.html';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Artonseley', {
      body: MENSAJE,
      icon: '/imagenes/artonseley-favicon.png',
      badge: '/imagenes/artonseley-favicon.png',
      tag: 'recordatorio-calendario', // reemplaza el aviso del día anterior si no se abrió
      renotify: true,
      data: { url: URL_CALENDARIO }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || URL_CALENDARIO, self.location.origin).href;

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const ventana of ventanas) {
        // Si ya hay una pestaña del sitio abierta, la enfocamos (y la
        // llevamos al calendario si podemos navegar).
        if (ventana.url.startsWith(self.location.origin)) {
          await ventana.focus();
          if ('navigate' in ventana) {
            try { await ventana.navigate(destino); } catch { /* algunos navegadores no dejan */ }
          }
          return;
        }
      }
      await self.clients.openWindow(destino);
    })()
  );
});
