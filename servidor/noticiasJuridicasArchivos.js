// noticiasJuridicasArchivos.js
// -------------------------------------------------------------------
// Las fotos de cada "cuadro" de Noticias Jurídicas NO van a la base de
// datos: viven como archivos sueltos en CARPETA_DATOS/noticias-juridicas/,
// junto a artonseley.db — mismo patrón que servidor/musicaArchivos.js.
//
// La tabla "noticias_juridicas_imagenes" (servidor/db/noticiasJuridicas.js)
// solo guarda el NOMBRE de cada archivo dentro de esta carpeta.
// -------------------------------------------------------------------

import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Misma CARPETA_DATOS que servidor/db/conexion.js y servidor/musicaArchivos.js
// (este archivo está un nivel más arriba, en servidor/, de ahí el '..').
const CARPETA_DATOS = process.env.CARPETA_DATOS || path.join(__dirname, '..', 'data');
export const CARPETA_NOTICIAS = path.join(CARPETA_DATOS, 'noticias-juridicas');

mkdirSync(CARPETA_NOTICIAS, { recursive: true });

export const LIMITE_IMAGEN_NOTICIA_BYTES = 4 * 1024 * 1024; //  4 MB
export const MAXIMO_IMAGENES_POR_NOTICIA = 8;

// Extensión "segura" a partir del nombre original; si no trae una válida,
// se deriva del tipo MIME. Nunca se usa el nombre original tal cual (se
// renombra todo a <uuid>.<ext>) para no arrastrar rutas ni caracteres raros.
function extensionSegura(archivo) {
  const ext = path.extname(archivo.originalname || '').toLowerCase();
  if (/^\.[a-z0-9]{1,5}$/.test(ext)) return ext;
  const porMime = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return porMime[archivo.mimetype] || '.bin';
}

const almacenamiento = multer.diskStorage({
  destination: (_peticion, _archivo, cb) => cb(null, CARPETA_NOTICIAS),
  filename: (_peticion, archivo, cb) => cb(null, `${randomUUID()}${extensionSegura(archivo)}`)
});

function filtroArchivo(_peticion, archivo, cb) {
  if (archivo.fieldname !== 'imagenes') {
    return cb(new Error('Campo de archivo no esperado.'));
  }
  if (!archivo.mimetype.startsWith('image/')) {
    return cb(new Error('Uno de los archivos no es una imagen válida.'));
  }
  cb(null, true);
}

// Middleware listo para las rutas de admin: hasta MAXIMO_IMAGENES_POR_NOTICIA
// fotos en el campo "imagenes".
export function subidaDeImagenesNoticia() {
  return multer({
    storage: almacenamiento,
    fileFilter: filtroArchivo,
    limits: { fileSize: LIMITE_IMAGEN_NOTICIA_BYTES, files: MAXIMO_IMAGENES_POR_NOTICIA }
  }).array('imagenes', MAXIMO_IMAGENES_POR_NOTICIA);
}

// Ruta absoluta de una imagen de noticia, con guarda contra "../" y contra
// nombres vacíos: solo se permite un nombre de archivo plano.
export function rutaArchivoNoticia(nombre) {
  if (!nombre || typeof nombre !== 'string') return null;
  const base = path.basename(nombre);
  if (base !== nombre) return null;
  const ruta = path.join(CARPETA_NOTICIAS, base);
  if (!ruta.startsWith(CARPETA_NOTICIAS)) return null;
  return ruta;
}

export function archivoDeNoticiaExiste(nombre) {
  const ruta = rutaArchivoNoticia(nombre);
  return !!ruta && existsSync(ruta);
}

// Borra un archivo de la carpeta de noticias si existe; se traga el error
// (que un archivo ya no esté no debe tumbar el borrado de la noticia).
export async function borrarArchivoDeNoticia(nombre) {
  const ruta = rutaArchivoNoticia(nombre);
  if (!ruta) return;
  try {
    await unlink(ruta);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('noticiasJuridicasArchivos.js: no se pudo borrar', nombre, error);
    }
  }
}
