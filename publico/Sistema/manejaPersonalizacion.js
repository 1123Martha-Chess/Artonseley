// manejaPersonalizacion.js
// -------------------------------------------------------------------
// "Personalización": dos ejes INDEPENDIENTES que el usuario elige en
// Configuración y se guardan en este navegador (localStorage):
//
//   - COLOR de acento:  Azul (clásico)  /  Morado
//        cambia --color-primario y --color-primario-suave, y tiñe el
//        logo de la barra (ícono + nombre) al color elegido.
//   - TEMA:             Claro  /  Oscuro
//        pone <html data-tema="oscuro"> (o lo quita), lo que activa el
//        bloque oscuro de tema.css, y ajusta color-scheme.
//
// Se combinan libremente (azul+oscuro, morado+claro, …). Sin nada
// guardado: Azul + Claro, el aspecto original del sitio.
//
// El parpadeo claro→oscuro al cargar lo evita Sistema/temaGuardado.js
// (script bloqueante en el <head>); este módulo, que va diferido,
// re-aplica todo (es idempotente), tiñe el logo y pinta el selector.
//
// Se usa así:
//   - configuracion.html:  renderizarPersonalizacionEn(elemento)
//   - editor.html (panel flotante):  inicializarPersonalizacion() +
//     alternarPanelPersonalizacion()
//   - cualquier otra página:  aplicarModoGuardado()
// -------------------------------------------------------------------
// CÓMO AGREGAR UN COLOR NUEVO:
//   - Con PNGs propios de logo: agrega una entrada a COLORES con color /
//     suaveClaro / suaveOscuro / logoIcono / logoLetras.
//   - Reusando el logo azul teñido (como "Morado"): igual, pero deja
//     logoIcono/logoLetras en los PNG azules y pon `recolorLogo: true`.
//     Un <filter> SVG (feColorMatrix, ver asegurarFiltrosLogo) mapea el
//     azul exacto del logo al color del modo dejando el blanco en blanco.
//   Además, agrega esos mismos valores a Sistema/temaGuardado.js (las 4
//   constantes duplicadas) para que no haya parpadeo.
// -------------------------------------------------------------------

import { alternarPanelLateral } from './manejaPanelesLaterales.js';

const CLAVE_COLOR = 'modoPersonalizacion';
const CLAVE_TEMA = 'temaPersonalizacion';

const COLORES = [
  {
    id: 'azul',
    nombre: 'Azul (clásico)',
    color: '#2A6BAF',
    suaveClaro: '#eef4fb',
    suaveOscuro: '#1b2735',
    logoIcono: 'imagenes/artonseley-pagina.png',
    logoLetras: 'imagenes/artonseley-letras.png'
  },
  {
    id: 'morado',
    nombre: 'Morado',
    color: '#8b0999',
    suaveClaro: '#f6ebf7',
    suaveOscuro: '#241026',
    logoIcono: 'imagenes/artonseley-pagina.png',
    logoLetras: 'imagenes/artonseley-letras.png',
    recolorLogo: true
  }
];

const TEMAS = [
  { id: 'claro', nombre: 'Claro' },
  { id: 'oscuro', nombre: 'Oscuro' }
];

// Azul EXACTO (muestreado del PNG) de cada imagen del logo. El recolor
// mapea este color al color elegido; difieren, por eso hay un filtro por
// imagen.
const BASE_LOGO_ICONO = [14, 99, 188];    // #0e63bc  (artonseley-pagina.png)
const BASE_LOGO_LETRAS = [43, 108, 176];  // #2b6cb0  (artonseley-letras.png)

const SVG_NS = 'http://www.w3.org/2000/svg';
const ID_FILTRO_ICONO = 'artonseleyRecolorLogoIcono';
const ID_FILTRO_LETRAS = 'artonseleyRecolorLogoLetras';

