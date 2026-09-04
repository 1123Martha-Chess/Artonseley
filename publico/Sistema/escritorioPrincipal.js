// escritorioPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de escritorio.html. El "escritorio" es un lienzo con
// una cuadrícula de cuadros fijos (ver cuadritosMios.png). El usuario:
//
//   1) Toca "+ Agregar ventana" → se abre la "caja de piezas" con las
//      áreas que todavía no están en el lienzo (Buscador, Cuadernos,
//      Notificaciones, Sugerencias, Configuración, Calendario, Música,
//      Calculadora, Plantillas, Pestañas).
//   2) Arrastra una pieza al lienzo. Cae ocupando UN cuadro.
//   3) La agranda arrastrando un borde (crece hacia ese lado) o una
//      esquina (crece en las dos direcciones), con snap a la cuadrícula.
//      Puede ir desde 1 cuadro hasta llenar todo el lienzo.
//   4) La mueve arrastrando su barra de título; la quita con la ✕.
//
// Reglas: las ventanas NO se enciman (si el destino choca con otra o se
// sale de la cuadrícula, no se aplica). Cada área es única en el lienzo:
// al quitarla vuelve a la caja de piezas.
//
// Cada ventana es un <iframe> de su página tal cual ya existe. La
// distribución (qué ventanas, en qué cuadro, de qué tamaño) se guarda en
// localStorage — es por navegador, no sigue a la cuenta.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';
import { AREAS } from './areasDelSistema.js';

// Geometría de la cuadrícula. CELDA = lado del cuadro; SEP = separación
// entre cuadros; PASO = de un cuadro al siguiente. Los mismos números
// están en el CSS de escritorio.html (.celda / .lienzo margin).
const CELDA = 94;
const SEP = 6;
const PASO = CELDA + SEP;
const MARGEN_LIENZO = 14;
const MAX_FILAS = 60;

const CLAVE_ALMACENAMIENTO = 'escritorioLayout';

// Las ventanas del Escritorio son todas las áreas del sistema (lista
// compartida en areasDelSistema.js) menos el propio Escritorio.
const VENTANAS = AREAS.filter((a) => a.id !== 'escritorio');
const VENTANA_POR_ID = Object.fromEntries(VENTANAS.map((v) => [v.id, v]));

aplicarModoGuardado();

const lienzo = document.getElementById('lienzo');
const lienzoScroll = document.getElementById('lienzoScroll');
const contenedorCeldas = document.getElementById('celdas');
const fantasma = document.getElementById('fantasma');
const pistaVacio = document.getElementById('pistaVacio');
const cajaFondo = document.getElementById('cajaFondo');
const listaPiezas = document.getElementById('listaPiezas');

// Estado: lista de ventanas colocadas, cada una { id, c, r, w, h } en
// coordenadas de cuadro (columna, fila, ancho, alto).
let colocadas = cargar();

// COLS/FILAS de la cuadrícula visible. COLS depende del ancho de la
// ventana del navegador; FILAS del alto, y crece si una ventana llega
// más abajo.
let COLS = 1;
let FILAS = 1;

// Elementos .ventana ya creados (para NO recrear el iframe en cada
// repintado — se perdería lo que el usuario tenga escrito adentro).
const elementos = new Map();

document.getElementById('botonAgregar').addEventListener('click', abrirCaja);
document.getElementById('cerrarCaja').addEventListener('click', cerrarCaja);
cajaFondo.addEventListener('click', (evento) => {
  if (evento.target === cajaFondo) cerrarCaja();
});
document.addEventListener('keydown', (evento) => {
  if (evento.key === 'Escape' && !cajaFondo.hidden) cerrarCaja();
});

recalcularCuadricula();
pintarCeldas();
sincronizarVentanas();

// Al cambiar el tamaño de la ventana del navegador cambia COLS: se
// recalcula y se reacomoda lo que se salga.
new ResizeObserver(() => {
  recalcularCuadricula();
  pintarCeldas();
  sincronizarVentanas();
}).observe(lienzoScroll);

// ===================== Persistencia =====================

