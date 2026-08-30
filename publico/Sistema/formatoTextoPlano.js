// formatoTextoPlano.js
// -------------------------------------------------------------------
// Convierte el HTML que produce el área de escritura de un cuaderno
// (contenteditable, ver manejaHerramientasEdicion.js) hacia/desde un
// formato de texto plano "seguro": el archivo que se exporta y se puede
// volver a importar contiene ÚNICAMENTE letras, números y símbolos de
// teclado normales — nunca HTML de verdad, nunca binario. Es vital que
// sea así para que el archivo se pueda abrir sin riesgo en cualquier
// lado, y para que importar un archivo no pueda meter código a la
// página (ver esContenidoDeTextoSeguro más abajo).
//
// El formato conserva el formato del texto (negritas, colores,
// tamaños...) con un marcado propio, ligero, inspirado en Markdown:
//
//   **texto**                     -> negrita
//   *texto*                       -> cursiva
//   __texto__                     -> subrayado (OJO: en Markdown real
//                                     __texto__ es negrita — aquí NO)
//   ~~texto~~                     -> tachado
//   [sup]texto[/sup]              -> superíndice
//   [sub]texto[/sub]              -> subíndice
//   [color=#RRGGBB]texto[/color]  -> color del texto
//   [marca=#RRGGBB]texto[/marca]  -> marcatextos (resaltado)
//   [fuente=Nombre]texto[/fuente] -> tipografía
//   [tam=N]texto[/tam]            -> tamaño de letra (N va de 1 a 7)
//
// Al principio de una línea (antes que cualquier otra cosa):
//   [centro] / [derecha] / [justificado]   -> alineación del párrafo
//                                              (nada al inicio = izquierda)
//   - texto                                -> lista con viñetas
//   1. texto                               -> lista numerada
//   4 espacios al inicio, por cada nivel   -> sangría
//
// Esto es "lo mejor posible", no un procesador de texto completo: un
// caso muy anidado (ej. una lista dentro de otra lista, con colores
// encima) puede no ir y volver pixel-perfecto, pero cubre todas las
// herramientas de la barra de edición para el uso normal de un
// documento legal.
// -------------------------------------------------------------------

// ===================== HTML -> texto plano (exportar) =====================

export function convertirHtmlATexto(html) {
  const raiz = document.createElement('div');
  raiz.innerHTML = html || '';
  const lineas = [];
  procesarBloques(raiz, 0, lineas);
  return lineas.join('\n');
}

