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
import { PLANTILLAS_EJEMPLO } from '../plantillas/ejemplos.js';

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
    nombre TEXT,
    rol TEXT NOT NULL DEFAULT 'abogado' CHECK (rol IN ('abogado', 'admin')),
    licencia_vence_en TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    suspendido_hasta TEXT,
    eliminado_en TEXT,
    intentos_fallidos INTEGER NOT NULL DEFAULT 0,
    bloqueado_hasta TEXT,
    limite_sesiones INTEGER,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sesiones (
    token TEXT PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    expira_en TEXT NOT NULL
  );

  -- El buzón de sugerencias es ANÓNIMO a propósito: "usuario_id" se deja
  -- en la tabla (nunca se borra una columna en este proyecto, ver el
  -- comentario grande más abajo sobre ALTER TABLE) pero servidor/db/sugerencias.js
  -- ya NO lo guarda ni lo expone — ni el propio dueño de la plataforma ve
  -- qué cuenta mandó cada mensaje. Por el mismo motivo, "urgencia" ya
  -- tampoco se guarda ni se pide (se deja la columna, sin usarse, mismo
  -- criterio); "creado_en" se conserva, pero ÚNICAMENTE de forma interna,
  -- para poder calcular cuándo ya pasaron las 24 horas — nunca se expone
  -- en la bandeja del administrador. Cada sugerencia se borra sola a las
  -- 24 horas de mandarse, la haya revisado el administrador o no (ver
  -- eliminarSugerenciasVencidas y el barrido en servidor.js).
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

  -- Canciones del apartado "Música". Solo metadatos: los archivos (audio e
  -- imagen) viven en CARPETA_DATOS/musica/ (ver servidor/musicaArchivos.js),
  -- junto a este mismo .db, para que en producción queden en el disco
  -- persistente. archivo_audio / archivo_imagen guardan el nombre del archivo
  -- dentro de esa carpeta. "orden" es el que decide el administrador para la
  -- lista del reproductor.
  CREATE TABLE IF NOT EXISTS canciones (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    archivo_audio TEXT NOT NULL,
    mime_audio TEXT NOT NULL,
    archivo_imagen TEXT,
    mime_imagen TEXT,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Suscripciones a las notificaciones Web Push de "Recordatorios del
  -- calendario". Una fila por navegador/dispositivo donde el usuario activó
  -- los recordatorios. NO guarda nada del calendario: solo lo que hace falta
  -- para mandarle un "ping" diario (el navegador arma el aviso, con texto
  -- fijo, sin contenido). offset_minutos = -new Date().getTimezoneOffset()
  -- del dispositivo, para saber cuándo son las 7:00 a.m. en su hora local.
  -- ultimo_envio = fecha local ('YYYY-MM-DD') del último push, para no
  -- mandar más de uno por día.
  CREATE TABLE IF NOT EXISTS suscripciones_push (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    offset_minutos INTEGER NOT NULL DEFAULT 0,
    ultimo_envio TEXT,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Valores económicos que usa la Calculadora Jurídica Financiera (salario
  -- mínimo general y de la Frontera Norte, UMA). Es una tabla de una sola
  -- fila (id = 1): el administrador la edita desde el panel. Mientras los
  -- salarios mínimos valgan 0, la calculadora responde un aviso en vez de
  -- calcular. El CHECK (id = 1) y el INSERT de abajo garantizan que la fila
  -- exista siempre.
  CREATE TABLE IF NOT EXISTS indices_economicos (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    anio INTEGER NOT NULL DEFAULT 0,
    salario_minimo_general REAL NOT NULL DEFAULT 0,
    salario_minimo_frontera_norte REAL NOT NULL DEFAULT 0,
    uma REAL NOT NULL DEFAULT 0,
    actualizado_en TEXT
  );
  INSERT OR IGNORE INTO indices_economicos (id) VALUES (1);

  -- Contenido de la página pública "informacion-oficial.html": un
  -- resumen de la plataforma más sus cuentas oficiales y sus fuentes
  -- oficiales (DOF), pensado para que cualquiera pueda verificar que no
  -- se trata de una cuenta falsa ni de publicidad engañosa ANTES de
  -- crear una cuenta — por eso esta tabla y la de abajo se leen sin
  -- exigir sesión (GET /api/informacion-oficial). Igual que
  -- indices_economicos, es una tabla de una sola fila (id = 1) que el
  -- administrador edita desde el panel.
  CREATE TABLE IF NOT EXISTS informacion_oficial (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    descripcion TEXT NOT NULL DEFAULT '',
    actualizado_en TEXT
  );
  INSERT OR IGNORE INTO informacion_oficial (id) VALUES (1);

  -- Los enlaces (redes sociales, WhatsApp, correo oficial, publicaciones
  -- del DOF...) que acompañan a "informacion_oficial". "categoria"
  -- separa las dos secciones fijas de la página; "orden" es el que
  -- decide el administrador con ↑ / ↓, igual que en "canciones".
  CREATE TABLE IF NOT EXISTS informacion_oficial_enlaces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL CHECK (categoria IN ('cuenta_oficial', 'fuente_oficial')),
    etiqueta TEXT NOT NULL,
    url TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Biblioteca de "machotes" del Generador de Plantillas y Documentos.
  -- Solo el texto de la plantilla (con marcadores {{clave}}) — NUNCA datos
  -- de ningún cliente/expediente: esos viven cifrados en el navegador del
  -- abogado (Fase 2). El administrador crea/edita/versiona las plantillas
  -- desde el panel. "version" sube en cada edición.
  CREATE TABLE IF NOT EXISTS plantillas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    categoria TEXT NOT NULL,
    titulo TEXT NOT NULL,
    cuerpo TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Encuestas (apartado "Encuestas", opcional para el usuario): formularios
  -- que el administrador arma desde el panel — una o varias preguntas de
  -- opción múltiple o de respuesta abierta, agrupadas por tema en una misma
  -- encuesta. "opciones" de encuestas_preguntas guarda un JSON (arreglo de
  -- texto) solo cuando tipo = 'opcion_multiple'.
  CREATE TABLE IF NOT EXISTS encuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT,
    activa INTEGER NOT NULL DEFAULT 1,
    orden INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS encuestas_preguntas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'abierta' CHECK (tipo IN ('abierta', 'opcion_multiple')),
    opciones TEXT,
    orden INTEGER NOT NULL DEFAULT 0
  );

  -- Una fila por usuario por encuesta (UNIQUE): responder y corregir la
  -- respuesta son la misma operación (UPSERT) mientras siga dentro del
  -- plazo de corrección (ver DIAS_PLAZO_EDICION_ENCUESTA en
  -- servidor/db/respuestasEncuestas.js). "correo" se guarda tal cual
  -- porque es justo el dato que el usuario aceptó compartir al mandar su
  -- respuesta (ver el aviso de encuestas.html) — nunca se vuelve a leer
  -- de otro lado. "primera_respuesta_en" nunca cambia (de ahí se cuenta
  -- el plazo de 3 días); "migrada_en" se llena cuando el barrido ya la
  -- archivó en la tabla "hoja" del día (ver hojaEncuestasDiaria.js), y
  -- desde ahí la respuesta queda congelada.
  CREATE TABLE IF NOT EXISTS encuestas_respuestas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encuesta_id INTEGER NOT NULL REFERENCES encuestas(id) ON DELETE CASCADE,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    correo TEXT NOT NULL,
    respuestas TEXT NOT NULL,
    primera_respuesta_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
    migrada_en TEXT,
    UNIQUE (encuesta_id, usuario_id)
  );

  -- "Hoja" de respuestas ya definitivas — ver servidor/db/hojaEncuestasDiaria.js.
  -- Cada DÍA en que el barrido archiva algo (ver
  -- servidor/encuestas/barridoRespuestas.js) se crea una tabla nueva,
  -- propia de ese día ("encuestas_hoja_AAAAMMDD"), en el mismo formato de
  -- filas y columnas que tendría una hoja de cálculo tipo Google Sheets
  -- (esto NO es una integración real con Google Sheets, solo imita su
  -- forma). Esta tabla es solo el REGISTRO de qué tablas diarias existen y
  -- cuándo le toca a cada una borrarse definitivamente — 3 meses después
  -- de su propio día. El administrador puede además borrar una tabla
  -- antes de tiempo a mano (ej. justo después de descargar su CSV).
  CREATE TABLE IF NOT EXISTS encuestas_hoja_tablas (
    fecha TEXT PRIMARY KEY,
    nombre_tabla TEXT NOT NULL UNIQUE,
    creada_en TEXT NOT NULL DEFAULT (datetime('now')),
    elimina_en TEXT NOT NULL
  );

  -- Noticias Jurídicas (burbuja "¿Qué pasó en el DOF la semana pasada?"):
  -- resúmenes de novedades legales que redacta el administrador desde el
  -- panel, en cuadros, para cualquier cuenta con sesión — sin pedir
  -- licencia vigente, igual que Música/Calendario/Encuestas. No recopila
  -- ningún dato del usuario: solo contenido que publica el administrador.
  -- Se ordenan por "fecha" (la que el admin le pone a la noticia), no por
  -- cuándo se cargó, para que la más reciente quede primero sin que el
  -- admin tenga que reordenar nada a mano. Un enlace que el admin escriba
  -- dentro de "cuerpo" se detecta y se pinta como enlace real (ver
  -- Sistema/noticiasJuridicasPrincipal.js) — no hay una columna aparte
  -- para eso, a propósito: así quien lee ve la URL real antes de tocarla,
  -- en vez de confiar en un botón genérico.
  CREATE TABLE IF NOT EXISTS noticias_juridicas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    fecha TEXT NOT NULL,
    cuerpo TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT (datetime('now')),
    actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Fotos de cada noticia (1 a 8 — ver servidor/noticiasJuridicasArchivos.js
  -- para dónde viven los archivos en disco). El orden de aparición es el
  -- mismo en que se subieron (id ASC), sin necesidad de una columna aparte.
  CREATE TABLE IF NOT EXISTS noticias_juridicas_imagenes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    noticia_id INTEGER NOT NULL REFERENCES noticias_juridicas(id) ON DELETE CASCADE,
    archivo TEXT NOT NULL,
    mime TEXT NOT NULL
  );
