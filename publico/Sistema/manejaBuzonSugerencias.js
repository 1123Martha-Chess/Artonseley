// manejaBuzonSugerencias.js
// -------------------------------------------------------------------
// Panel del "Buzón de sugerencias" (se abre desde Configuración ⚙️).
// El usuario escribe su sugerencia en un textarea, elige qué tan
// urgente la considera, y se manda al servidor con POST /api/sugerencias.
// El servidor la guarda en servidor/datos/sugerencias.json.
//
// Para VER las sugerencias que te manden, con el servidor corriendo,
// abre en el navegador:  http://localhost:3000/api/sugerencias
// -------------------------------------------------------------------
// CÓMO EDITAR LOS NIVELES DE URGENCIA:
//   Cambia el arreglo NIVELES_URGENCIA aquí abajo (el orden en que los
//   escribas es el orden en que aparecen los botones).
// -------------------------------------------------------------------

import { alternarPanelLateral } from './manejaPanelesLaterales.js';

const NIVELES_URGENCIA = ['Baja', 'Media', 'Alta'];

let panel = null;
let urgenciaSeleccionada = NIVELES_URGENCIA[0];

export function inicializarBuzonSugerencias() {
  panel = document.createElement('aside');
  panel.id = 'panelBuzonSugerencias';
  panel.className = 'panel-sugerencias'; // reutiliza el estilo que ya existe

  panel.innerHTML = `
    <h3>Buzón de sugerencias</h3>
    <p>¿Qué le hace falta al sistema? Escríbelo aquí abajo.</p>
    <textarea id="textoSugerencia" rows="6" placeholder="Escribe tu sugerencia..."
      style="width:100%; box-sizing:border-box; font-family:inherit; font-size:13px; padding:8px; margin-bottom:12px;"></textarea>
    <p>¿Qué tan urgente crees que es implementarlo?</p>
    <div id="opcionesUrgencia"></div>
    <button id="botonEnviarSugerencia" class="boton-checkbox boton-general" style="margin-top:10px; justify-content:center;">Enviar sugerencia</button>
    <p id="confirmacionSugerencia" style="font-size:12px; margin-top:8px;"></p>
  `;

  document.body.appendChild(panel);
  pintarOpcionesUrgencia();

  panel.querySelector('#botonEnviarSugerencia').addEventListener('click', enviarSugerencia);
}

function pintarOpcionesUrgencia() {
  const contenedor = panel.querySelector('#opcionesUrgencia');

  NIVELES_URGENCIA.forEach((nivel) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = nivel;
    boton.classList.add('boton-checkbox');
    boton.classList.toggle('activo', nivel === urgenciaSeleccionada);

    boton.addEventListener('click', () => {
      urgenciaSeleccionada = nivel;
      contenedor.querySelectorAll('.boton-checkbox').forEach((b) => {
        b.classList.toggle('activo', b.textContent === nivel);
      });
    });

    contenedor.appendChild(boton);
  });
}

async function enviarSugerencia() {
  const textarea = panel.querySelector('#textoSugerencia');
  const confirmacion = panel.querySelector('#confirmacionSugerencia');
  const mensaje = textarea.value.trim();

  if (!mensaje) {
    confirmacion.style.color = '#b02b2b';
    confirmacion.textContent = 'Escribe algo antes de enviar.';
    return;
  }

  try {
    const respuesta = await fetch('/api/sugerencias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje, urgencia: urgenciaSeleccionada })
    });

    if (!respuesta.ok) throw new Error('Respuesta no ok');

    confirmacion.style.color = '#1a7a1a';
    confirmacion.textContent = '¡Gracias! Tu sugerencia fue enviada.';
    textarea.value = '';
  } catch (error) {
    console.error('Error al enviar sugerencia:', error);
    confirmacion.style.color = '#b02b2b';
    confirmacion.textContent = 'No se pudo enviar. Intenta de nuevo.';
  }
}

export function alternarPanelBuzonSugerencias() {
  alternarPanelLateral(panel);
}