function procesarBloques(contenedor, nivelSangria, lineas) {
  const hijos = Array.from(contenedor.childNodes);
  const hayBloques = hijos.some((n) => n.nodeType === Node.ELEMENT_NODE && (n.tagName === 'DIV' || n.tagName === 'P'));

  if (!hayBloques) {
    // Todo el contenido es texto/formato en línea (o <br> sueltos): se
    // arma como una sola secuencia de líneas separadas por <br>.
    let buffer = '';
    const sangria = ' '.repeat(nivelSangria * 4);
    hijos.forEach((nodo) => {
      if (nodo.nodeType === Node.ELEMENT_NODE && nodo.tagName === 'BR') {
        lineas.push(sangria + buffer);
        buffer = '';
        return;
      }
      if (nodo.nodeType === Node.ELEMENT_NODE && (nodo.tagName === 'UL' || nodo.tagName === 'OL')) {
        if (buffer) { lineas.push(sangria + buffer); buffer = ''; }
        procesarLista(nodo, nivelSangria, lineas, nodo.tagName === 'OL');
        return;
      }
      if (nodo.nodeType === Node.ELEMENT_NODE && nodo.tagName === 'BLOCKQUOTE') {
        if (buffer) { lineas.push(sangria + buffer); buffer = ''; }
        procesarBloques(nodo, nivelSangria + 1, lineas);
        return;
      }
      buffer += procesarNodoInline(nodo);
    });
    lineas.push(sangria + buffer);
    return;
  }

  hijos.forEach((nodo) => {
    if (nodo.nodeType === Node.TEXT_NODE) {
      const texto = limpiarTexto(nodo.textContent);
      if (texto.trim()) lineas.push(' '.repeat(nivelSangria * 4) + texto);
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;

    if (nodo.tagName === 'UL' || nodo.tagName === 'OL') {
      procesarLista(nodo, nivelSangria, lineas, nodo.tagName === 'OL');
      return;
    }
    if (nodo.tagName === 'BLOCKQUOTE') {
      procesarBloques(nodo, nivelSangria + 1, lineas);
      return;
    }
    if (nodo.tagName === 'DIV' || nodo.tagName === 'P') {
      const prefijo = obtenerPrefijoAlineacion(nodo);
      const contenidoLinea = procesarNodoInline(nodo);
      lineas.push(' '.repeat(nivelSangria * 4) + prefijo + contenidoLinea);
      return;
    }
    // Elemento en línea suelto directo bajo la raíz (poco común): se
    // trata como su propia línea.
    lineas.push(' '.repeat(nivelSangria * 4) + procesarNodoInline(nodo));
  });
}

function procesarLista(nodo, nivelSangria, lineas, esNumerada) {
  let contador = 1;
  Array.from(nodo.children).forEach((li) => {
    if (li.tagName !== 'LI') return;

    const subListas = Array.from(li.children).filter((h) => h.tagName === 'UL' || h.tagName === 'OL');
    const liClon = li.cloneNode(true);
    Array.from(liClon.children)
      .filter((h) => h.tagName === 'UL' || h.tagName === 'OL')
      .forEach((h) => h.remove());

    const contenidoLi = Array.from(liClon.childNodes).map(procesarNodoInline).join('');
    const marcador = esNumerada ? `${contador}. ` : '- ';
    lineas.push(' '.repeat(nivelSangria * 4) + marcador + contenidoLi);
    contador++;

    subListas.forEach((sub) => procesarLista(sub, nivelSangria + 1, lineas, sub.tagName === 'OL'));
  });
}

function obtenerPrefijoAlineacion(nodo) {
  const alineacion = nodo.style && nodo.style.textAlign;
  if (alineacion === 'center') return '[centro] ';
  if (alineacion === 'right') return '[derecha] ';
  if (alineacion === 'justify') return '[justificado] ';
  return '';
}

function procesarNodoInline(nodo) {
  if (nodo.nodeType === Node.TEXT_NODE) return limpiarTexto(nodo.textContent);
  if (nodo.nodeType !== Node.ELEMENT_NODE) return '';
  if (nodo.tagName === 'BR') return '';

  const interior = Array.from(nodo.childNodes).map(procesarNodoInline).join('');
  return envolverPorEtiqueta(nodo, interior);
}

function envolverPorEtiqueta(nodo, interior) {
  if (!interior) return interior;

  switch (nodo.tagName) {
    case 'B':
    case 'STRONG':
      return `**${interior}**`;
    case 'I':
    case 'EM':
      return `*${interior}*`;
    case 'U':
      return `__${interior}__`;
    case 'S':
    case 'STRIKE':
    case 'DEL':
      return `~~${interior}~~`;
    case 'SUP':
      return `[sup]${interior}[/sup]`;
    case 'SUB':
      return `[sub]${interior}[/sub]`;
    case 'FONT': {
      let resultado = interior;
      if (nodo.getAttribute('color')) resultado = `[color=${nodo.getAttribute('color')}]${resultado}[/color]`;
      if (nodo.getAttribute('face')) resultado = `[fuente=${nodo.getAttribute('face')}]${resultado}[/fuente]`;
      if (nodo.getAttribute('size')) resultado = `[tam=${nodo.getAttribute('size')}]${resultado}[/tam]`;
      return resultado;
    }
    case 'SPAN': {
      let resultado = interior;
      const estilo = nodo.style;
      if (estilo && estilo.backgroundColor) resultado = `[marca=${rgbAHex(estilo.backgroundColor)}]${resultado}[/marca]`;
      if (estilo && estilo.color) resultado = `[color=${rgbAHex(estilo.color)}]${resultado}[/color]`;
      if (estilo && estilo.fontFamily) resultado = `[fuente=${estilo.fontFamily.replace(/['"]/g, '')}]${resultado}[/fuente]`;
      return resultado;
    }
    default:
      return interior;
  }
}

function rgbAHex(color) {
  if (color.startsWith('#')) return color;
  const numeros = color.match(/\d+/g);
  if (!numeros) return color;
  return '#' + numeros.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
}

// Un <br>/<div> ya marca el salto de línea real; un \n suelto dentro de
// un nodo de texto (puede pasar al pegar contenido externo) rompería el
// esquema de "una línea del arreglo = una línea del documento", así que
// se aplana a un espacio.
function limpiarTexto(texto) {
  return texto.replace(/\r?\n/g, ' ');
}

// ===================== texto plano -> HTML (importar) =====================

export function convertirTextoAHtml(texto) {
  const lineasCrudas = String(texto ?? '').split(/\r?\n/);
  const partesHtml = [];
  let i = 0;

  while (i < lineasCrudas.length) {
    const { sangria, resto } = extraerSangria(lineasCrudas[i]);
    const marcador = detectarMarcadorLista(resto);

    if (marcador) {
      const items = [marcador.contenido];
      i++;
      while (i < lineasCrudas.length) {
        const actual = extraerSangria(lineasCrudas[i]);
        const marcadorActual = detectarMarcadorLista(actual.resto);
        if (!marcadorActual || actual.sangria !== sangria || marcadorActual.numerada !== marcador.numerada) break;
        items.push(marcadorActual.contenido);
        i++;
      }
      const etiquetaLista = marcador.numerada ? 'ol' : 'ul';
      const itemsHtml = items.map((item) => `<li>${procesarInlineAHtml(item)}</li>`).join('');
      partesHtml.push(envolverEnSangria(`<${etiquetaLista}>${itemsHtml}</${etiquetaLista}>`, sangria));
      continue;
    }

    const { alineacion, contenido } = extraerAlineacion(resto);
    const estiloAlineacion = alineacion ? ` style="text-align:${alineacion}"` : '';
    const contenidoHtml = procesarInlineAHtml(contenido);
    partesHtml.push(envolverEnSangria(`<div${estiloAlineacion}>${contenidoHtml || '<br>'}</div>`, sangria));
    i++;
  }

  return partesHtml.join('');
}

function envolverEnSangria(htmlInterior, nivel) {
  let resultado = htmlInterior;
  for (let n = 0; n < nivel; n++) {
    resultado = `<blockquote style="margin:0 0 0 40px;border:none;padding:0">${resultado}</blockquote>`;
  }
  return resultado;
}

function extraerSangria(linea) {
  let nivel = 0;
  let resto = linea;
  while (resto.startsWith('    ')) {
    resto = resto.slice(4);
    nivel++;
  }
  return { sangria: nivel, resto };
}

function detectarMarcadorLista(texto) {
  const vinieta = texto.match(/^-\s(.*)$/);
  if (vinieta) return { numerada: false, contenido: vinieta[1] };
  const numerada = texto.match(/^\d+\.\s(.*)$/);
  if (numerada) return { numerada: true, contenido: numerada[1] };
  return null;
}

function extraerAlineacion(texto) {
  const coincidencia = texto.match(/^\[(centro|derecha|justificado)\]\s(.*)$/);
  if (!coincidencia) return { alineacion: null, contenido: texto };
  const mapa = { centro: 'center', derecha: 'right', justificado: 'justify' };
  return { alineacion: mapa[coincidencia[1]], contenido: coincidencia[2] };
}

// El orden importa: primero las etiquetas de corchetes (no chocan con
// nada más), luego los pares de doble símbolo, y **al final** la
// cursiva de un solo asterisco — si fuera antes, se comería la mitad de
// cada "**negrita**".
function procesarInlineAHtml(texto) {
  let resultado = escaparHtml(texto);

  resultado = resultado.replace(/\[fuente=([^\]]+)\](.*?)\[\/fuente\]/g, '<font face="$1">$2</font>');
  resultado = resultado.replace(/\[tam=([^\]]+)\](.*?)\[\/tam\]/g, '<font size="$1">$2</font>');
  resultado = resultado.replace(/\[color=([^\]]+)\](.*?)\[\/color\]/g, '<font color="$1">$2</font>');
  resultado = resultado.replace(/\[marca=([^\]]+)\](.*?)\[\/marca\]/g, '<span style="background-color:$1">$2</span>');
  resultado = resultado.replace(/\[sup\](.*?)\[\/sup\]/g, '<sup>$1</sup>');
  resultado = resultado.replace(/\[sub\](.*?)\[\/sub\]/g, '<sub>$1</sub>');

  resultado = resultado.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  resultado = resultado.replace(/__(.+?)__/g, '<u>$1</u>');
  resultado = resultado.replace(/~~(.+?)~~/g, '<s>$1</s>');
  resultado = resultado.replace(/\*(.+?)\*/g, '<i>$1</i>');

  return resultado;
}

