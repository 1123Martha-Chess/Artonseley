// manejaSugerencias.js
// -------------------------------------------------------------------
// Bandeja de notificaciones: un botón (arriba a la derecha) que
// abre/cierra un panel a la derecha de la pantalla donde se listan
// las leyes que se han modificado.
//
// Antes el contenido vivía en un arreglo NOTIFICACIONES fijo aquí
// mismo; ahora sale de GET /api/notificaciones (tabla "notificaciones"
// en la base de datos), que el administrador gestiona desde
// admin.html sin tocar código. Se piden apenas se abre el panel por
// primera vez (no antes, para no gastar una petición si el usuario
// nunca lo abre).
// -------------------------------------------------------------------

import { alternarPanelLateral } from './manejaPanelesLaterales.js';

export const COLOR_TEXTO_DEFECTO = '#222222';

let yaSeCargaron = false;

// idBoton: id del botón que abre/cierra el panel.
// idPanel: id del contenedor (aside) donde se pinta el panel.
export function inicializarSugerencias(idBoton, idPanel) {
  const boton = document.getElementById(idBoton);
  const panel = document.getElementById(idPanel);

  if (!boton || !panel) {
    console.error(`manejaSugerencias.js: no encontré #${idBoton} o #${idPanel} en el HTML.`);
    return;
  }

  boton.addEventListener('click', async () => {
    alternarPanelLateral(panel);
    if (panel.classList.contains('panel-abierto') && !yaSeCargaron) {
      await cargarYPintarNotificaciones(panel);
    }
  });
}

async function cargarYPintarNotificaciones(panel) {
  panel.innerHTML = '<p class="mensaje-carga">Cargando…</p>';

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
    pintarNotificaciones(panel, datos.notificaciones);
    yaSeCargaron = true;
  } catch (error) {
    console.error('manejaSugerencias.js: no se pudieron cargar las notificaciones:', error);
    panel.innerHTML = '<p class="mensaje-error">No se pudieron cargar las notificaciones.</p>';
  }
}

function pintarNotificaciones(panel, notificaciones) {
  panel.innerHTML = '';

  if (notificaciones.length === 0) {
    const vacio = document.createElement('p');
    vacio.textContent = 'No hay notificaciones por ahora.';
    panel.appendChild(vacio);
    return;
  }

  notificaciones.forEach(notificacion => {
    const parrafo = document.createElement('p');
    parrafo.textContent = notificacion.texto;
    parrafo.style.color = notificacion.color || COLOR_TEXTO_DEFECTO;
    panel.appendChild(parrafo);
  });
}
