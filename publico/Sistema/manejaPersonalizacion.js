// manejaPersonalizacion.js
// -------------------------------------------------------------------
// "Personalización": deja elegir el modo de color de la plataforma.
// Elegir un modo cambia: el color de acento del sitio (botones, casillas
// activas, bordes — la variable CSS --color-primario), su tinte claro
// para fondos (--color-primario-suave), el ícono y el nombre "ARTONSELEY"
// de la barra superior (dos imágenes separadas), y el ícono que da
// vueltas mientras se busca. La elección se guarda en este navegador
// (localStorage), así que se recuerda la próxima vez que se abra la
// página.
//
// Se usa de dos formas:
//   - En configuracion.html (pantalla completa): renderizarPersonalizacionEn(elemento)
//     pinta el selector dentro de una sección de esa página.
//   - En editor.html (todavía con paneles laterales): inicializarPersonalizacion()
//     crea el panel flotante y alternarPanelPersonalizacion() lo abre/cierra.
//   - En cualquier página que solo necesite aplicar el color guardado sin
//     mostrar el selector (buscador.html, index.html, escritorio.html…): aplicarModoGuardado().
// -------------------------------------------------------------------
// CÓMO AGREGAR UN MODO NUEVO:
//   Opción A — tiene sus propias imágenes de logo:
//     1) Copia sus dos imágenes a publico/imagenes/: el ícono (logo
//        redondo, sin texto — también se usa mientras se busca) y el
//        nombre "ARTONSELEY" solo (sin el ícono), ambos con fondo
//        transparente.
//     2) Agrega una línea a MODOS con color / colorSuave / logoIcono /
//        logoLetras, copiando la forma de la del modo Azul.
//   Opción B — reusar el logo azul pero teñido a otro color (lo que hace
//   el modo Morado): agrega la línea con color / colorSuave y
//   `recolorLogo: true`, y deja logoIcono / logoLetras apuntando a las
//   mismas imágenes azules. Un filtro SVG (feColorMatrix, ver
//   asegurarFiltrosLogo más abajo) mapea el azul exacto del logo al
//   color del modo dejando el blanco en blanco — no hacen falta PNGs
//   nuevos.
//   Con cualquiera de las dos, el selector, el color de acento y las
//   imágenes se actualizan solos al elegir el modo.
// -------------------------------------------------------------------

import { alternarPanelLateral } from './manejaPanelesLaterales.js';

const CLAVE_ALMACENAMIENTO = 'modoPersonalizacion';

const MODOS = [
  {
    id: 'azul',
    nombre: 'Azul (clásico)',
    color: '#2A6BAF',
    colorSuave: '#eef4fb',
    // Versiones con fondo transparente: el ícono "PAGINA" (el compás) y
    // el nombre "ARTONSELEY" en trazo grueso.
    logoIcono: 'imagenes/artonseley-pagina.png',
    logoLetras: 'imagenes/artonseley-letras.png'
  },
  {
    id: 'morado',
    nombre: 'Morado',
    color: '#8b0999',
    // Mismo tinte que el azul (~8 % del acento sobre blanco), en morado.
    colorSuave: '#f6ebf7',
    // Reutiliza las MISMAS imágenes que el azul; recolorLogo hace que se
    // tiñan a #8b0999 con el filtro SVG (ver asegurarFiltrosLogo). Un
    // color de por sí no está sujeto a derechos de autor, así que teñir
    // el logo propio de la marca a este tono no plantea ningún problema.
    logoIcono: 'imagenes/artonseley-pagina.png',
    logoLetras: 'imagenes/artonseley-letras.png',
    recolorLogo: true
  }
];

// Azul EXACTO (muestreado del PNG) de cada una de las dos imágenes del
// logo. El recolor mapea este color al color del modo; son distintos
// entre sí, por eso hay un filtro por imagen.
const BASE_LOGO_ICONO = [14, 99, 188];    // #0e63bc  (artonseley-pagina.png)
const BASE_LOGO_LETRAS = [43, 108, 176];  // #2b6cb0  (artonseley-letras.png)

