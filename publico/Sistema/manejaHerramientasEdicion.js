// manejaHerramientasEdicion.js
// -------------------------------------------------------------------
// Barra de herramientas de edición de texto que vive arriba del área de
// escritura de un cuaderno (ver editor.html / editorPrincipal.js). Usa
// document.execCommand() sobre el <div contenteditable>: es una API
// vieja del navegador (ya no se agregan comandos nuevos), pero para lo
// que pide este editor — negrita, cursiva, subrayado, tachado,
// marcatextos, color de texto, tipografía, tamaño, alineación, listas,
// sangría, deshacer/rehacer, quitar formato, superíndice/subíndice —
// sigue funcionando en todos los navegadores de escritorio y evita
// meter una librería externa solo para esto.
//
// El HTML que resulta de estos comandos (<b>, <font color=...>, etc.) es
// justo lo que formatoTextoPlano.js sabe convertir de ida y vuelta al
// exportar/importar un cuaderno.
// -------------------------------------------------------------------
// CÓMO AGREGAR UNA FUENTE O UN TAMAÑO MÁS:
//   Agrega una línea a FUENTES o a TAMANOS aquí abajo — el selector se
//   arma solo a partir de esos arreglos.
// -------------------------------------------------------------------

// 5 tipografías bien distintas entre sí. Se usan las que ya trae el
// sistema operativo (no se descarga ninguna fuente web): así el
// selector funciona igual de rápido sin conexión y sin tener que tocar
// la política de seguridad de contenido (CSP) del servidor para permitir
// cargar fuentes externas.
const FUENTES = [
  { nombre: 'Arial', pila: 'Arial, sans-serif' },
  { nombre: 'Georgia', pila: 'Georgia, serif' },
  { nombre: 'Times New Roman', pila: "'Times New Roman', serif" },
  { nombre: 'Courier New', pila: "'Courier New', monospace" },
  { nombre: 'Verdana', pila: 'Verdana, sans-serif' }
];

// document.execCommand('fontSize', ...) solo admite esta escala fija de
// 7 tamaños (no un número de puntos libre), así que cada uno se etiqueta
// con lo que representa en vez de mostrar el número crudo.
const TAMANOS = [
  { valor: '1', etiqueta: 'Muy chica' },
  { valor: '2', etiqueta: 'Chica' },
  { valor: '3', etiqueta: 'Normal' },
  { valor: '4', etiqueta: 'Mediana' },
  { valor: '5', etiqueta: 'Grande' },
  { valor: '6', etiqueta: 'Muy grande' },
  { valor: '7', etiqueta: 'Enorme' }
];

// Etiquetas N/K/S/T para negrita/cursiva/subrayado/tachado: es la misma
// convención que usa Word en español, y cada botón se ve como lo que
// hace (negrita de verdad, cursiva de verdad...) gracias a "estilo".
const BOTONES_SIMPLES = [
  { comando: 'bold', etiqueta: 'N', titulo: 'Negrita', estilo: 'font-weight:bold' },
  { comando: 'italic', etiqueta: 'K', titulo: 'Cursiva', estilo: 'font-style:italic' },
  { comando: 'underline', etiqueta: 'S', titulo: 'Subrayado', estilo: 'text-decoration:underline' },
  { comando: 'strikeThrough', etiqueta: 'T', titulo: 'Tachado', estilo: 'text-decoration:line-through' }
];

const BOTONES_ALINEACION = [
  { comando: 'justifyLeft', etiqueta: 'Izq.', titulo: 'Alinear a la izquierda' },
  { comando: 'justifyCenter', etiqueta: 'Centro', titulo: 'Centrar' },
  { comando: 'justifyRight', etiqueta: 'Der.', titulo: 'Alinear a la derecha' },
  { comando: 'justifyFull', etiqueta: 'Justif.', titulo: 'Justificar' }
];

const BOTONES_LISTA = [
  { comando: 'insertUnorderedList', etiqueta: '• Lista', titulo: 'Lista con viñetas' },
  { comando: 'insertOrderedList', etiqueta: '1. Lista', titulo: 'Lista numerada' }
];

