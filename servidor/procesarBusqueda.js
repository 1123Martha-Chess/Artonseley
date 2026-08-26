// procesarBusqueda.js
// -------------------------------------------------------------------
// Aquí vive la lógica que antes estaba dentro de buscadorPrincipal.js
// en el navegador: decidir si lo que escribió el usuario es un número
// de artículo o una lista de palabras, usar el diccionario para
// completar palabras a medio escribir, y armar los avisos de
// "palabras similares".
//
// Ya NO hay document.* aquí: esto corre en el servidor y solo regresa
// un objeto plano con lo que el cliente necesita para pintar.
//
//   { tipo: 'mensaje', mensaje: '...' }
//   { tipo: 'resultados', resultados: [...], avisos: [...] }
// -------------------------------------------------------------------

import { identificarLetras } from './identificadorDeLetras.js';
import { buscarArticulosPorGrupos, buscarArticuloPorNumero } from './LectorDeJSON.js';

const PATRON_NUMERO_DE_ARTICULO = /^(art[íi]culo|art\.?)?\s*\d+\s*$/i;

export async function procesarBusqueda(textoEscrito, documentosSeleccionados = null) {
  const textoLimpio = String(textoEscrito ?? '').trim();

  if (textoLimpio.length === 0) {
    return {
      tipo: 'mensaje',
      mensaje: 'Escribe una palabra o un número de artículo para buscar (ej. robo, fraude, "artículo 210"...).'
    };
  }

  // ¿Todo el texto es un número de artículo (con o sin "artículo"/"art" delante)?
  if (PATRON_NUMERO_DE_ARTICULO.test(textoLimpio)) {
    const resultados = await buscarArticuloPorNumero(textoLimpio, documentosSeleccionados);

    if (resultados.length === 0) {
      return {
        tipo: 'mensaje',
        mensaje: `No se encontró ningún artículo con el número "${textoLimpio}" en los documentos seleccionados.`
      };
    }

    return { tipo: 'resultados', resultados, avisos: [] };
  }

  const listaPalabras = textoLimpio.split(',').map(p => p.trim()).filter(p => p.length > 0);

  if (listaPalabras.length === 0) {
    return { tipo: 'mensaje', mensaje: 'Escribe una palabra para buscar (ej. robo, fraude, homicidio, amparo...).' };
  }

  const gruposDeCoincidencias = [];
  const avisos = [];

  for (const palabra of listaPalabras) {
    const coincidencias = identificarLetras(palabra);

    // Si lo escrito no es, tal cual, una palabra completa del diccionario,
    // avisamos con qué palabras completas se está buscando en realidad.
    const esPalabraCompleta = coincidencias.length === 1 && coincidencias[0] === palabra.toLowerCase().trim();
    if (coincidencias.length > 0 && !esPalabraCompleta) {
      avisos.push(`Se buscaron palabras similares a "${palabra}" y se encontró: ${coincidencias.join(', ')}.`);
    }

    // Lo escrito por el usuario siempre se agrega al grupo, aunque
    // identificarLetras haya "completado" a otra(s) palabra(s): si no
    // fuera así, una palabra completa y válida que por casualidad
    // coincide con el inicio de una frase del diccionario (ej. "agravio"
    // es el prefijo de "agravio verbal", sinónimo de "injuria") perdía
    // su propio significado literal y solo se buscaba la frase del
    // diccionario, dando MENOS resultados que su plural "agravios" (que
    // no coincide con ningún prefijo y sí se busca tal cual).
    const grupo = new Set(coincidencias);
    grupo.add(palabra);
    gruposDeCoincidencias.push([...grupo]);
  }

  const resultados = await buscarArticulosPorGrupos(gruposDeCoincidencias, documentosSeleccionados);

  if (resultados.length === 0) {
    return {
      tipo: 'mensaje',
      mensaje: `No se encontraron artículos que contengan todas estas palabras: "${textoEscrito}".`
    };
  }

  return { tipo: 'resultados', resultados, avisos };
}
