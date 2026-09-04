// pestanasPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de pestanas.html. "Pestañas" es un navegador interno:
// una tira de pestañas arriba (estilo Chrome/Edge) y, debajo, el
// contenido de la pestaña activa. Cada pestaña es un <iframe> de una de
// las áreas del sistema (Buscador, Calendario, ...).
//
//   - Se permiten pestañas REPETIDAS de la misma área (como un navegador
//     real): cada pestaña tiene su propio identificador (uid) y su propio
//     <iframe> independiente.
//   - El botón "+" abre un menú con las áreas; al elegir una se abre
//     directo en una pestaña nueva (sin página intermedia).
//   - Al cerrar la última pestaña se muestra la rejilla para elegir otra.
//
// Qué pestañas hay abiertas y cuál está activa se guarda en localStorage
// (por navegador, no sigue a la cuenta), igual que el Escritorio.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';
import { AREAS, AREA_POR_ID } from './areasDelSistema.js';

aplicarModoGuardado();

const CLAVE_PESTANAS = 'pestanasAbiertas';
const CLAVE_ACTIVA = 'pestanasActiva';

// Áreas que se pueden abrir como pestaña: todas menos "Pestañas" (no
// tiene sentido meter este navegador dentro de sí mismo).
const AREAS_DISPONIBLES = AREAS.filter((a) => a.id !== 'pestanas');

const tira = document.getElementById('tiraPestanas');
const botonNueva = document.getElementById('botonNueva');
const menuNueva = document.getElementById('menuNueva');
const areaContenido = document.getElementById('areaContenido');
const sinPestanas = document.getElementById('sinPestanas');
const rejillaAreas = document.getElementById('rejillaAreas');

// Estado: lista de pestañas [{ uid, appId }] y uid de la activa.
let pestanas = cargar();
let activa = cargarActiva();

// <iframe> ya creados, por uid. No se recrean al cambiar de pestaña
// (se perdería lo que el usuario tenga escrito adentro): solo se
// muestran/ocultan.
const marcos = new Map();

construirMenu();
construirRejillaVacia();
normalizarActiva();
render();

botonNueva.addEventListener('click', (evento) => {
  evento.stopPropagation();
  alternarMenu();
});
document.addEventListener('click', (evento) => {
  if (!menuNueva.hidden && !menuNueva.contains(evento.target) && evento.target !== botonNueva) {
    cerrarMenu();
  }
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape') cerrarMenu();
});
window.addEventListener('resize', () => {
  if (!menuNueva.hidden) colocarMenu();
});

// ===================== Persistencia =====================

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE_PESTANAS);
    const datos = crudo ? JSON.parse(crudo) : [];
    if (!Array.isArray(datos)) return [];
    return datos
      .filter(
        (p) =>
          p &&
          typeof p.uid === 'string' &&
          AREA_POR_ID[p.appId] &&
          p.appId !== 'pestanas'
      )
      .map((p) => ({ uid: p.uid, appId: p.appId }));
  } catch {
    return [];
  }
}

function cargarActiva() {
  try {
    return localStorage.getItem(CLAVE_ACTIVA) || null;
  } catch {
    return null;
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE_PESTANAS, JSON.stringify(pestanas));
    if (activa) localStorage.setItem(CLAVE_ACTIVA, activa);
    else localStorage.removeItem(CLAVE_ACTIVA);
  } catch {
    // Sin localStorage: el navegador interno funciona en esta visita,
    // solo no se recordará la próxima vez.
  }
}

// ===================== Estado =====================

