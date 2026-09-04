// musicaArchivos.js
// -------------------------------------------------------------------
// Los archivos de las canciones (audio e imagen de portada) NO van a la
// base de datos: viven como archivos sueltos en CARPETA_DATOS/musica/,
// junto a artonseley.db. Así, en un hosting con disco persistente
// (ver README), quedan en el mismo disco que sobrevive a los despliegues.
//
// La tabla "canciones" (servidor/db/canciones.js) solo guarda el NOMBRE
// de cada archivo dentro de esta carpeta.
//
// La subida usa multer porque el resto del panel manda JSON y eso no
// sirve para archivos binarios de varios MB.
// -------------------------------------------------------------------

import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync, existsSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Misma CARPETA_DATOS que servidor/db/conexion.js (este archivo está un
// nivel más arriba, en servidor/, de ahí el '..' en vez de '../..').
const CARPETA_DATOS = process.env.CARPETA_DATOS || path.join(__dirname, '..', 'data');
export const CARPETA_MUSICA = path.join(CARPETA_DATOS, 'musica');

mkdirSync(CARPETA_MUSICA, { recursive: true });

const LIMITE_AUDIO_BYTES = 20 * 1024 * 1024; // 20 MB
const LIMITE_IMAGEN_BYTES = 4 * 1024 * 1024; //  4 MB

// Extensión "segura" a partir del nombre original; si no trae una válida,
// se deriva del tipo MIME. Nunca se usa el nombre original tal cual (se
// renombra todo a <uuid>.<ext>) para no arrastrar rutas ni caracteres raros.
function extensionSegura(archivo) {
  const ext = path.extname(archivo.originalname || '').toLowerCase();
  if (/^\.[a-z0-9]{1,5}$/.test(ext)) return ext;
  const porMime = {
    'audio/mpeg': '.mp3',
    'audio/mp4': '.m4a',
    'audio/aac': '.aac',
    'audio/ogg': '.ogg',
    'audio/wav': '.wav',
    'audio/x-wav': '.wav',
    'audio/webm': '.weba',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
  };
  return porMime[archivo.mimetype] || '.bin';
}

const almacenamiento = multer.diskStorage({
  destination: (_peticion, _archivo, cb) => cb(null, CARPETA_MUSICA),
  filename: (_peticion, archivo, cb) => cb(null, `${randomUUID()}${extensionSegura(archivo)}`)
});

function filtroArchivo(_peticion, archivo, cb) {
  if (archivo.fieldname === 'audio') {
    if (!archivo.mimetype.startsWith('audio/')) {
      return cb(new Error('El archivo de audio no es un audio válido.'));
    }
  } else if (archivo.fieldname === 'imagen') {
    if (!archivo.mimetype.startsWith('image/')) {
      return cb(new Error('La portada no es una imagen válida.'));
    }
  } else {
    return cb(new Error('Campo de archivo no esperado.'));
  }
  cb(null, true);
}

// Middleware listo para la ruta POST /api/admin/canciones: un audio
// (obligatorio) y una imagen (opcional).
export function subidaDeCancion() {
  return multer({
    storage: almacenamiento,
    fileFilter: filtroArchivo,
    limits: { fileSize: LIMITE_AUDIO_BYTES, files: 2 }
  }).fields([
    { name: 'audio', maxCount: 1 },
    { name: 'imagen', maxCount: 1 }
  ]);
}

export { LIMITE_AUDIO_BYTES, LIMITE_IMAGEN_BYTES };

// Ruta absoluta de un archivo de música, con guarda contra "../" y contra
// nombres vacíos: solo se permite un nombre de archivo plano.
export function rutaArchivoMusica(nombre) {
  if (!nombre || typeof nombre !== 'string') return null;
  const base = path.basename(nombre);
  if (base !== nombre) return null;
  const ruta = path.join(CARPETA_MUSICA, base);
  if (!ruta.startsWith(CARPETA_MUSICA)) return null;
  return ruta;
}

export function archivoDeMusicaExiste(nombre) {
  const ruta = rutaArchivoMusica(nombre);
  return !!ruta && existsSync(ruta);
}

// Borra un archivo de la carpeta de música si existe; se traga el error
// (que un archivo ya no esté no debe tumbar el borrado de la canción).
export async function borrarArchivoDeMusica(nombre) {
  const ruta = rutaArchivoMusica(nombre);
  if (!ruta) return;
  try {
    await unlink(ruta);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('musicaArchivos.js: no se pudo borrar', nombre, error);
    }
  }
}
