// musicaPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de musica.html. Solo interfaz: el audio de verdad lo
// maneja Sistema/reproductorGlobal.js (compartido con todas las páginas
// para que la música siga sonando al navegar).
//
// Esta página:
//   - Pinta la lista de canciones (imagen + nombre + espectrómetro).
//   - Conecta la barra fija: silenciar, volumen, pausa, detener.
//   - Deja programar una playlist (canción + minutos).
//   - Anima el espectrómetro de la canción que suena leyendo el
//     AnalyserNode del reproductor.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';
import {
  obtenerEstado,
  reproducirCancion,
  iniciarPlaylist,
  detener,
  alternarPausa,
  alternarSilencio,
  fijarVolumen,
  obtenerAnalizador,
  suscribir,
  estaEnIframe
} from './reproductorGlobal.js';

aplicarModoGuardado();

const lista = document.getElementById('listaCanciones');
const botonSilencio = document.getElementById('botonSilencio');
const botonPausa = document.getElementById('botonPausa');
const botonDetener = document.getElementById('botonDetener');
const rangoVolumen = document.getElementById('volumen');
const selCancion = document.getElementById('selCancion');
const minCancion = document.getElementById('minCancion');
const botonAgregarEntrada = document.getElementById('botonAgregarEntrada');
const botonIniciarPlaylist = document.getElementById('botonIniciarPlaylist');
const contenedorEntradas = document.getElementById('entradasPlaylist');
const estadoPlaylist = document.getElementById('estadoPlaylist');
const avisoIframe = document.getElementById('avisoIframe');

let canciones = [];
let entradasPlaylist = []; // [{ cancionId, minutos }]
const canvasPorId = new Map();

if (estaEnIframe()) avisoIframe.hidden = false;

iniciar();

async function iniciar() {
  try {
    const respuesta = await fetch('/api/sesion');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
  } catch (error) {
    console.error('musicaPrincipal.js: no se pudo confirmar la sesión:', error);
  }

  await cargarCanciones();

  const estado = obtenerEstado();
  rangoVolumen.value = Math.round((estado.volumen ?? 0.8) * 100);

  suscribir(actualizarInterfaz);
  actualizarInterfaz();
  requestAnimationFrame(dibujarEspectros);
}

async function cargarCanciones() {
  try {
    const respuesta = await fetch('/api/canciones');
    if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);
    const datos = await respuesta.json();
    canciones = datos.canciones || [];
  } catch (error) {
    console.error('musicaPrincipal.js: no se pudieron cargar las canciones:', error);
    lista.innerHTML = '<p class="mensaje-error">No se pudieron cargar las canciones.</p>';
    return;
  }

  if (canciones.length === 0) {
    lista.innerHTML = '<p class="mensaje-carga">Todavía no hay canciones. El administrador puede agregarlas desde el panel.</p>';
    selCancion.innerHTML = '<option value="">— sin canciones —</option>';
    botonAgregarEntrada.disabled = true;
    botonIniciarPlaylist.disabled = true;
    return;
  }

  pintarLista();
  pintarSelectorPlaylist();
}

function pintarLista() {
  lista.innerHTML = '';
  canvasPorId.clear();

  for (const cancion of canciones) {
    const fila = document.createElement('div');
    fila.className = 'musica-cancion';
    fila.dataset.id = String(cancion.id);

    const portada = document.createElement(cancion.tieneImagen ? 'img' : 'div');
    portada.className = 'musica-portada';
    if (cancion.tieneImagen) {
      portada.src = `/api/musica/imagen/${cancion.id}`;
      portada.alt = '';
    } else {
      portada.textContent = '♪';
    }

    const cuerpo = document.createElement('div');
    cuerpo.className = 'musica-cancion-cuerpo';

    const nombre = document.createElement('div');
    nombre.className = 'musica-nombre';
    nombre.textContent = cancion.titulo;

    const canvas = document.createElement('canvas');
    canvas.className = 'musica-espectro';
    canvas.width = 600;
    canvas.height = 34;
    canvasPorId.set(cancion.id, canvas);

    cuerpo.append(nombre, canvas);
    fila.append(portada, cuerpo);

    fila.addEventListener('click', () => {
      reproducirCancion(cancion.id);
    });

    lista.appendChild(fila);
  }
}

function pintarSelectorPlaylist() {
  selCancion.innerHTML = '';
  for (const cancion of canciones) {
    const opcion = document.createElement('option');
    opcion.value = String(cancion.id);
    opcion.textContent = cancion.titulo;
    selCancion.appendChild(opcion);
  }
}

// ===================== Barra fija =====================

botonSilencio.addEventListener('click', () => alternarSilencio());
botonPausa.addEventListener('click', () => alternarPausa());
botonDetener.addEventListener('click', () => {
  detener();
  entradasPlaylist = [];
  pintarEntradasPlaylist();
  estadoPlaylist.textContent = '';
});
rangoVolumen.addEventListener('input', () => {
  fijarVolumen(Number(rangoVolumen.value) / 100);
});

// ===================== Playlist =====================