`);

// La tabla única "encuestas_hoja" (de la primera versión de este
// apartado, antes de que se pidiera una tabla nueva por día con borrado
// automático a los 3 meses) nunca llegó a tener datos reales — se
// elimina para no dejarla como peso muerto en el esquema.
db.exec('DROP TABLE IF EXISTS encuestas_hoja');

// El buzón de sugerencias se volvió anónimo (ver el comentario de la
// tabla "sugerencias" arriba): esto limpia cualquier vínculo con una
// cuenta que ya se hubiera guardado antes de este cambio. Correr esto en
// cada arranque no tiene costo — después de la primera vez ya no
// encuentra nada que actualizar.
db.exec('UPDATE sugerencias SET usuario_id = NULL WHERE usuario_id IS NOT NULL');

// Siembra las plantillas de EJEMPLO la primera vez (tabla vacía). Si el
// administrador las borra, no vuelven: la biblioteca real es suya.
const totalPlantillas = db.prepare('SELECT COUNT(*) AS n FROM plantillas').get().n;
if (totalPlantillas === 0) {
  const insertarPlantilla = db.prepare('INSERT INTO plantillas (categoria, titulo, cuerpo) VALUES (?, ?, ?)');
  for (const plantilla of PLANTILLAS_EJEMPLO) {
    insertarPlantilla.run(plantilla.categoria, plantilla.titulo, plantilla.cuerpo);
  }
}

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

// "nombre" es un apodo opcional que el usuario elige en "Mi cuenta"
// (ver configuracion.html). Solo se usa para saludarlo por su nombre en
// la pantalla de inicio (ver Sistema/frasesBienvenida.js); si está vacío,
// el saludo muestra el texto literal "[user]". Se agregó después de que
// la tabla "usuarios" ya existía, por eso va como ALTER TABLE aparte.
const yaTieneNombre = columnasDeUsuarios.some(columna => columna.name === 'nombre');
if (!yaTieneNombre) {
  db.exec('ALTER TABLE usuarios ADD COLUMN nombre TEXT');
}

// "limite_sesiones": cuántas sesiones simultáneas (dispositivos con
// sesión iniciada a la vez) se le permiten a ESTA cuenta en particular.
// NULL (el valor de siempre, para toda cuenta que el admin nunca ha
// tocado) significa "usa LIMITE_SESIONES_POR_DEFECTO" (ver
// servidor/config.js) — así, si ese valor por defecto cambia más
// adelante, se aplica también a las cuentas sin ajuste propio.
const yaTieneLimiteSesiones = columnasDeUsuarios.some(columna => columna.name === 'limite_sesiones');
if (!yaTieneLimiteSesiones) {
  db.exec('ALTER TABLE usuarios ADD COLUMN limite_sesiones INTEGER');
}

// "licencia_vitalicia": el Plan Fundador (acceso de por vida a la
// Plataforma, bajo cualquier operador que la llegue a tener en el
// futuro) se representa con esta bandera explícita, NO con una fecha muy
// lejana disfrazada de "para siempre" — así nunca hay una fecha falsa
// escondida en el sistema. Cuando vale 1, requiereLicenciaVigente (ver
// servidor/auth/middleware.js) y todo el código que reporta si la
// licencia está vigente ignoran por completo licencia_vence_en.
const yaTieneLicenciaVitalicia = columnasDeUsuarios.some(columna => columna.name === 'licencia_vitalicia');
if (!yaTieneLicenciaVitalicia) {
  db.exec('ALTER TABLE usuarios ADD COLUMN licencia_vitalicia INTEGER NOT NULL DEFAULT 0');
}

// Plan y modalidad de cada cuenta (ver servidor/db/despachos.js y la
// Cláusula 3.3 Bis de los Términos). Cada plan (Fundadores, Co-Fundadores,
// Mensual) tiene dos modalidades: "Abogad@" (una persona) y "Despacho"
// (5 usuarios). Una cuenta con despacho_id NULL es Abogad@ y su plan vive
// en usuarios.plan; una cuenta con despacho_id pertenece a ese Despacho y
// su plan es el del Despacho (despachos.plan). despacho_puesto es su
// número dentro del Despacho (#1 a #5). encuestas_canjeadas cuenta las
// respuestas definitivas que ya se usaron para un beneficio (Cláusula
// 6.1), para que no se canjeen dos veces.
const columnasNuevasDePlan = [
  ['plan', 'ALTER TABLE usuarios ADD COLUMN plan TEXT'],
  ['despacho_id', 'ALTER TABLE usuarios ADD COLUMN despacho_id INTEGER'],
  ['despacho_puesto', 'ALTER TABLE usuarios ADD COLUMN despacho_puesto INTEGER'],
  ['encuestas_canjeadas', 'ALTER TABLE usuarios ADD COLUMN encuestas_canjeadas INTEGER NOT NULL DEFAULT 0']
];
for (const [columna, sentencia] of columnasNuevasDePlan) {
  if (!columnasDeUsuarios.some(c => c.name === columna)) db.exec(sentencia);
}

// Un "Despacho" agrupa las cuentas de un plan de 5 usuarios. "tipo" es
// la modalidad elegida al contratar (Cláusula 2.2), que no puede
// alternarse después: 'compartida' = una sola Cuenta para hasta 10
// sesiones; 'independientes' = hasta 5 Cuentas propias.
db.exec(`
  CREATE TABLE IF NOT EXISTS despachos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK (tipo IN ('compartida', 'independientes')),
    plan TEXT,
    encuestas_canjeadas INTEGER NOT NULL DEFAULT 0,
    creado_en TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