function cargar() {
  try {
    const crudo = localStorage.getItem(CLAVE_ALMACENAMIENTO);
    if (!crudo) return [];
    const datos = JSON.parse(crudo);
    if (!Array.isArray(datos)) return [];
    return datos.filter(
      (v) =>
        v &&
        VENTANA_POR_ID[v.id] &&
        Number.isInteger(v.c) && Number.isInteger(v.r) &&
        Number.isInteger(v.w) && Number.isInteger(v.h) &&
        v.w >= 1 && v.h >= 1
    );
  } catch {
    return [];
  }
}

function guardar() {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(colocadas));
  } catch {
    // Si localStorage no está disponible, el escritorio sigue funcionando
    // en esta visita; solo no se recordará la próxima vez.
  }
}

// ===================== Cuadrícula =====================

function recalcularCuadricula() {
  const anchoUtil = lienzoScroll.clientWidth - MARGEN_LIENZO * 2;
  const altoUtil = lienzoScroll.clientHeight - MARGEN_LIENZO * 2;

  COLS = Math.max(1, Math.floor((anchoUtil + SEP) / PASO));
  const filasVisibles = Math.max(1, Math.floor((altoUtil + SEP) / PASO));

  // Si el ancho se achicó, mete de vuelta lo que quede fuera.
  colocadas.forEach((v) => {
    if (v.w > COLS) v.w = COLS;
    if (v.c + v.w > COLS) v.c = COLS - v.w;
    if (v.c < 0) v.c = 0;
  });

  const filaMasBaja = colocadas.reduce((max, v) => Math.max(max, v.r + v.h), 0);
  FILAS = Math.min(MAX_FILAS, Math.max(filasVisibles, filaMasBaja));

  lienzo.style.width = COLS * PASO - SEP + 'px';
  lienzo.style.height = FILAS * PASO - SEP + 'px';
}

function pintarCeldas() {
  contenedorCeldas.innerHTML = '';
  const fragmento = document.createDocumentFragment();
  for (let r = 0; r < FILAS; r++) {
    for (let c = 0; c < COLS; c++) {
      const celda = document.createElement('div');
      celda.className = 'celda';
      celda.style.left = c * PASO + 'px';
      celda.style.top = r * PASO + 'px';
      celda.style.width = CELDA + 'px';
      celda.style.height = CELDA + 'px';
      fragmento.appendChild(celda);
    }
  }
  contenedorCeldas.appendChild(fragmento);
}

// Coloca un elemento (.ventana o el fantasma) en el rectángulo de cuadros.
function posicionarEn(elemento, rect) {
  elemento.style.left = rect.c * PASO + 'px';
  elemento.style.top = rect.r * PASO + 'px';
  elemento.style.width = rect.w * PASO - SEP + 'px';
  elemento.style.height = rect.h * PASO - SEP + 'px';
}

// ¿Cabe este rectángulo? (dentro de la cuadrícula y sin encimarse con
// otra ventana). "exceptoId" es la ventana que se está moviendo/redimen-
// sionando, que no cuenta como choque consigo misma.
function cabe(rect, exceptoId) {
  if (rect.w < 1 || rect.h < 1) return false;
  if (rect.c < 0 || rect.r < 0) return false;
  if (rect.c + rect.w > COLS) return false;
  if (rect.r + rect.h > MAX_FILAS) return false;
  return !colocadas.some(
    (v) =>
      v.id !== exceptoId &&
      rect.c < v.c + v.w &&
      rect.c + rect.w > v.c &&
      rect.r < v.r + v.h &&
      rect.r + rect.h > v.r
  );
}

function mostrarFantasma(rect, valido) {
  posicionarEn(fantasma, rect);
  fantasma.className = 'fantasma ' + (valido ? 'ok' : 'no');
  fantasma.hidden = false;
}

function ocultarFantasma() {
  fantasma.hidden = true;
}

// ===================== Ventanas =====================

