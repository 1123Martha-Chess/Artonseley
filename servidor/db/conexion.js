// conexion.js
// -------------------------------------------------------------------
// Punto único de acceso a la base de datos SQLite. Todo lo que antes
// vivía en archivos sueltos (los JSON de leyes, sugerencias.json) y lo
// nuevo que necesita persistir de verdad (usuarios, sesiones) vive
// ahora aquí, en un solo archivo .db.
//
// Por qué SQLite y no Postgres desde ya: para el tamaño de este
// proyecto (unos cuantos miles de artículos, y probablemente cientos —
// no millones — de usuarios) es más que suficiente, no requiere
// levantar un servidor de base de datos aparte, y todo el acceso a
// datos queda centralizado en esta carpeta (servidor/db/) — el día que
// haga falta migrar a Postgres, solo hay que reescribir este archivo y
// las consultas de cada módulo de esta carpeta, no el resto del
// sistema.
//
// Por qué "node:sqlite" (el módulo de SQLite integrado en Node) y no el
// paquete "better-sqlite3": better-sqlite3 depende de un binario nativo
// que hay que compilar (node-gyp + Visual Studio Build Tools) o
// descargar precompilado; al probar esto en Windows no había binario
// precompilado disponible para la versión de Node instalada, y exigir
// que además instales Visual Studio solo para correr el proyecto es
// mucha fricción. "node:sqlite" viene incluido con Node (desde la
// versión 22.5, ya estable en la 24 que estás usando) — cero
// instalación adicional, incluso en una máquina limpia. Requiere Node
// 22.5 o más nuevo (ver "engines" en package.json).
//
// IMPORTANTE para cuando esto se despliegue en un hosting con disco
// efímero (ej. Render sin disco persistente configurado): este archivo
// .db se pierde en cada despliegue si no está guardado en un disco
// montado aparte. Ver el README para la configuración necesaria antes
// de desplegar.
// -------------------------------------------------------------------

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_DATOS = process.env.CARPETA_DATOS || path.join(__dirname, '..', '..', 'data');
const RUTA_DB = path.join(CARPETA_DATOS, 'artonseley.db');

mkdirSync(CARPETA_DATOS, { recursive: true });

// Aviso al arrancar. En un hosting con disco efímero (Render, Railway…)
// TODO lo que vive en el árbol del proyecto se borra en cada despliegue:
// si la base de datos está ahí (porque CARPETA_DATOS no apunta a un disco
// persistente montado aparte), en cada deploy se pierden los usuarios,
// las licencias, las sesiones y las leyes cargadas. Se avisa fuerte en
// producción para que no pase inadvertido. Ver README, sección
// "Despliegue en Render (disco persistente)".
if (process.env.NODE_ENV === 'production' && !process.env.CARPETA_DATOS) {
  console.warn(
    '\n⚠️  CARPETA_DATOS no está definida: la base de datos se está guardando en\n' +
    `   "${RUTA_DB}", dentro del proyecto. En Render (o cualquier hosting con disco\n` +
    '   efímero) ESTO SE BORRA EN CADA DESPLIEGUE y se pierden usuarios, licencias\n' +
    '   y leyes. Configura un disco persistente y apunta CARPETA_DATOS a su ruta de\n' +
    '   montaje (ver README).\n'
  );
}