let panel = null;
let colorActual = leerGuardado(CLAVE_COLOR, COLORES);
let temaActual = leerGuardado(CLAVE_TEMA, TEMAS);

function leerGuardado(clave, lista) {
  try {
    const id = localStorage.getItem(clave);
    return lista.find((x) => x.id === id) || lista[0];
  } catch {
    return lista[0];
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    // Sin localStorage: la elección sigue aplicada en esta visita, solo
    // no se recuerda la próxima vez.
  }
}

// Lo usa buscadorPrincipal.js para el ícono que da vueltas al buscar.
export function obtenerModoActual() {
  return colorActual;
}

// El valor CSS `filter` para ese ícono ('none' salvo en Morado).
export function filtroLogoBusqueda() {
  return colorActual.recolorLogo ? `url("#${ID_FILTRO_ICONO}")` : 'none';
}

// Aplica color + tema guardados, sin pintar selector. Para páginas que
// solo heredan la personalización.
export function aplicarModoGuardado() {
  aplicar();
}

function aplicar() {
  const raiz = document.documentElement;

  raiz.style.setProperty('--color-primario', colorActual.color);
  raiz.style.setProperty(
    '--color-primario-suave',
    temaActual.id === 'oscuro' ? colorActual.suaveOscuro : colorActual.suaveClaro
  );

  // El tema claro/oscuro solo se aplica en páginas que enlazan tema.css
  // (las ya convertidas). En las demás (editor, escritorio, calendario,
  // música, calculadora, plantillas, admin — pendientes de una etapa
  // siguiente) poner data-tema no cambiaría nada visible y solo haría
  // desentonar los controles nativos; ahí solo se aplica el color de
  // acento, como hasta ahora.
  const paginaConTema = !!document.querySelector('link[href*="tema.css"]');
  if (paginaConTema && temaActual.id === 'oscuro') {
    raiz.setAttribute('data-tema', 'oscuro');
    raiz.style.colorScheme = 'dark';
  } else {
    raiz.removeAttribute('data-tema');
    raiz.style.colorScheme = paginaConTema ? 'light' : '';
  }

  asegurarFiltrosLogo();

  const matrizIcono = document.querySelector(`#${ID_FILTRO_ICONO} feColorMatrix`);
  if (matrizIcono) matrizIcono.setAttribute('values', valoresMatrizRecolor(BASE_LOGO_ICONO, colorActual.color));
  const matrizLetras = document.querySelector(`#${ID_FILTRO_LETRAS} feColorMatrix`);
  if (matrizLetras) matrizLetras.setAttribute('values', valoresMatrizRecolor(BASE_LOGO_LETRAS, colorActual.color));

  const filtroIcono = colorActual.recolorLogo ? `url("#${ID_FILTRO_ICONO}")` : '';
  const filtroLetras = colorActual.recolorLogo ? `url("#${ID_FILTRO_LETRAS}")` : '';

  // Cubre las tres formas en que las páginas marcan el logo de la barra:
  // #iconoMarca/#letrasMarca (index, buscador, editor), .marca-mini
  // img.icono/.letras (escritorio, calendario, pestañas) y .marca
  // img.icono/.letras (plantillas).
  document.querySelectorAll('#iconoMarca, .marca-mini img.icono, .marca img.icono').forEach((img) => {
    img.src = colorActual.logoIcono;
    img.style.filter = filtroIcono;
  });
  document.querySelectorAll('#letrasMarca, .marca-mini img.letras, .marca img.letras').forEach((img) => {
    img.src = colorActual.logoLetras;
    img.style.filter = filtroLetras;
  });
}

// ===================== Selector =====================