function sincronizarVentanas() {
  // Quita elementos de ventanas que ya no están colocadas.
  for (const [id, elemento] of elementos) {
    if (!colocadas.some((v) => v.id === id)) {
      elemento.remove();
      elementos.delete(id);
    }
  }
  // Crea las que falten y reposiciona todas.
  colocadas.forEach((v) => {
    let elemento = elementos.get(v.id);
    if (!elemento) {
      elemento = crearVentana(v);
      elementos.set(v.id, elemento);
      lienzo.appendChild(elemento);
    }
    posicionarEn(elemento, v);
  });

  pistaVacio.hidden = colocadas.length > 0;
}

function crearVentana(v) {
  const meta = VENTANA_POR_ID[v.id];

  const elemento = document.createElement('div');
  elemento.className = 'ventana';
  elemento.dataset.id = v.id;

  const barra = document.createElement('div');
  barra.className = 'barra-ventana';

  const icono = document.createElement('span');
  icono.textContent = meta.icono;
  const titulo = document.createElement('span');
  titulo.className = 'titulo';
  titulo.textContent = meta.nombre;

  const botonAbrir = document.createElement('button');
  botonAbrir.type = 'button';
  botonAbrir.title = 'Abrir en pantalla completa';
  botonAbrir.textContent = '⤢';
  botonAbrir.addEventListener('click', () => {
    window.location.href = meta.url;
  });

  const botonQuitar = document.createElement('button');
  botonQuitar.type = 'button';
  botonQuitar.title = 'Quitar del escritorio';
  botonQuitar.textContent = '✕';
  botonQuitar.addEventListener('click', () => quitarVentana(v.id));

  barra.append(icono, titulo, botonAbrir, botonQuitar);

  const marco = document.createElement('iframe');
  marco.src = meta.url;
  marco.title = meta.nombre;

  elemento.append(barra, marco);

  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((tipo) => {
    const asa = document.createElement('div');
    asa.className = 'asa asa-' + tipo;
    asa.addEventListener('pointerdown', (evento) => iniciarRedimension(evento, v.id, tipo));
    elemento.appendChild(asa);
  });

  barra.addEventListener('pointerdown', (evento) => {
    if (evento.target.closest('button')) return;
    iniciarMovimiento(evento, v.id);
  });

  return elemento;
}

function quitarVentana(id) {
  colocadas = colocadas.filter((v) => v.id !== id);
  aplicarCambios();
}

// Recalcula la cuadrícula (por si cambió la fila más baja), repinta las
// celdas, reposiciona las ventanas y guarda.
function aplicarCambios() {
  recalcularCuadricula();
  pintarCeldas();
  sincronizarVentanas();
  guardar();
  if (!cajaFondo.hidden) pintarListaPiezas();
}

// ===================== Arrastre (común) =====================

// Pone una capa transparente sobre todo (para que los iframes no roben
// el puntero) y engancha pointermove/pointerup hasta que se suelta.
function conArrastre(cursor, alMover, alSoltar) {
  const capa = document.createElement('div');
  capa.className = 'capa-arrastre';
  capa.style.cursor = cursor;
  document.body.appendChild(capa);

  function mover(evento) {
    alMover(evento);
  }
  function soltar(evento) {
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    capa.remove();
    ocultarFantasma();
    alSoltar(evento);
  }

  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
}

function celdasDesde(px) {
  return Math.round(px / PASO);
}

// ===================== Mover una ventana =====================

function iniciarMovimiento(evento, id) {
  evento.preventDefault();
  const v = colocadas.find((x) => x.id === id);
  if (!v) return;

  const xInicial = evento.clientX;
  const yInicial = evento.clientY;
  const cInicial = v.c;
  const rInicial = v.r;
  let candidato = { ...v };

  conArrastre(
    'move',
    (ev) => {
      const dc = celdasDesde(ev.clientX - xInicial);
      const dr = celdasDesde(ev.clientY - yInicial);
      let c = Math.min(Math.max(0, cInicial + dc), Math.max(0, COLS - v.w));
      let r = Math.max(0, rInicial + dr);
      candidato = { id, c, r, w: v.w, h: v.h };
      mostrarFantasma(candidato, cabe(candidato, id));
    },
    () => {
      if (cabe(candidato, id)) {
        v.c = candidato.c;
        v.r = candidato.r;
        aplicarCambios();
      }
    }
  );
}

// ===================== Redimensionar =====================