const SVG_NS = 'http://www.w3.org/2000/svg';
const ID_FILTRO_ICONO = 'artonseleyRecolorLogoIcono';
const ID_FILTRO_LETRAS = 'artonseleyRecolorLogoLetras';

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

// El valor CSS `filter` que va sobre el ícono que da vueltas mientras se
// busca (lo pone buscadorPrincipal.js). 'none' en el modo azul.
export function filtroLogoBusqueda() {
  return modoActual.recolorLogo ? `url("#${ID_FILTRO_ICONO}")` : 'none';
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

// hex "#rrggbb" -> [r, g, b] (0-255).
function hexARgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Construye el atributo `values` de un <feColorMatrix type="matrix">
// (4 filas × 5 columnas) que mapea:
//   - el azul base del logo  -> el color objetivo (exacto),
//   - el blanco               -> blanco,
//   - el negro                -> negro,
// dejando el canal alfa intacto. Cada fila de salida es [0, y, z, 0, 0]
// con y + z = 1 (eso garantiza blanco->blanco y negro->negro) y
// y·baseG + z·baseB = objetivo  =>  y = (baseB - objetivo) / (baseB - baseG).
function valoresMatrizRecolor(baseRgb, objetivoHex) {
  const g = baseRgb[1] / 255;
  const b = baseRgb[2] / 255;
  const [tr, tg, tb] = hexARgb(objetivoHex).map((v) => v / 255);

  if (Math.abs(b - g) < 0.02) {
    // El azul base tendría los canales G y B casi iguales: la fórmula se
    // vuelve inestable. Es un caso que no ocurre con los logos actuales;
    // si llegara a ocurrir, no se recolorea (identidad).
    return '1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0';
  }

  const fila = (objetivo) => {
    const y = (b - objetivo) / (b - g);
    return `0 ${y.toFixed(5)} ${(1 - y).toFixed(5)} 0 0`;
  };

  return `${fila(tr)}  ${fila(tg)}  ${fila(tb)}  0 0 0 1 0`;
}

// Inyecta una sola vez un <svg> oculto con los dos filtros de recolor del
// logo (uno para el ícono, otro para las letras — su azul base difiere).
// color-interpolation-filters="sRGB" es importante: sin él el navegador
// haría la mezcla en espacio lineal y el color saldría oscurecido.
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

function aplicarModo(modo) {
  const raiz = document.documentElement.style;
  raiz.setProperty('--color-primario', modo.color);
  raiz.setProperty('--color-primario-suave', modo.colorSuave || '#eef4fb');

  asegurarFiltrosLogo();

  // Ajusta cada filtro al color de ESTE modo (aunque no se use en el
  // modo azul, dejarlo al día no cuesta nada y evita sorpresas).
  const matrizIcono = document.querySelector(`#${ID_FILTRO_ICONO} feColorMatrix`);
  if (matrizIcono) matrizIcono.setAttribute('values', valoresMatrizRecolor(BASE_LOGO_ICONO, modo.color));
  const matrizLetras = document.querySelector(`#${ID_FILTRO_LETRAS} feColorMatrix`);
  if (matrizLetras) matrizLetras.setAttribute('values', valoresMatrizRecolor(BASE_LOGO_LETRAS, modo.color));

  const filtroIcono = modo.recolorLogo ? `url("#${ID_FILTRO_ICONO}")` : '';
  const filtroLetras = modo.recolorLogo ? `url("#${ID_FILTRO_LETRAS}")` : '';

  // Cubre las tres formas en que las páginas marcan el logo de la barra:
  // #iconoMarca/#letrasMarca (index, buscador, editor), .marca-mini
  // img.icono/.letras (escritorio, calendario, pestañas) y .marca
  // img.icono/.letras (plantillas).
  document.querySelectorAll('#iconoMarca, .marca-mini img.icono, .marca img.icono').forEach((img) => {
    img.src = modo.logoIcono;
    img.style.filter = filtroIcono;
  });
  document.querySelectorAll('#letrasMarca, .marca-mini img.letras, .marca img.letras').forEach((img) => {
    img.src = modo.logoLetras;
    img.style.filter = filtroLetras;
  });
}

export function alternarPanelPersonalizacion() {
  alternarPanelLateral(panel);
}