function escaparHtml(texto) {
  return texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===================== archivo: exportar / importar =====================

export function exportarComoArchivo(nombreCuaderno, texto) {
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${sanitizarNombreArchivo(nombreCuaderno)}.txt`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

function sanitizarNombreArchivo(nombre) {
  return (nombre || 'cuaderno').replace(/[\\/:*?"<>|]/g, '_').trim().slice(0, 80) || 'cuaderno';
}

// Antes de aceptar un archivo importado, se valida que sea texto de
// verdad (nuestro propio marcado incluido) y no algún binario disfrazado
// de .txt: si aparece un carácter de control que no sea salto de línea o
// tabulador, se rechaza. Esto es lo que pide la especificación de
// "que solo acepte letras".
const PATRON_CARACTER_NO_TEXTO = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;

export function esContenidoDeTextoSeguro(contenido) {
  return typeof contenido === 'string' && !PATRON_CARACTER_NO_TEXTO.test(contenido);
}

export function leerArchivoDeTexto(archivo) {
  return new Promise((resolve, reject) => {
    if (!/\.txt$/i.test(archivo.name)) {
      reject(new Error('Solo se pueden importar archivos de texto (.txt).'));
      return;
    }
    const lector = new FileReader();
    lector.onload = () => resolve(String(lector.result));
    lector.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    lector.readAsText(archivo, 'utf-8');
  });
}