function iniciarRedimension(evento, id, tipo) {
  evento.preventDefault();
  evento.stopPropagation();
  const v = colocadas.find((x) => x.id === id);
  if (!v) return;

  const xInicial = evento.clientX;
  const yInicial = evento.clientY;
  const inicio = { ...v };
  let candidato = { ...v };

  const cursor = {
    n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
    ne: 'nesw-resize', sw: 'nesw-resize', nw: 'nwse-resize', se: 'nwse-resize'
  }[tipo];

  conArrastre(
    cursor,
    (ev) => {
      const dc = celdasDesde(ev.clientX - xInicial);
      const dr = celdasDesde(ev.clientY - yInicial);

      let { c, r, w, h } = inicio;

      if (tipo.includes('e')) {
        w = Math.max(1, inicio.w + dc);
      }
      if (tipo.includes('s')) {
        h = Math.max(1, inicio.h + dr);
      }
      if (tipo.includes('w')) {
        // El borde derecho queda fijo en inicio.c + inicio.w.
        c = Math.max(0, Math.min(inicio.c + dc, inicio.c + inicio.w - 1));
        w = inicio.c + inicio.w - c;
      }
      if (tipo.includes('n')) {
        // El borde inferior queda fijo en inicio.r + inicio.h.
        r = Math.max(0, Math.min(inicio.r + dr, inicio.r + inicio.h - 1));
        h = inicio.r + inicio.h - r;
      }

      candidato = { id, c, r, w, h };
      mostrarFantasma(candidato, cabe(candidato, id));
    },
    () => {
      if (cabe(candidato, id)) {
        Object.assign(v, { c: candidato.c, r: candidato.r, w: candidato.w, h: candidato.h });
        aplicarCambios();
      }
    }
  );
}

// ===================== Caja de piezas =====================

function abrirCaja() {
  pintarListaPiezas();
  cajaFondo.hidden = false;
}

function cerrarCaja() {
  cajaFondo.hidden = true;
}

function pintarListaPiezas() {
  listaPiezas.innerHTML = '';
  const disponibles = VENTANAS.filter((v) => !colocadas.some((x) => x.id === v.id));

  if (disponibles.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'vacio';
    vacio.textContent = 'Ya agregaste todas las ventanas al escritorio.';
    listaPiezas.appendChild(vacio);
    return;
  }

  disponibles.forEach((v) => {
    const pieza = document.createElement('button');
    pieza.type = 'button';
    pieza.className = 'pieza';

    const icono = document.createElement('span');
    icono.textContent = v.icono;
    pieza.append(icono, document.createTextNode(' ' + v.nombre));

    pieza.addEventListener('pointerdown', (evento) => iniciarColocacion(evento, v.id));
    listaPiezas.appendChild(pieza);
  });
}

// Arrastrar una pieza de la caja al lienzo. Cae ocupando un cuadro.
function iniciarColocacion(evento, id) {
  evento.preventDefault();
  cerrarCaja();

  let candidato = null;

  conArrastre(
    'grabbing',
    (ev) => {
      const areaLienzo = lienzo.getBoundingClientRect();
      const areaScroll = lienzoScroll.getBoundingClientRect();

      const dentro =
        ev.clientX >= areaScroll.left &&
        ev.clientX <= areaScroll.right &&
        ev.clientY >= areaScroll.top &&
        ev.clientY <= areaScroll.bottom;

      if (!dentro) {
        candidato = null;
        ocultarFantasma();
        return;
      }

      const c = Math.max(0, Math.min(COLS - 1, Math.floor((ev.clientX - areaLienzo.left) / PASO)));
      const r = Math.max(0, Math.min(MAX_FILAS - 1, Math.floor((ev.clientY - areaLienzo.top) / PASO)));
      candidato = { id, c, r, w: 1, h: 1 };
      mostrarFantasma(candidato, cabe(candidato, id));
    },
    () => {
      if (candidato && cabe(candidato, id)) {
        colocadas.push(candidato);
        aplicarCambios();
      } else {
        // No se soltó en un lugar válido: se reabre la caja para
        // volver a intentar.
        abrirCaja();
      }
    }
  );
}