botonAgregarEntrada.addEventListener('click', () => {
  const cancionId = Number(selCancion.value);
  const minutos = Math.max(1, Math.round(Number(minCancion.value) || 0));
  if (!cancionId) return;
  entradasPlaylist.push({ cancionId, minutos });
  pintarEntradasPlaylist();
});

botonIniciarPlaylist.addEventListener('click', () => {
  if (entradasPlaylist.length === 0) {
    estadoPlaylist.textContent = 'Agrega al menos una canción a la lista.';
    return;
  }
  iniciarPlaylist(entradasPlaylist);
});

function pintarEntradasPlaylist() {
  contenedorEntradas.innerHTML = '';
  entradasPlaylist.forEach((entrada, indice) => {
    const cancion = canciones.find((c) => c.id === entrada.cancionId);
    const fila = document.createElement('div');
    fila.className = 'musica-entrada';

    const nombre = document.createElement('span');
    nombre.className = 'nombre';
    nombre.textContent = `${indice + 1}. ${cancion ? cancion.titulo : 'canción'} — ${entrada.minutos} min`;

    const subir = document.createElement('button');
    subir.type = 'button';
    subir.textContent = '↑';
    subir.disabled = indice === 0;
    subir.addEventListener('click', () => {
      [entradasPlaylist[indice - 1], entradasPlaylist[indice]] = [entradasPlaylist[indice], entradasPlaylist[indice - 1]];
      pintarEntradasPlaylist();
    });

    const bajar = document.createElement('button');
    bajar.type = 'button';
    bajar.textContent = '↓';
    bajar.disabled = indice === entradasPlaylist.length - 1;
    bajar.addEventListener('click', () => {
      [entradasPlaylist[indice + 1], entradasPlaylist[indice]] = [entradasPlaylist[indice], entradasPlaylist[indice + 1]];
      pintarEntradasPlaylist();
    });

    const quitar = document.createElement('button');
    quitar.type = 'button';
    quitar.textContent = '✕';
    quitar.addEventListener('click', () => {
      entradasPlaylist.splice(indice, 1);
      pintarEntradasPlaylist();
    });

    fila.append(nombre, subir, bajar, quitar);
    contenedorEntradas.appendChild(fila);
  });

  const totalMin = entradasPlaylist.reduce((s, e) => s + e.minutos, 0);
  if (entradasPlaylist.length > 0) {
    contenedorEntradas.insertAdjacentHTML('beforeend', `<p style="font:12px Arial;color:#667;margin:8px 0 0 0;">Duración total: ${totalMin} min</p>`);
  }
}

// ===================== Reflejar el estado del reproductor =====================

function actualizarInterfaz() {
  const estado = obtenerEstado();

  botonSilencio.textContent = estado.silenciado ? '🔇' : '🔊';
  botonSilencio.classList.toggle('activo', estado.silenciado);

  botonPausa.textContent = estado.pausado ? '▶' : '⏸';
  botonPausa.classList.toggle('activo', estado.pausado);

  const sonandoId = estado.cancionId;
  for (const fila of lista.querySelectorAll('.musica-cancion')) {
    fila.classList.toggle('sonando', Number(fila.dataset.id) === sonandoId && !estado.pausado && estado.modo != null);
  }

  if (estado.modo === 'playlist') {
    const actual = canciones.find((c) => c.id === estado.cancionId);
    estadoPlaylist.textContent = estado.pausado
      ? 'Playlist en pausa.'
      : `Sonando (${estado.indice + 1}/${estado.playlist.length}): ${actual ? actual.titulo : ''}`;
  } else if (estado.modo === 'cancion') {
    estadoPlaylist.textContent = '';
  }
}

// ===================== Espectrómetro =====================

function dibujarEspectros() {
  requestAnimationFrame(dibujarEspectros);

  const analizador = obtenerAnalizador();
  const estado = obtenerEstado();
  const activoId = estado.modo != null && !estado.pausado ? estado.cancionId : null;

  for (const [id, canvas] of canvasPorId) {
    const ctx2d = canvas.getContext('2d');
    ctx2d.clearRect(0, 0, canvas.width, canvas.height);
    const medio = canvas.height / 2;

    if (id !== activoId || !analizador) {
      // Línea central en reposo.
      ctx2d.strokeStyle = '#c7d3df';
      ctx2d.beginPath();
      ctx2d.moveTo(0, medio);
      ctx2d.lineTo(canvas.width, medio);
      ctx2d.stroke();
      continue;
    }

    const datos = new Uint8Array(analizador.frequencyBinCount);
    analizador.getByteFrequencyData(datos);

    const barras = 48;
    const anchoBarra = canvas.width / barras;
    const color = getComputedStyle(document.documentElement).getPropertyValue('--color-primario').trim() || '#2A6BAF';
    ctx2d.fillStyle = color;

    for (let i = 0; i < barras; i++) {
      const v = datos[Math.floor((i / barras) * datos.length)] / 255;
      const altura = Math.max(1, v * medio);
      ctx2d.fillRect(i * anchoBarra + 1, medio - altura, anchoBarra - 2, altura * 2);
    }
  }
}
