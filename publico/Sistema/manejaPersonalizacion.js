// manejaPersonalizacion.js
// -------------------------------------------------------------------
// "Personalización": deja elegir el modo de color de la plataforma.
// Elegir un modo cambia: el color de acento del sitio (botones, casillas
// activas), el ícono y el nombre "ARTONSELEY" de la barra superior (dos
// imágenes separadas), y el ícono que da vueltas mientras se busca. La
// elección se guarda en este navegador (localStorage), así que se
// recuerda la próxima vez que se abra la página.
//
// Se usa de dos formas:
//   - En configuracion.html (pantalla completa): renderizarPersonalizacionEn(elemento)
//     pinta el selector dentro de una sección de esa página.
//   - En editor.html (todavía con paneles laterales): inicializarPersonalizacion()
//     crea el panel flotante y alternarPanelPersonalizacion() lo abre/cierra.
//   - En cualquier página que solo necesite aplicar el color guardado sin
//     mostrar el selector (buscador.html, index.html): aplicarModoGuardado().
//
// Por ahora solo existe el modo "Azul" (el color con el que se lanzó
// el sitio) — es el único que aparece en MODOS más abajo.
// -------------------------------------------------------------------
// CÓMO AGREGAR UN MODO NUEVO:
//   1) Copia sus dos imágenes a publico/imagenes/: el ícono (logo
//      redondo, sin texto — también se usa mientras se busca) y el
//      nombre "ARTONSELEY" solo (sin el ícono).
//   2) Agrega una línea a MODOS, copiando la forma de la del modo Azul.
//   Con eso el selector, el color de acento, y las dos imágenes se
//   actualizan solos al elegirlo — no hace falta tocar nada más.
// -------------------------------------------------------------------

import { alternarPanelLateral } from './manejaPanelesLaterales.js';

const CLAVE_ALMACENAMIENTO = 'modoPersonalizacion';

const MODOS = [
  {
    id: 'azul',
    nombre: 'Azul (clásico)',
    color: '#2A6BAF',
    // Versiones con fondo transparente: el ícono "PAGINA" (el compás) y
    // el nombre "ARTONSELEY" en trazo grueso. Reemplazan a las versiones
    // viejas con fondo blanco (artonseley-logo-azul.jpg / -letras-azul.png).
    logoIcono: 'imagenes/artonseley-pagina.png',
    logoLetras: 'imagenes/artonseley-letras.png'
  }
];

let panel = null;
let modoActual = obtenerModoGuardado();

function obtenerModoGuardado() {
  try {
    const idGuardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    return MODOS.find((modo) => modo.id === idGuardado) || MODOS[0];
  } catch {
    // Si localStorage no está disponible (ej. modo privado estricto),
    // simplemente se usa el primer modo sin recordar la elección.
    return MODOS[0];
  }
}

// Lo usa buscadorPrincipal.js para saber qué ícono mostrar dando vueltas
// mientras se espera la respuesta del servidor.
export function obtenerModoActual() {
  return modoActual;
}

// Aplica el color/las imágenes del modo guardado, sin pintar ningún
// selector ni panel. Para páginas que solo heredan el color elegido.
export function aplicarModoGuardado() {
  aplicarModo(modoActual);
}

// Pinta el selector de modos (un botón por modo) dentro del elemento que
// se le pase. Se usa tanto para el panel flotante de editor.html (que sí
// quiere su propio título, incluirTitulo = true) como para la sección de
// configuracion.html (que ya trae su encabezado, incluirTitulo = false).
function pintarSelector(destino, incluirTitulo) {
  destino.innerHTML = '';

  if (incluirTitulo) {
    const titulo = document.createElement('h3');
    titulo.textContent = 'Personalización';
    destino.appendChild(titulo);
  }

  const descripcion = document.createElement('p');
  descripcion.textContent = 'Elige el modo de color de la plataforma.';
  destino.appendChild(descripcion);

  MODOS.forEach((modo) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.classList.add('boton-checkbox');
    boton.classList.toggle('activo', modo.id === modoActual.id);
    boton.textContent = modo.nombre;

    boton.addEventListener('click', () => {
      modoActual = modo;
      try {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, modo.id);
      } catch {
        // No pasa nada si no se puede guardar: el modo elegido sigue
        // aplicado en esta visita, solo no se recordará la próxima vez.
      }
      aplicarModo(modo);
      pintarSelector(destino, incluirTitulo);
    });

    destino.appendChild(boton);
  });
}

// Para configuracion.html: pinta el selector dentro de la sección que se
// le indique y deja aplicado el modo guardado.
export function renderizarPersonalizacionEn(elemento) {
  if (!elemento) {
    console.error('manejaPersonalizacion.js: renderizarPersonalizacionEn recibió un elemento vacío.');
    return;
  }
  aplicarModo(modoActual);
  pintarSelector(elemento, false);
}

// Para editor.html: crea el panel flotante lateral (mismo estilo que los
// demás paneles) y aplica el modo guardado.
export function inicializarPersonalizacion() {
  aplicarModo(modoActual);

  panel = document.createElement('aside');
  panel.id = 'panelPersonalizacion';
  panel.className = 'panel-sugerencias'; // reutiliza el estilo que ya existe
  document.body.appendChild(panel);

  pintarSelector(panel, true);
}

function aplicarModo(modo) {
  document.documentElement.style.setProperty('--color-primario', modo.color);

  const icono = document.getElementById('iconoMarca');
  if (icono) icono.src = modo.logoIcono;

  const letras = document.getElementById('letrasMarca');
  if (letras) letras.src = modo.logoLetras;
}

export function alternarPanelPersonalizacion() {
  alternarPanelLateral(panel);
}
