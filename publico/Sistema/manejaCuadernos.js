// manejaCuadernos.js
// -------------------------------------------------------------------
// Lista y datos de los "cuadernos" (documentos que escribe el usuario)
// de la nueva interfaz de edición de texto (ver editor.html). Todo se
// guarda cifrado en IndexedDB (ver almacenamientoCifradoIndexedDB.js) —
// este archivo nunca guarda ni lee texto plano del disco: cifra antes
// de guardar y descifra al cargar, usando la bóveda ya desbloqueada
// (ver manejaBovedaCifrada.js). Mientras la pestaña está abierta, los
// cuadernos ya descifrados viven en el arreglo "cuadernos" de aquí
// abajo, en memoria — nada más.
//
// Exportar (ver formatoTextoPlano.js, un cuaderno a la vez) o hacer un
// respaldo completo (.arton, ver manejaBovedaCifrada.js) son las dos
// formas de sacar los cuadernos de este navegador o pasarlos a otro
// dispositivo.
// -------------------------------------------------------------------

import { listarCuadernosCifrados, guardarCuadernoCifrado, eliminarCuadernoCifrado, contarCuadernos } from './almacenamientoCifradoIndexedDB.js';
import { cifrarObjeto, descifrarObjeto } from './manejaBovedaCifrada.js';
import {
  convertirHtmlATexto,
  convertirTextoAHtml,
  exportarComoArchivo,
  leerArchivoDeTexto,
  esContenidoDeTextoSeguro
} from './formatoTextoPlano.js';
import { eliminarNotasDeCuaderno } from './manejaNotas.js';

export const MAXIMO_CUADERNOS = 10;

// Ya descifrados en memoria: { id, nombre, contenidoHtml, creadoEn, actualizadoEn }.
// "actualizadoEn" se guarda también SIN cifrar junto al registro (ver
// guardarEnBoveda) — es la única concesión a "cero-conocimiento total":
// hace falta para ordenar la lista sin tener que descifrar todo antes
// de saber en qué orden pintarlo. Nunca revela nombre ni contenido.
let cuadernos = [];
let idCuadernoAbierto = null;

export async function inicializarCuadernos() {
  const registros = await listarCuadernosCifrados();
  cuadernos = await Promise.all(
    registros.map(async (registro) => {
      const datos = await descifrarObjeto(registro);
      return { id: registro.id, ...datos, actualizadoEn: registro.actualizadoEn };
    })
  );
}

export function listarCuadernos() {
  return [...cuadernos].sort((a, b) => new Date(b.actualizadoEn) - new Date(a.actualizadoEn));
}

export function obtenerCuaderno(id) {
  return cuadernos.find((c) => c.id === id) || null;
}

export async function puedeCrearCuaderno() {
  return (await contarCuadernos()) < MAXIMO_CUADERNOS;
}

export async function crearCuaderno(nombre = 'Cuaderno sin título', contenidoHtml = '') {
  if (!(await puedeCrearCuaderno())) {
    throw new Error(`Ya tienes el máximo de ${MAXIMO_CUADERNOS} cuadernos. Borra uno para crear otro.`);
  }
  const ahora = new Date().toISOString();
  const cuaderno = { id: generarId('c'), nombre, contenidoHtml, creadoEn: ahora };
  await guardarEnBoveda(cuaderno, ahora);
  cuadernos.push({ ...cuaderno, actualizadoEn: ahora });
  return cuaderno;
}

async function guardarEnBoveda(cuaderno, actualizadoEn) {
  const { iv, ciphertext } = await cifrarObjeto({
    nombre: cuaderno.nombre,
    contenidoHtml: cuaderno.contenidoHtml,
    creadoEn: cuaderno.creadoEn
  });
  await guardarCuadernoCifrado({ id: cuaderno.id, iv, ciphertext, actualizadoEn });
}

export async function renombrarCuaderno(id, nuevoNombre) {
  const cuaderno = obtenerCuaderno(id);
  if (!cuaderno) return;
  cuaderno.nombre = String(nuevoNombre ?? '').trim() || 'Cuaderno sin título';
  cuaderno.actualizadoEn = new Date().toISOString();
  await guardarEnBoveda(cuaderno, cuaderno.actualizadoEn);
}

export async function guardarContenidoCuaderno(id, contenidoHtml) {
  const cuaderno = obtenerCuaderno(id);
  if (!cuaderno) return;
  cuaderno.contenidoHtml = contenidoHtml;
  cuaderno.actualizadoEn = new Date().toISOString();
  await guardarEnBoveda(cuaderno, cuaderno.actualizadoEn);
}

export async function eliminarCuaderno(id) {
  cuadernos = cuadernos.filter((c) => c.id !== id);
  await eliminarCuadernoCifrado(id);
  await eliminarNotasDeCuaderno(id);
}

export function establecerCuadernoAbierto(id) {
  idCuadernoAbierto = id;
}

export function obtenerCuadernoAbierto() {
  return idCuadernoAbierto ? obtenerCuaderno(idCuadernoAbierto) : null;
}

export function exportarCuaderno(id) {
  const cuaderno = obtenerCuaderno(id);
  if (!cuaderno) return;
  const texto = convertirHtmlATexto(cuaderno.contenidoHtml);
  exportarComoArchivo(cuaderno.nombre, texto);
}

export async function importarCuadernoDesdeArchivo(archivo) {
  if (!(await puedeCrearCuaderno())) {
    throw new Error(`Ya tienes el máximo de ${MAXIMO_CUADERNOS} cuadernos. Borra uno antes de importar otro.`);
  }
  const texto = await leerArchivoDeTexto(archivo);
  if (!esContenidoDeTextoSeguro(texto)) {
    throw new Error('Ese archivo no es un documento de texto válido. Solo se pueden importar archivos .txt exportados desde aquí (o texto simple).');
  }
  const nombre = archivo.name.replace(/\.txt$/i, '') || 'Cuaderno importado';
  const html = convertirTextoAHtml(texto);
  return crearCuaderno(nombre, html);
}

// Para el respaldo completo (.arton) — ver manejaBovedaCifrada.js.
export function obtenerTodosLosCuadernos() {
  return cuadernos;
}

// Importa los cuadernos de un respaldo .arton ya descifrado, respetando
// el máximo de 10 (si el respaldo trae más de los que caben, se
// importan los primeros que alcancen y se avisa cuántos quedaron
// afuera). Regresa un mapa "id viejo (del respaldo) -> id nuevo (recién
// creado aquí)", que manejaNotas.js necesita para volver a ligar cada
// nota importada con su cuaderno correspondiente.
export async function importarCuadernosDesdeRespaldo(cuadernosDelRespaldo) {
  const mapaIds = new Map();
  for (const cuadernoRespaldo of cuadernosDelRespaldo) {
    if (!(await puedeCrearCuaderno())) break;
    const nuevoCuaderno = await crearCuaderno(cuadernoRespaldo.nombre, cuadernoRespaldo.contenidoHtml);
    mapaIds.set(cuadernoRespaldo.id, nuevoCuaderno.id);
  }
  return mapaIds;
}

function generarId(prefijo) {
  if (window.crypto?.randomUUID) return `${prefijo}_${window.crypto.randomUUID()}`;
  return `${prefijo}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