const BOTONES_SANGRIA = [
  { comando: 'indent', etiqueta: 'Sangría »', titulo: 'Aumentar sangría' },
  { comando: 'outdent', etiqueta: '« Sangría', titulo: 'Disminuir sangría' }
];

const BOTONES_HISTORIAL = [
  { comando: 'undo', etiqueta: '↶', titulo: 'Deshacer' },
  { comando: 'redo', etiqueta: '↷', titulo: 'Rehacer' }
];

const BOTONES_SUPERSUB = [
  { comando: 'superscript', etiqueta: 'x²', titulo: 'Superíndice' },
  { comando: 'subscript', etiqueta: 'x₂', titulo: 'Subíndice' }
];

let areaEscritura = null;
let rangoGuardado = null;

// idArea:  id del <div contenteditable> donde se escribe.
// idBarra: id del contenedor donde se pintan las dos filas de botones.
// "+Notas" NO vive aquí — tiene su propia columna a la derecha del
// editor (ver manejaNotas.js / editor.html), así que este módulo ya no
// recibe ni usa un callback para eso.
export function inicializarHerramientasEdicion(idArea, idBarra) {
  areaEscritura = document.getElementById(idArea);
  const barra = document.getElementById(idBarra);

  if (!areaEscritura || !barra) {
    console.error(`manejaHerramientasEdicion.js: no encontré #${idArea} o #${idBarra} en el HTML.`);
    return;
  }

  areaEscritura.addEventListener('mouseup', guardarSeleccion);
  areaEscritura.addEventListener('keyup', guardarSeleccion);

  barra.innerHTML = '';

  // Fila 1: lo más usado — negrita/cursiva/subrayado/tachado, colores,
  // tipografía, tamaño y alineación.
  const fila1 = document.createElement('div');
  fila1.classList.add('fila-herramientas');

  BOTONES_SIMPLES.forEach((info) => fila1.appendChild(crearBotonComando(info)));
  fila1.appendChild(crearSeparador());

  fila1.appendChild(crearEntradaColor('Color de texto', (color) => ejecutarComando('foreColor', color)));
  fila1.appendChild(crearEntradaColor('Marcatextos (color modificable)', (color) => ejecutarComandoResaltado(color)));
  fila1.appendChild(crearSeparador());

  fila1.appendChild(crearSelectorFuente());
  fila1.appendChild(crearSelectorTamano());
  fila1.appendChild(crearSeparador());

  BOTONES_ALINEACION.forEach((info) => fila1.appendChild(crearBotonComando(info)));

  barra.appendChild(fila1);

  // Fila 2: debajo de tamaño/alineación — listas, sangría,
  // superíndice/subíndice, deshacer/rehacer y limpiar formato.
  const fila2 = document.createElement('div');
  fila2.classList.add('fila-herramientas');

  BOTONES_LISTA.forEach((info) => fila2.appendChild(crearBotonComando(info)));
  BOTONES_SANGRIA.forEach((info) => fila2.appendChild(crearBotonComando(info)));
  fila2.appendChild(crearSeparador());

  BOTONES_SUPERSUB.forEach((info) => fila2.appendChild(crearBotonComando(info)));
  fila2.appendChild(crearSeparador());

  BOTONES_HISTORIAL.forEach((info) => fila2.appendChild(crearBotonComando(info)));
  fila2.appendChild(crearBotonSimple('Limpiar formato', () => ejecutarComando('removeFormat'), 'Quita todo el formato de lo seleccionado'));

  barra.appendChild(fila2);

  document.addEventListener('selectionchange', actualizarEstadosBotones);
}

function guardarSeleccion() {
  const seleccion = window.getSelection();
  if (seleccion.rangeCount > 0 && areaEscritura.contains(seleccion.anchorNode)) {
    rangoGuardado = seleccion.getRangeAt(0).cloneRange();
  }
}

function restaurarSeleccion() {
  if (!rangoGuardado) return;
  areaEscritura.focus();
  const seleccion = window.getSelection();
  seleccion.removeAllRanges();
  seleccion.addRange(rangoGuardado);
}

function ejecutarComando(comando, valor = null) {
  areaEscritura.focus();
  document.execCommand(comando, false, valor);
}

