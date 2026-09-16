// paginaSugerencias.js
// -------------------------------------------------------------------
// Punto de entrada de sugerencias.html. Antes esto era el panel lateral
// "Buzón de sugerencias" (manejaBuzonSugerencias.js) que se abría desde
// Configuración ⚙️; ahora es una pantalla completa propia.
//
// El usuario escribe su sugerencia y se manda a POST /api/sugerencias
// (el servidor la guarda en la tabla "sugerencias" y el administrador la
// revisa desde admin.html). El buzón es ANÓNIMO a propósito: no se pide
// ni se guarda ningún otro dato aparte del mensaje (ver
// servidor/db/sugerencias.js) — por eso ya no hay selector de urgencia.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';

aplicarModoGuardado();

const textarea = document.getElementById('textoSugerencia');
const confirmacion = document.getElementById('confirmacionSugerencia');
const botonEnviar = document.getElementById('botonEnviarSugerencia');

botonEnviar.addEventListener('click', enviarSugerencia);

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
      body: JSON.stringify({ mensaje })
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