export const db = new DatabaseSync(RUTA_DB);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// node:sqlite no trae un helper de transacciones como db.transaction()
// de better-sqlite3 — se envuelve a mano con BEGIN/COMMIT/ROLLBACK. Se
// usa, por ejemplo, al migrar/reemplazar un documento legal completo
// (varios INSERT que deben quedar todos o ninguno).
export function ejecutarEnTransaccion(funcion) {
  db.exec('BEGIN');
  try {
    const resultado = funcion();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

// CREATE TABLE IF NOT EXISTS: al arrancar el servidor esto crea el
// esquema si es la primera vez (archivo .db nuevo/vacío), y no hace
// nada si las tablas ya existen. No es un sistema de migraciones de
// verdad (no hay versiones ni "ALTER TABLE" automáticos) — para un
// proyecto de este tamaño alcanza con esto, pero si el esquema cambia
// después de que ya haya datos reales, un cambio de columnas sí
// necesitará una migración escrita a mano.
db.exec(`
  CREATE TABLE IF NOT EXISTS sectores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS documentos_legales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,
    ultima_reforma TEXT,
    sector_id INTEGER REFERENCES sectores(id) ON DELETE SET NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    documento_id INTEGER NOT NULL REFERENCES documentos_legales(id) ON DELETE CASCADE,
    articulo_ref TEXT NOT NULL,
    numero TEXT NOT NULL,
    titulo TEXT NOT NULL,
    palabras_clave TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS textos (
    articulo_id INTEGER PRIMARY KEY REFERENCES articulos(id) ON DELETE CASCADE,
    texto TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    hash_contrasena TEXT NOT NULL,
    rol TEXT NOT NULL DEFAULT 'abogado' CHECK (rol IN ('abogado', 'admin')),
    licencia_vence_en TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    suspendido_hasta TEXT,
    eliminado_en TEXT,
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    expira_en TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sugerencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    mensaje TEXT NOT NULL,
    urgencia TEXT NOT NULL DEFAULT 'No especificada',
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS notificaciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    texto TEXT NOT NULL,
    color TEXT,
    activa INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- No crea la cuenta directamente: el formulario público "Crear Cuenta"
  -- solo deja aquí una solicitud (correo, hash de la contraseña que el
  -- usuario eligió, y constancia de que aceptó términos/avisos, con IP y
  -- user-agent como prueba). El administrador la revisa en admin.html,
  -- verifica que el correo es el mismo con el que ya tuvo contacto, y da
  -- de alta la cuenta real a mano con "npm run crear-usuario" como antes.
  -- hash_contrasena nunca se expone por la API (ni siquiera al admin):
  -- se guarda solo para poder reutilizarse el día que exista una
  -- funcionalidad de restablecer contraseña.
  CREATE TABLE IF NOT EXISTS solicitudes_registro (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    hash_contrasena TEXT NOT NULL,
    acepto_terminos_en TEXT NOT NULL DEFAULT (datetime('now')),
    ip TEXT,
    user_agent TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// CREATE TABLE IF NOT EXISTS no le agrega columnas nuevas a una tabla
// que ya existía de antes (ej. la primera vez que se corre este archivo
// después de agregar la funcionalidad de sectores, sobre un data/artonseley.db
// que ya traía documentos_legales sin la columna sector_id). Se revisa
// a mano y se agrega con ALTER TABLE si hace falta.
const columnasDeDocumentos = db.prepare("PRAGMA table_info(documentos_legales)").all();
const yaTieneSectorId = columnasDeDocumentos.some(columna => columna.name === 'sector_id');
if (!yaTieneSectorId) {
  db.exec('ALTER TABLE documentos_legales ADD COLUMN sector_id INTEGER REFERENCES sectores(id) ON DELETE SET NULL');
}

// Mismo caso: "activo" (para poder suspender una cuenta a mano, sin
// esperar a que venza su licencia) se agregó después de que ya existía
// la tabla "usuarios" en instalaciones existentes.
const columnasDeUsuarios = db.prepare("PRAGMA table_info(usuarios)").all();
const yaTieneActivo = columnasDeUsuarios.some(columna => columna.name === 'activo');
if (!yaTieneActivo) {
  db.exec('ALTER TABLE usuarios ADD COLUMN activo INTEGER NOT NULL DEFAULT 1');
}

// "suspendido_hasta" (hasta cuándo dura una suspensión temporal, si la
// tiene) y "eliminado_en" (marca de cuándo se mandó la cuenta a la
// papelera, si aplica) se agregaron después por el mismo motivo.
const yaTieneSuspendidoHasta = columnasDeUsuarios.some(columna => columna.name === 'suspendido_hasta');
if (!yaTieneSuspendidoHasta) {
  db.exec('ALTER TABLE usuarios ADD COLUMN suspendido_hasta TEXT');
}
const yaTieneEliminadoEn = columnasDeUsuarios.some(columna => columna.name === 'eliminado_en');
if (!yaTieneEliminadoEn) {
  db.exec('ALTER TABLE usuarios ADD COLUMN eliminado_en TEXT');
}
