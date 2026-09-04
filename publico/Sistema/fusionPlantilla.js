// fusionPlantilla.js
// -------------------------------------------------------------------
// El "motor de fusión" del Generador de Plantillas: sustituye los
// marcadores {{clave}} de una plantilla por los valores que capturó el
// abogado, y exporta el resultado. TODO corre en el navegador — ni la
// plantilla llena ni los datos del cliente vuelven al servidor.
//
// Reutilizable por la Fase 2 (Expedientes cifrados que autocompletan).
// -------------------------------------------------------------------

const PATRON_MARCADOR = /\{\{\s*([\w.]+)\s*\}\}/g;

// Sustituye {{clave}} por valores[clave]. Un marcador sin valor queda
// como "[falta: clave]" para que se vea de inmediato qué se olvidó.
export function fusionar(cuerpo, valores) {
  return String(cuerpo ?? '').replace(PATRON_MARCADOR, (_, clave) => {
    const valor = valores?.[clave];
    return valor == null || String(valor).trim() === '' ? `[falta: ${clave}]` : String(valor);
  });
}

// ¿Quedó algún "[falta: ...]" en el texto fusionado?
export function tieneFaltantes(textoFusionado) {
  return /\[falta:\s[\w.]+\]/.test(textoFusionado);
}

function escaparHTML(texto) {
  return String(texto)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function nombreArchivo(titulo) {
  return (
    String(titulo || 'documento')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'documento'
  );
}

// Descarga el documento fusionado como archivo .doc: es HTML con los
// namespaces de Word, así que Word y LibreOffice lo abren y editan como
// un documento normal. No hace falta ninguna librería.
export function descargarComoWord(titulo, textoFusionado) {
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
    'xmlns:w="urn:schemas-microsoft-com:office:word" ' +
    'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
    `<title>${escaparHTML(titulo)}</title></head><body>` +
    `<div style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5;white-space:pre-wrap;">` +
    `${escaparHTML(textoFusionado)}</div></body></html>`;

  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombreArchivo(titulo)}.doc`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Vuelca el documento en un contenedor solo-para-imprimir y abre el
// diálogo del navegador (donde el usuario elige "Guardar como PDF").
// Requiere que la página tenga un elemento #paraImprimir y un @media print
// que oculte todo lo demás (ver plantillas.html).
export function imprimir(titulo, textoFusionado) {
  const destino = document.getElementById('paraImprimir');
  if (!destino) {
    window.print();
    return;
  }
  destino.textContent = textoFusionado;
  const tituloPrevio = document.title;
  document.title = titulo || tituloPrevio;
  window.print();
  document.title = tituloPrevio;
}