function nuevoUid() {
  try {
    return crypto.randomUUID();
  } catch {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
}

function normalizarActiva() {
  if (!pestanas.some((p) => p.uid === activa)) {
    activa = pestanas.length ? pestanas[pestanas.length - 1].uid : null;
  }
}

function abrirArea(appId) {
  if (!AREA_POR_ID[appId] || appId === 'pestanas') return;
  const uid = nuevoUid();
  pestanas.push({ uid, appId });
  activa = uid;
  cerrarMenu();
  render();
  guardar();
}

function cerrarPestana(uid) {
  const indice = pestanas.findIndex((p) => p.uid === uid);
  if (indice === -1) return;
  pestanas.splice(indice, 1);
  if (activa === uid) {
    const vecina = pestanas[indice] || pestanas[indice - 1] || null;
    activa = vecina ? vecina.uid : null;
  }
  render();
  guardar();
}

function activar(uid) {
  if (activa === uid) return;
  activa = uid;
  render();
  guardar();
}

// ===================== Render =====================

function render() {
  // --- Tira de pestañas ---
  tira.innerHTML = '';
  pestanas.forEach((p) => {
    const area = AREA_POR_ID[p.appId];
    const elemento = document.createElement('div');
    elemento.className = 'pestana' + (p.uid === activa ? ' activa' : '');
    elemento.title = area.nombre;
    elemento.addEventListener('click', (evento) => {
      if (evento.target.closest('.cerrar')) return;
      activar(p.uid);
    });

    const icono = document.createElement('span');
    icono.className = 'icono';
    icono.textContent = area.icono;

    const etiqueta = document.createElement('span');
    etiqueta.className = 'etiqueta';
    etiqueta.textContent = area.nombre;

    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'cerrar';
    cerrar.title = 'Cerrar pestaña';
    cerrar.textContent = '✕';
    cerrar.addEventListener('click', (evento) => {
      evento.stopPropagation();
      cerrarPestana(p.uid);
    });

    elemento.append(icono, etiqueta, cerrar);
    tira.appendChild(elemento);
  });

  // El botón "+" siempre queda como última pieza de la tira, pegado a la
  // pestaña de más a la derecha (se reinserta en cada render porque
  // tira.innerHTML = '' lo quitó junto con las pestañas viejas). Así se
  // va recorriendo hacia la derecha con cada pestaña nueva, en vez de
  // quedar fijo del lado derecho de la barra — como en Chrome/Edge.
  tira.appendChild(botonNueva);

  // --- iframes (uno por pestaña, solo el activo visible) ---
  for (const [uid, marco] of marcos) {
    if (!pestanas.some((p) => p.uid === uid)) {
      marco.remove();
      marcos.delete(uid);
    }
  }
  pestanas.forEach((p) => {
    let marco = marcos.get(p.uid);
    if (!marco) {
      const area = AREA_POR_ID[p.appId];
      marco = document.createElement('iframe');
      marco.src = area.url;
      marco.title = area.nombre;
      marcos.set(p.uid, marco);
      areaContenido.appendChild(marco);
    }
    marco.hidden = p.uid !== activa;
  });

  sinPestanas.hidden = pestanas.length > 0;

  // Deja la pestaña activa a la vista si la tira se desbordó.
  const activaEl = tira.querySelector('.pestana.activa');
  if (activaEl) activaEl.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}

// ===================== Menú "+" y rejilla vacía =====================

function botonDeArea(area) {
  const boton = document.createElement('button');
  boton.type = 'button';
  const icono = document.createElement('span');
  icono.textContent = area.icono;
  boton.append(icono, document.createTextNode(' ' + area.nombre));
  boton.addEventListener('click', () => abrirArea(area.id));
  return boton;
}

function construirMenu() {
  menuNueva.innerHTML = '';
  AREAS_DISPONIBLES.forEach((area) => menuNueva.appendChild(botonDeArea(area)));
}

function construirRejillaVacia() {
  rejillaAreas.innerHTML = '';
  AREAS_DISPONIBLES.forEach((area) => rejillaAreas.appendChild(botonDeArea(area)));
}

function alternarMenu() {
  if (menuNueva.hidden) abrirMenu();
  else cerrarMenu();
}

function abrirMenu() {
  menuNueva.hidden = false;
  colocarMenu();
}

function colocarMenu() {
  const rect = botonNueva.getBoundingClientRect();
  const ancho = menuNueva.offsetWidth || 320;
  const izquierda = Math.max(8, Math.min(rect.left, window.innerWidth - ancho - 8));
  menuNueva.style.left = izquierda + 'px';
  menuNueva.style.top = rect.bottom + 4 + 'px';
}

function cerrarMenu() {
  menuNueva.hidden = true;
}