// Chrome/Edge/Firefox entienden 'hiliteColor' para el color de fondo del
// marcatextos; por si algún navegador solo conoce 'backColor', se usa
// como respaldo cuando el primero no funciona.
function ejecutarComandoResaltado(color) {
  areaEscritura.focus();
  const funciono = document.execCommand('hiliteColor', false, color);
  if (!funciono) document.execCommand('backColor', false, color);
}

function crearBotonComando({ comando, etiqueta, titulo, estilo }) {
  return crearBotonSimple(etiqueta, () => ejecutarComando(comando), titulo, estilo, comando);
}

function crearBotonSimple(etiqueta, alHacerClick, titulo = '', estilo = '', comandoParaEstado = null) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.classList.add('boton-herramienta');
  if (comandoParaEstado) boton.dataset.comando = comandoParaEstado;
  boton.textContent = etiqueta;
  if (titulo) boton.title = titulo;
  if (estilo) boton.setAttribute('style', estilo);
  // mousedown + preventDefault: evita que el click le quite el foco/la
  // selección al área de escritura antes de ejecutar el comando (si no,
  // execCommand ya no sabría sobre qué texto actuar).
  boton.addEventListener('mousedown', (evento) => evento.preventDefault());
  boton.addEventListener('click', alHacerClick);
  return boton;
}

function crearSeparador() {
  const separador = document.createElement('span');
  separador.classList.add('separador-herramientas');
  return separador;
}

function crearEntradaColor(titulo, alElegirColor) {
  const entrada = document.createElement('input');
  entrada.type = 'color';
  entrada.classList.add('entrada-color-herramienta');
  entrada.title = titulo;
  entrada.value = '#000000';
  // El selector de color nativo abre un diálogo del sistema operativo,
  // fuera del área de escritura, así que se guarda la selección justo
  // antes de que se abra (focus) y se restaura justo antes de aplicar el
  // color (input) — si no, se perdería qué texto estaba seleccionado.
  entrada.addEventListener('focus', guardarSeleccion);
  entrada.addEventListener('input', () => {
    restaurarSeleccion();
    alElegirColor(entrada.value);
  });
  return entrada;
}

function crearSelectorFuente() {
  const selector = document.createElement('select');
  selector.classList.add('selector-herramienta');
  selector.title = 'Tipografía';
  FUENTES.forEach((fuente) => {
    const opcion = document.createElement('option');
    opcion.value = fuente.nombre;
    opcion.textContent = fuente.nombre;
    opcion.style.fontFamily = fuente.pila;
    selector.appendChild(opcion);
  });
  selector.addEventListener('mousedown', guardarSeleccion);
  selector.addEventListener('change', () => {
    restaurarSeleccion();
    ejecutarComando('fontName', selector.value);
  });
  return selector;
}

function crearSelectorTamano() {
  const selector = document.createElement('select');
  selector.classList.add('selector-herramienta');
  selector.title = 'Tamaño de letra';
  TAMANOS.forEach((tamano) => {
    const opcion = document.createElement('option');
    opcion.value = tamano.valor;
    opcion.textContent = tamano.etiqueta;
    if (tamano.valor === '3') opcion.selected = true;
    selector.appendChild(opcion);
  });
  selector.addEventListener('mousedown', guardarSeleccion);
  selector.addEventListener('change', () => {
    restaurarSeleccion();
    ejecutarComando('fontSize', selector.value);
  });
  return selector;
}

// Resalta (clase "activo") los botones cuyo comando está aplicado en la
// posición actual del cursor — ej. si el cursor está dentro de texto en
// negrita, el botón "N" se ve encendido. Solo revisa mientras la
// selección esté dentro del área de escritura de este editor.
function actualizarEstadosBotones() {
  if (!areaEscritura) return;
  const seleccion = window.getSelection();
  if (seleccion.rangeCount === 0 || !areaEscritura.contains(seleccion.anchorNode)) return;

  document.querySelectorAll('.boton-herramienta[data-comando]').forEach((boton) => {
    try {
      boton.classList.toggle('activo', document.queryCommandState(boton.dataset.comando));
    } catch {
      // Algún comando puede no soportar queryCommandState en algún
      // navegador — simplemente no se resalta ese botón.
    }
  });
}
