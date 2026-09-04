// renderizarMarkdownLegal.js
// -------------------------------------------------------------------
// Convertidor de Markdown a HTML, chico y a la medida de los dos
// documentos legales de Artonseley:
//   Terminos_y_Condiciones_Artonseley.md
//   Aviso_de_Privacidad_Artonseley.md
// (ambos en la raíz del proyecto).
//
// NO es un motor de Markdown completo: cubre exactamente lo que usan
// esos documentos —títulos (#, ##, ###), negritas (**texto**), cursivas
// (*texto*), listas (- ...), tablas (| a | b |) y citas (> ...)— y nada
// más. Si el texto llega a necesitar algo que no está aquí (enlaces,
// imágenes, bloques de código), se agrega ese caso puntual.
//
// Todo el texto se escapa como HTML ANTES de insertar cualquier
// etiqueta, así que aunque el .md traiga un "<", "&" o ">" sueltos,
// salen como texto y no como marcado.
// -------------------------------------------------------------------

function escaparHTML(texto) {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Negritas y cursivas dentro de una línea ya escapada. Las negritas se
// procesan primero para que "**" no se confunda con dos "*" sueltos.
function aplicarInline(texto) {
  return escaparHTML(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

// "| a | b | c |" -> ["a", "b", "c"]
function celdasDeFila(linea) {
  return linea
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map(celda => celda.trim());
}

// Fila separadora de una tabla Markdown: "|---|---|", "| :--- | ---: |", etc.
const ES_SEPARADOR_TABLA = /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/;

export function renderizarMarkdownLegal(markdown) {
  const lineas = markdown.replace(/\r\n/g, '\n').split('\n');
  const bloques = [];

  let enLista = false;
  let parrafo = [];

  function cerrarParrafo() {
    if (parrafo.length > 0) {
      bloques.push(`<p>${aplicarInline(parrafo.join(' '))}</p>`);
      parrafo = [];
    }
  }
  function cerrarLista() {
    if (enLista) {
      bloques.push('</ul>');
      enLista = false;
    }
  }

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    const limpia = linea.trim();

    if (limpia === '') {
      cerrarParrafo();
      cerrarLista();
      continue;
    }

    // Comentario HTML (<!-- ... -->): son notas para quien edita el .md
    // (ej. "PENDIENTE: agregar tal cláusula"), NO deben salir en la página.
    // Se saltan por completo, sea de una línea o de varias.
    if (limpia.startsWith('<!--')) {
      cerrarParrafo();
      cerrarLista();
      while (i < lineas.length && !lineas[i].includes('-->')) i++;
      continue; // la línea con "-->" también se descarta (el for incrementa)
    }

    // Título (#, ##, ###...).
    const encabezado = limpia.match(/^(#{1,6})\s+(.*)$/);
    if (encabezado) {
      cerrarParrafo();
      cerrarLista();
      const nivel = encabezado[1].length;
      bloques.push(`<h${nivel}>${aplicarInline(encabezado[2].trim())}</h${nivel}>`);
      continue;
    }

    // Tabla: la línea actual empieza con "|" y la siguiente es la
    // fila separadora ("|---|---|").
    if (limpia.startsWith('|') && lineas[i + 1] && ES_SEPARADOR_TABLA.test(lineas[i + 1].trim())) {
      cerrarParrafo();
      cerrarLista();

      const encabezados = celdasDeFila(limpia);
      i += 2; // saltar la fila de encabezado y la separadora

      const filas = [];
      while (i < lineas.length && lineas[i].trim().startsWith('|')) {
        filas.push(celdasDeFila(lineas[i].trim()));
        i++;
      }
      i--; // el for vuelve a incrementar

      const thead = `<thead><tr>${
        encabezados.map(celda => `<th>${aplicarInline(celda)}</th>`).join('')
      }</tr></thead>`;
      const tbody = `<tbody>${
        filas.map(fila => `<tr>${
          fila.map(celda => `<td>${aplicarInline(celda)}</td>`).join('')
        }</tr>`).join('')
      }</tbody>`;

      bloques.push(`<div class="tabla-scroll"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    // Cita (> ...).
    if (limpia.startsWith('> ')) {
      cerrarParrafo();
      cerrarLista();
      bloques.push(`<blockquote>${aplicarInline(limpia.slice(2).trim())}</blockquote>`);
      continue;
    }

    // Ítem de lista (- ... o * ...).
    const item = limpia.match(/^[-*]\s+(.*)$/);
    if (item) {
      cerrarParrafo();
      if (!enLista) {
        bloques.push('<ul>');
        enLista = true;
      }
      bloques.push(`<li>${aplicarInline(item[1].trim())}</li>`);
      continue;
    }

    // Cualquier otra cosa: línea de párrafo. Se acumula hasta la
    // próxima línea en blanco (varias líneas seguidas = un solo <p>).
    cerrarLista();
    parrafo.push(limpia);
  }

  cerrarParrafo();
  cerrarLista();

  return bloques.join('\n');
}
