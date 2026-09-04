// manejaConfiguracion.js
// -------------------------------------------------------------------
// Botón de configuración (⚙️), ubicado a la izquierda del botón de
// notificaciones. Al hacer click abre un menú desplegable con estas
// opciones:
//
//   1) Buzón de sugerencias    -> NO cambia de página. Abre el mismo panel
//                                  de "Leyes modificadas" que ya existía
//                                  (el del botón 🔔 Notificaciones).
//   2) Personalización         -> NO cambia de página. Abre el panel donde
//                                  se elige el modo de color de la plataforma
//                                  (ver manejaPersonalizacion.js).
//   3) Guía de Uso             -> navega a su propia página: guia-de-uso.html
//   4) Términos y condiciones  -> navega a su propia página: terminos-y-condiciones.html
//   5) Avisos de privacidad    -> navega a su propia página: avisos-de-privacidad.html
//
// Cada opción de página lleva a UNA página individual distinta, no
// todas a la misma.
// -------------------------------------------------------------------
// CÓMO EDITAR (esto es lo único que vas a necesitar tocar normalmente):
//
//   Edita el arreglo OPCIONES aquí abajo. Cada opción es:
//
//       { texto: 'Lo que se muestra en el menú', pagina: 'archivo.html' }
//
//   - "texto"  -> el texto del botón dentro del menú.
//   - "pagina" -> a qué archivo .html navega al hacer click.
//                 Si "pagina" es null, en vez de navegar, se abre el panel
//                 de notificaciones (comportamiento especial, solo pensado
//                 para "Buzón de sugerencias") — a menos que la opción
//                 tenga su propio "accion" (ver abajo).
//
//   Agregar una opción nueva al menú: agrega una línea más en OPCIONES y
//   crea su archivo .html (puedes copiar guia-de-uso.html como plantilla).
// -------------------------------------------------------------------

import { alternarPanelBuzonSugerencias } from './manejaBuzonSugerencias.js';
import { alternarPanelPersonalizacion } from './manejaPersonalizacion.js';

const OPCIONES = [
  { texto: 'Buzón de sugerencias', pagina: null },
  // "accion: 'personalizacion'" es otro caso especial (ver el
  // comentario sobre "accion: 'cerrarSesion'" más abajo): en vez de
  // navegar o abrir el buzón, abre el panel de modos de color.
  { texto: 'Personalización', pagina: null, accion: 'personalizacion' },
  // Justo debajo de "Personalización": la nueva interfaz de edición de
  // texto (cuadernos + notas). Es una página aparte (editor.html), no un
  // panel — por eso simplemente navega, como "Guía de Uso" y las demás.
  // Dentro de editor.html este texto cambia a "Volver al Buscador" y
  // apunta a index.html (ver el reemplazo en inicializarConfiguracion).
  { texto: 'Mis cuadernos', pagina: 'editor.html' },
  { texto: 'Guía de Uso', pagina: 'guia-de-uso.html' },
  { texto: 'Términos y condiciones', pagina: 'terminos-y-condiciones.html' },
  { texto: 'Avisos de privacidad', pagina: 'avisos-de-privacidad.html' },
  // "accion: 'cerrarSesion'" es un tercer caso especial (además de
  // "pagina" y "pagina: null"): en vez de navegar o abrir el buzón,
  // llama a POST /api/logout y manda al usuario de vuelta al login.
  { texto: 'Cerrar sesión', pagina: null, accion: 'cerrarSesion' }
];

// idBotonConfig: id del botón ⚙️.
// idMenu:        id del contenedor donde se pinta el menú desplegable.
export async function inicializarConfiguracion(idBotonConfig, idMenu) {
  const boton = document.getElementById(idBotonConfig);
  const menu = document.getElementById(idMenu);

  if (!boton || !menu) {
    console.error(`manejaConfiguracion.js: no encontré #${idBotonConfig} o #${idMenu} en el HTML.`);
    return;
  }

  // Dentro de editor.html ("Mis cuadernos"), esa misma opción del menú
  // debe decir "Volver al Buscador" y regresar a index.html en vez de
  // navegar hacia editor.html (que es justo donde ya se está parado).
  // Se arma una copia de OPCIONES en vez de modificarlo directamente,
  // para que ese arreglo siga siendo la lista fija que describe el
  // comentario de arriba, sin sorpresas si esta función se llegara a
  // llamar más de una vez.
  const estaEnEditor = window.location.pathname.endsWith('/editor.html');
  let opcionesFinales = OPCIONES.map((opcion) => {
    if (estaEnEditor && opcion.pagina === 'editor.html') {
      return { texto: 'Volver al Buscador', pagina: 'buscador.html' };
    }
    return opcion;
  });

  try {
    const respuesta = await fetch('/api/sesion');
    if (respuesta.ok) {
      const sesion = await respuesta.json();
      if (sesion.rol === 'admin') {
        opcionesFinales = [...opcionesFinales];
        opcionesFinales.splice(1, 0, { texto: 'Panel de administración', pagina: 'admin.html' });
      }
    }
  } catch {
    // Si esto falla, simplemente no se agrega la opción — no es motivo
    // para romper el resto del menú.
  }

  pintarMenu(menu, opcionesFinales);

  boton.addEventListener('click', (evento) => {
    evento.stopPropagation(); // para que el listener de "click afuera" no lo cierre de inmediato
    menu.classList.toggle('menu-abierto');
  });

  // Si el usuario hace click afuera del menú, se cierra solo.
  document.addEventListener('click', (evento) => {
    if (!menu.contains(evento.target) && evento.target !== boton) {
      menu.classList.remove('menu-abierto');
    }
  });
}

function pintarMenu(menu, opciones) {
  menu.innerHTML = '';

  opciones.forEach((opcion) => {
    const botonOpcion = document.createElement('button');
    botonOpcion.type = 'button';
    botonOpcion.classList.add('opcion-menu-configuracion');
    botonOpcion.textContent = opcion.texto;

    botonOpcion.addEventListener('click', async () => {
      if (opcion.accion === 'cerrarSesion') {
        await fetch('/api/logout', { method: 'POST' }).catch(() => {});
        window.location.href = 'login.html';
        return;
      }

      if (opcion.accion === 'personalizacion') {
        alternarPanelPersonalizacion();
        menu.classList.remove('menu-abierto');
        return;
      }

      if (opcion.pagina) {
        window.location.href = opcion.pagina;
      } else {
        alternarPanelBuzonSugerencias();
      }
      menu.classList.remove('menu-abierto');
    });

    menu.appendChild(botonOpcion);
  });
}