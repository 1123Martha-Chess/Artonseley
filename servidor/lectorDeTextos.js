// lectorDeTextos.js (versión servidor)
// -------------------------------------------------------------------
// Es la misma idea que la versión de navegador: un lector genérico de
// textos, con caché por archivo. La única diferencia es CÓMO se lee el
// archivo: aquí usamos fs (sistema de archivos de Node) en vez de fetch,
// porque este código ya no corre en un navegador, corre en el servidor.
// -------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cachePorArchivo = new Map();

async function cargarTextos(nombreArchivo) {
  if (cachePorArchivo.has(nombreArchivo)) {
    return cachePorArchivo.get(nombreArchivo);
  }

  const ruta = path.join(__dirname, 'datos', 'textos', nombreArchivo);
  const contenido = await readFile(ruta, 'utf-8');
  const datos = JSON.parse(contenido);

  cachePorArchivo.set(nombreArchivo, datos.textos);
  return datos.textos;
}

export async function obtenerTextoPorId(nombreArchivo, id) {
  const textos = await cargarTextos(nombreArchivo);
  const encontrado = textos.find(t => t.id === id);
  return encontrado ? encontrado.texto : null;
}
