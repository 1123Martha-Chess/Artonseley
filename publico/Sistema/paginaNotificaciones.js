// paginaNotificaciones.js
// -------------------------------------------------------------------
// Punto de entrada de notificaciones.html. Antes esto era un panel
// lateral (manejaSugerencias.js) que se abría desde el ícono 🔔 del
// buscador; ahora es una pantalla completa propia.
//
// El contenido sale de GET /api/notificaciones (tabla "notificaciones"
// en la base de datos), que el administrador gestiona desde admin.html.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';

const COLOR_TEXTO_DEFECTO = '#222222';

aplicarModoGuardado();

const contenedor = document.getElementById('listaNotificaciones');

cargarNotificaciones();

async function cargarNotificaciones() {
  try {
    const respuesta = await fetch('/api/notificaciones');

    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (!respuesta.ok) {
      throw new Error(`El servidor respondió ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    pintarNotificaciones(datos.notificaciones);
  } catch (error) {
    console.error('paginaNotificaciones.js: no se pudieron cargar las notificaciones:', error);
    contenedor.innerHTML = '<p class="mensaje-error">No se pudieron cargar las notificaciones.</p>';
  }
}

function pintarNotificaciones(notificaciones) {
  contenedor.innerHTML = '';

  if (!notificaciones || notificaciones.length === 0) {
    const vacio = document.createElement('p');
    vacio.textContent = 'No hay notificaciones por ahora.';
    contenedor.appendChild(vacio);
    return;
  }

  notificaciones.forEach((notificacion) => {
    const parrafo = document.createElement('p');
    parrafo.textContent = notificacion.texto;
    parrafo.style.color = notificacion.color || COLOR_TEXTO_DEFECTO;
    contenedor.appendChild(parrafo);
  });
}