function pintarSelector(destino, incluirTitulo) {
  destino.innerHTML = '';

  if (incluirTitulo) {
    const titulo = document.createElement('h3');
    titulo.textContent = 'Personalización';
    destino.appendChild(titulo);
  }

  const descripcion = document.createElement('p');
  descripcion.textContent = 'Elige el color y el tema de la plataforma. Se combinan libremente.';
  destino.appendChild(descripcion);

  pintarGrupo(destino, 'Color', COLORES, colorActual, (elegido) => {
    colorActual = elegido;
    guardar(CLAVE_COLOR, elegido.id);
    aplicar();
    pintarSelector(destino, incluirTitulo);
  });

  pintarGrupo(destino, 'Tema', TEMAS, temaActual, (elegido) => {
    temaActual = elegido;
    guardar(CLAVE_TEMA, elegido.id);
    aplicar();
    pintarSelector(destino, incluirTitulo);
  });
}

function pintarGrupo(destino, etiqueta, lista, actual, alElegir) {
  const grupo = document.createElement('div');
  grupo.style.margin = '12px 0 2px 0';

  const rotulo = document.createElement('div');
  rotulo.textContent = etiqueta;
  rotulo.style.cssText =
    'font-family:Arial,sans-serif;font-size:12px;font-weight:bold;margin-bottom:6px;color:var(--texto-2,#555);';
  grupo.appendChild(rotulo);

  lista.forEach((opcion) => {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.classList.add('boton-checkbox');
    boton.classList.toggle('activo', opcion.id === actual.id);
    boton.textContent = opcion.nombre;
    boton.addEventListener('click', () => alElegir(opcion));
    grupo.appendChild(boton);
  });

  destino.appendChild(grupo);
}

// Para configuracion.html.
export function renderizarPersonalizacionEn(elemento) {
  if (!elemento) {
    console.error('manejaPersonalizacion.js: renderizarPersonalizacionEn recibió un elemento vacío.');
    return;
  }
  aplicar();
  pintarSelector(elemento, false);
}

// Para editor.html (panel flotante lateral).
export function inicializarPersonalizacion() {
  aplicar();

  panel = document.createElement('aside');
  panel.id = 'panelPersonalizacion';
  panel.className = 'panel-sugerencias';
  document.body.appendChild(panel);

  pintarSelector(panel, true);
}

export function alternarPanelPersonalizacion() {
  alternarPanelLateral(panel);
}

// ===================== Recolor del logo (filtro SVG) =====================

function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Atributo `values` de un <feColorMatrix type="matrix"> que mapea el azul
// base del logo -> color objetivo (exacto), blanco -> blanco y negro ->
// negro, sin tocar el alfa. Cada fila de salida es [0, y, z, 0, 0] con
// y + z = 1 y  y·baseG + z·baseB = objetivo.
function valoresMatrizRecolor(baseRgb, objetivoHex) {
  const g = baseRgb[1] / 255;
  const b = baseRgb[2] / 255;
  const [tr, tg, tb] = hexARgb(objetivoHex).map((v) => v / 255);

  if (Math.abs(b - g) < 0.02) {
    return '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0';
  }

  const fila = (objetivo) => {
    const y = (b - objetivo) / (b - g);
    return `0 ${y.toFixed(5)} ${(1 - y).toFixed(5)} 0 0`;
  };

  return `${fila(tr)}  ${fila(tg)}  ${fila(tb)}  0 0 0 1 0`;
}

function asegurarFiltrosLogo() {
  if (!document.body || document.getElementById('artonseleyFiltrosLogo')) return;

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.id = 'artonseleyFiltrosLogo';
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';

  for (const id of [ID_FILTRO_ICONO, ID_FILTRO_LETRAS]) {
    const filtro = document.createElementNS(SVG_NS, 'filter');
    filtro.setAttribute('id', id);
    filtro.setAttribute('color-interpolation-filters', 'sRGB');
    const matriz = document.createElementNS(SVG_NS, 'feColorMatrix');
    matriz.setAttribute('type', 'matrix');
    matriz.setAttribute('values', '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0');
    filtro.appendChild(matriz);
    svg.appendChild(filtro);
  }

  document.body.appendChild(svg);
}
