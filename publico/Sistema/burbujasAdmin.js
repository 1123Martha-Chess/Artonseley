// burbujasAdmin.js
// -------------------------------------------------------------------
// Convierte cada <section class="tarjeta"> de admin.html en una
// "burbuja": un rectángulo de esquinas redondeadas que solo muestra su
// ícono y su título. Al tocarla NO se abre ningún menú ni ventana
// nueva — la misma burbuja se extiende dentro de la rejilla (ocupa 2
// columnas y las filas que necesite su contenido) y el resto de las
// burbujas se acomoda alrededor. Solo hay una abierta a la vez; tocar
// su encabezado (o la ✕) la vuelve a cerrar.
//
// La rejilla tiene filas de altura fija (ver --alto-fila-burbujas en
// el <style> de admin.html), así que la burbuja abierta calcula
// cuántas filas abarcar según la altura real de su contenido, y lo
// recalcula con un ResizeObserver cada vez que ese contenido cambia
// (listas que terminan de cargar, mensajes de error, etc.).
// -------------------------------------------------------------------

let burbujaAbierta = null;
let rejilla = null;

// Vuelve a calcular cuántas filas de la rejilla necesita la burbuja
// abierta para que su contenido quepa completo, sin scroll interno.
function ajustarFilas() {
  if (!burbujaAbierta) return;
  const estilo = getComputedStyle(rejilla);
  const altoFila = parseFloat(estilo.gridAutoRows) || 110;
  const hueco = parseFloat(estilo.rowGap) || 0;

  // La burbuja es position: relative, así que offsetTop del cuerpo ya
  // incluye el título y sus márgenes; el cuerpo es display: flow-root
  // para que el margen de su último hijo también cuente en su alto.
  const estiloBurbuja = getComputedStyle(burbujaAbierta);
  const cuerpo = burbujaAbierta.querySelector('.cuerpo-burbuja');
  const altoNecesario = cuerpo.offsetTop + cuerpo.offsetHeight
    + parseFloat(estiloBurbuja.paddingBottom)
    + parseFloat(estiloBurbuja.borderTopWidth) + parseFloat(estiloBurbuja.borderBottomWidth);

  const filas = Math.max(1, Math.ceil((altoNecesario + hueco) / (altoFila + hueco)));
  burbujaAbierta.style.gridRow = `span ${filas}`;
}

const observador = new ResizeObserver(() => ajustarFilas());

function cerrarBurbuja() {
  if (!burbujaAbierta) return;
  observador.unobserve(burbujaAbierta.querySelector('.cuerpo-burbuja'));
  burbujaAbierta.classList.remove('abierta');
  burbujaAbierta.style.gridRow = '';
  burbujaAbierta.querySelector('.cabecera-burbuja').setAttribute('aria-expanded', 'false');
  burbujaAbierta = null;
}

function abrirBurbuja(seccion, { desplazar = true } = {}) {
  if (burbujaAbierta === seccion) return;
  cerrarBurbuja();
  burbujaAbierta = seccion;
  seccion.classList.add('abierta');
  seccion.querySelector('.cabecera-burbuja').setAttribute('aria-expanded', 'true');
  ajustarFilas();
  observador.observe(seccion.querySelector('.cuerpo-burbuja'));
  if (desplazar) seccion.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Para manejaAdmin.js: cuando un botón de una burbuja lleva a un
// formulario que vive en OTRA burbuja (ej. "Reemplazar" en la lista de
// documentos → formulario de carga), primero hay que abrir esa otra.
export function abrirBurbujaQueContiene(elemento) {
  const seccion = elemento.closest('section.tarjeta');
  if (seccion) abrirBurbuja(seccion, { desplazar: false });
}

function prepararBurbuja(seccion) {
  const titulo = seccion.querySelector('h2');

  // Todo lo que no es el título se mete en un contenedor que se oculta
  // mientras la burbuja está cerrada.
  const cuerpo = document.createElement('div');
  cuerpo.classList.add('cuerpo-burbuja');
  [...seccion.children].forEach((hijo) => {
    if (hijo !== titulo) cuerpo.appendChild(hijo);
  });
  seccion.appendChild(cuerpo);

  // El título se vuelve un botón (accesible con teclado) con su ícono
  // y una ✕ que solo se ve cuando está abierta.
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.classList.add('cabecera-burbuja');
  boton.setAttribute('aria-expanded', 'false');

  const icono = document.createElement('span');
  icono.classList.add('icono-burbuja');
  icono.setAttribute('aria-hidden', 'true');
  icono.textContent = seccion.dataset.icono || '📁';

  const texto = document.createElement('span');
  texto.classList.add('texto-burbuja');
  texto.textContent = titulo.textContent;

  const cerrar = document.createElement('span');
  cerrar.classList.add('cerrar-burbuja');
  cerrar.setAttribute('aria-hidden', 'true');
  cerrar.textContent = '✕';

  boton.append(icono, texto, cerrar);
  titulo.textContent = '';
  titulo.appendChild(boton);

  boton.addEventListener('click', () => {
    if (burbujaAbierta === seccion) cerrarBurbuja();
    else abrirBurbuja(seccion);
  });
}

function inicializar() {
  rejilla = document.querySelector('main.rejilla-burbujas');
  if (!rejilla) return;
  rejilla.querySelectorAll(':scope > section.tarjeta').forEach(prepararBurbuja);
  // Al cambiar el ancho de la ventana cambian las columnas y el alto
  // del contenido, así que se recalculan las filas.
  window.addEventListener('resize', ajustarFilas);
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && burbujaAbierta && !document.querySelector('.fondo-modal')) {
      const seccion = burbujaAbierta;
      cerrarBurbuja();
      seccion.querySelector('.cabecera-burbuja').focus();
    }
  });
}

inicializar();
