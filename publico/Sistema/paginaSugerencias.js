// paginaSugerencias.js
// -------------------------------------------------------------------
// Punto de entrada de sugerencias.html. Antes esto era el panel lateral
// "Buzón de sugerencias" (manejaBuzonSugerencias.js) que se abría desde
// Configuración ⚙️; ahora es una pantalla completa propia.
//
// El usuario escribe su sugerencia, elige un nivel de urgencia, y se
// manda a POST /api/sugerencias (el servidor la guarda en la tabla
// "sugerencias" y el administrador la revisa desde admin.html).
// -------------------------------------------------------------------
// CÓMO EDITAR LOS NIVELES DE URGENCIA: cambia el arreglo NIVELES_URGENCIA
// (el orden en que los escribas es el orden en que aparecen los botones).
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';

const NIVELES_URGENCIA = ['Baja', 'Media', 'Alta'];

let urgenciaSeleccionada = NIVELES_URGENCIA[0];

aplicarModoGuardado();

const textarea = document.getElementById('textoSugerencia');
const contenedorUrgencia = document.getElementById('opcionesUrgencia');
const confirmacion = document.getElementById('confirmacionSugerencia');
const botonEnviar = document.getElementById('botonEnviarSugerencia');

pintarOpcionesUrgencia();
botonEnviar.addEventListener('click', enviarSugerencia);

function pintarOpcionesUrgencia() {
  NIVELES_URGENCIA.forEach((nivel) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = nivel;
    boton.classList.add('boton-checkbox');
    boton.classList.toggle('activo', nivel === urgenciaSeleccionada);

    boton.addEventListener('click', () => {
      urgenciaSeleccionada = nivel;
      contenedorUrgencia.querySelectorAll('.boton-checkbox').forEach((b) => {
        b.classList.toggle('activo', b.textContent === nivel);
      });
    });

    contenedorUrgencia.appendChild(boton);
  });
}

async function enviarSugerencia() {
  const mensaje = textarea.value.trim();

  if (!mensaje) {
    confirmacion.className = 'mensaje-error';
    confirmacion.textContent = 'Escribe algo antes de enviar.';
    return;
  }

  botonEnviar.disabled = true;

  try {
    const respuesta = await fetch('/api/sugerencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, urgencia: urgenciaSeleccionada })
    });

    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (!respuesta.ok) {
      const datosError = await respuesta.json().catch(() => ({}));
      throw new Error(datosError.error || 'Respuesta no ok');
    }

    confirmacion.className = 'mensaje-ok';
    confirmacion.textContent = '¡Gracias! Tu sugerencia fue enviada.';
    textarea.value = '';
  } catch (error) {
    console.error('paginaSugerencias.js: error al enviar la sugerencia:', error);
    confirmacion.className = 'mensaje-error';
    confirmacion.textContent = error.message || 'No se pudo enviar. Intenta de nuevo.';
  } finally {
    botonEnviar.disabled = false;
  }
}
