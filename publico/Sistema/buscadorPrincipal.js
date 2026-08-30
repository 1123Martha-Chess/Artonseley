// buscadorPrincipal.js (versión cliente, con backend)
// -------------------------------------------------------------------
// Ya NO importa diccionario.js, LectorDeJSON.js, identificadorDeLetras.js
// ni Introduccion_De_Palabras.js: esos ahora viven solo en el servidor
// (carpeta servidor/), y nunca se le mandan al navegador.
//
// Este archivo solo:
//   1) Pinta los sectores, notificaciones y configuración (igual que antes).
//   2) Manda lo que escribe el usuario a POST /api/buscar.
//   3) Pinta la respuesta que regresa el servidor, ya lista.
// -------------------------------------------------------------------

import { inicializarSistemaDeBotones, obtenerDocumentosSeleccionados } from './sistemaDeBotones.js';
import { inicializarSugerencias } from './manejaSugerencias.js';
import { inicializarConfiguracion } from './manejaConfiguracion.js';
import { inicializarBuzonSugerencias } from './manejaBuzonSugerencias.js';
import { inicializarPersonalizacion, obtenerModoActual } from './manejaPersonalizacion.js';
import { pintarResultados } from './pintarResultadosBusqueda.js';

console.log('buscadorPrincipal.js (cliente) se cargó correctamente.');

const campoPalabra = document.getElementById('campoPalabra');
const botonBuscar = document.getElementById('botonBuscar');
const contenedorResultados = document.getElementById('resultados');

// Los paneles de 🔔/⚙️ (ver .panel-sugerencias en index.html) necesitan
// saber cuánto mide la barra superior de verdad para empezar justo
// debajo de ella y no taparla. Antes ese alto estaba fijo en la hoja de
// estilos (60px), así que se desajustaba cada vez que la barra cambiaba
// de tamaño (el logo se agrandó, o la pantalla es angosta y la barra se
// parte en dos líneas). Con ResizeObserver, --altura-barra-superior se
// actualiza sola cada vez que la barra cambia de alto por cualquier motivo.
const barraSuperior = document.querySelector('.barra-superior');
if (barraSuperior) {
  const actualizarAlturaBarraSuperior = () => {
    document.documentElement.style.setProperty('--altura-barra-superior', `${barraSuperior.offsetHeight}px`);
  };
  actualizarAlturaBarraSuperior();
  new ResizeObserver(actualizarAlturaBarraSuperior).observe(barraSuperior);
}

// Mismo motivo, pero con el pie de página (ver .pie-aviso-legal): ahora
// que queda fijo abajo de la pantalla en vez de al final del documento,
// .contenedor-principal y los paneles necesitan --altura-pie-legal para
// reservarle su espacio y que no tape nada.
const pieAvisoLegal = document.querySelector('.pie-aviso-legal');
if (pieAvisoLegal) {
  const actualizarAlturaPieLegal = () => {
    document.documentElement.style.setProperty('--altura-pie-legal', `${pieAvisoLegal.offsetHeight}px`);
  };
  actualizarAlturaPieLegal();
  new ResizeObserver(actualizarAlturaPieLegal).observe(pieAvisoLegal);
}

inicializarSistemaDeBotones('contenedorSectores');
inicializarSugerencias('botonSugerencias', 'panelSugerencias');
inicializarBuzonSugerencias();
inicializarPersonalizacion();
inicializarConfiguracion('botonConfiguracion', 'menuConfiguracion');

if (!campoPalabra || !botonBuscar || !contenedorResultados) {
  console.error(
    'buscadorPrincipal.js: no encontré uno o más elementos en el HTML. ' +
    `campoPalabra=${!!campoPalabra}, botonBuscar=${!!botonBuscar}, resultados=${!!contenedorResultados}. ` +
    'Revisa que index.html tenga exactamente esos ids.'
  );
} else {
  botonBuscar.addEventListener('click', () => procesarBusqueda(campoPalabra.value));
  campoPalabra.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') procesarBusqueda(campoPalabra.value);
  });
}

async function procesarBusqueda(palabraEscrita) {
  // Antes esto se quedaba en blanco (contenedorResultados.innerHTML = '')
  // mientras esperaba al servidor, así que si la búsqueda tardaba el
  // usuario no tenía ninguna señal de que algo estaba pasando. Ahora se
  // ve el logo dando vueltas y el botón se deshabilita para evitar que
  // se manden varias búsquedas encimadas con doble clic.
  mostrarCargando();
  botonBuscar.disabled = true;

  try {
    const respuesta = await fetch('/api/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texto: palabraEscrita,
        documentos: obtenerDocumentosSeleccionados()
      })
    });

    if (respuesta.status === 401) {
      // La sesión no existe o ya expiró — no tiene caso mostrar un
      // mensaje de error aquí, lo correcto es mandarlo a iniciar sesión.
      window.location.href = 'login.html';
      return;
    }

    if (!respuesta.ok) {
      // 403 (ej. licencia vencida) trae un mensaje específico del
      // servidor; para cualquier otro error usamos uno genérico.
      const datosError = await respuesta.json().catch(() => ({}));
      mostrarMensaje(datosError.error || 'Ocurrió un error al buscar. Intenta de nuevo.', 'mensaje-error');
      return;
    }

    const datos = await respuesta.json();

    if (datos.tipo === 'mensaje') {
      mostrarMensaje(datos.mensaje);
    } else {
      pintarResultados(contenedorResultados, datos.resultados, datos.avisos);
    }
  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    mostrarMensaje('No se pudo conectar con el servidor. Intenta de nuevo.', 'mensaje-error');
  } finally {
    botonBuscar.disabled = false;
  }
}

function mostrarCargando() {
  contenedorResultados.innerHTML = '';
  const logo = document.createElement('img');
  logo.src = obtenerModoActual().logoIcono;
  logo.alt = 'Buscando…';
  logo.classList.add('logo-buscando');
  contenedorResultados.appendChild(logo);
}

function mostrarMensaje(texto, claseExtra = '') {
  contenedorResultados.innerHTML = '';
  const parrafo = document.createElement('p');
  if (claseExtra) parrafo.classList.add(claseExtra);
  parrafo.textContent = texto;
  contenedorResultados.appendChild(parrafo);
}

// El formato de encabezado que regresa el servidor (y la lógica para
// pintar cada tarjeta) vive en pintarResultadosBusqueda.js, compartido
// con editorPrincipal.js — ver ese archivo si cambia el formato.