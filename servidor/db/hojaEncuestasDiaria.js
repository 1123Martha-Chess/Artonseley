// hojaEncuestasDiaria.js
// -------------------------------------------------------------------
// La "hoja" de respuestas ya definitivas de Encuestas, partida en una
// tabla de SQLite POR DÍA (ver el comentario de "encuestas_hoja_tablas"
// en conexion.js). Cada día en que el barrido archiva algo (ver
// servidor/encuestas/barridoRespuestas.js) se crea, si no existía ya,
// una tabla nueva ("encuestas_hoja_AAAAMMDD") y se registra cuándo le
// toca borrarse definitivamente: 3 meses después de ESE día. Así, cada
// tabla vive sus 3 meses y desaparece sola — no hay una sola tabla
// creciendo sin límite con datos de hace años.
//
// SQLite no permite parametrizar un nombre de tabla en una consulta
// preparada, así que el nombre se escribe directo en el SQL. Para que
// eso sea seguro, el nombre de tabla NUNCA se arma a partir de lo que
// manda una petición: se arma aquí mismo a partir de una fecha
// 'AAAA-MM-DD' generada por el propio servidor (ver
// servidor/encuestas/barridoRespuestas.js), y cuando una ruta necesita
// referirse a la tabla de un día en particular, primero busca ese día
// en el registro (con una consulta parametrizada normal) y usa el
// nombre YA GUARDADO ahí — nunca el texto que llegó en la URL.
// -------------------------------------------------------------------

import { db } from './conexion.js';

export const MESES_RETENCION_HOJA_ENCUESTAS = 3;

function nombreTablaDelDia(fecha) {
  return `encuestas_hoja_${fecha.replace(/-/g, '')}`;
}

export function fechaDeHoy() {
  return new Date().toISOString().slice(0, 10); // 'AAAA-MM-DD', UTC
}

function sumarMeses(fechaTexto, meses) {
  const fecha = new Date(`${fechaTexto}T00:00:00Z`);
  fecha.setUTCMonth(fecha.getUTCMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

// Da de alta la tabla del día si todavía no existe, y siempre regresa su
// registro (fecha, nombre_tabla, elimina_en).
function asegurarTablaDelDia(fecha) {
  const existente = db.prepare('SELECT * FROM encuestas_hoja_tablas WHERE fecha = ?').get(fecha);
  if (existente) return existente;

  const nombreTabla = nombreTablaDelDia(fecha);
  db.exec(`
    CREATE TABLE IF NOT EXISTS "${nombreTabla}" (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      encuesta_id INTEGER NOT NULL,
      encuesta_titulo TEXT NOT NULL,
      pregunta_id INTEGER NOT NULL,
      pregunta_texto TEXT NOT NULL,
      correo TEXT NOT NULL,
      respuesta TEXT NOT NULL,
      respondido_en TEXT NOT NULL,
      archivado_en TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  const eliminaEn = sumarMeses(fecha, MESES_RETENCION_HOJA_ENCUESTAS);
  db.prepare(
    'INSERT INTO encuestas_hoja_tablas (fecha, nombre_tabla, elimina_en) VALUES (?, ?, ?)'
  ).run(fecha, nombreTabla, eliminaEn);
  return { fecha, nombre_tabla: nombreTabla, elimina_en: eliminaEn };
}

// Vuelca una respuesta (una fila por pregunta contestada) a la tabla del
// día de HOY — el día en que el barrido la archiva, no el día en que el
// usuario originalmente contestó.
export function archivarEnHojaDeHoy({ encuestaId, encuestaTitulo, correo, respuestas, respondidoEn, preguntasPorId }) {
  const registro = asegurarTablaDelDia(fechaDeHoy());
  const insertar = db.prepare(
    `INSERT INTO "${registro.nombre_tabla}"
       (encuesta_id, encuesta_titulo, pregunta_id, pregunta_texto, correo, respuesta, respondido_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const [preguntaId, respuesta] of Object.entries(respuestas)) {
    const pregunta = preguntasPorId.get(Number(preguntaId));
    insertar.run(
      encuestaId,
      encuestaTitulo,
      Number(preguntaId),
      pregunta ? pregunta.texto : '(pregunta eliminada)',
      correo,
      String(respuesta ?? ''),
      respondidoEn
    );
  }
}

// Para el panel de administración: una fila por tabla/día, con cuántas
// respuestas tiene y cuándo se borra sola.
export function listarTablasHoja() {
  const registros = db.prepare('SELECT * FROM encuestas_hoja_tablas ORDER BY fecha DESC').all();
  return registros.map((registro) => ({
    fecha: registro.fecha,
    creadaEn: registro.creada_en,
    eliminaEn: registro.elimina_en,
    filas: db.prepare(`SELECT COUNT(*) AS n FROM "${registro.nombre_tabla}"`).get().n
  }));
}

function buscarRegistroPorFecha(fecha) {
  return db.prepare('SELECT * FROM encuestas_hoja_tablas WHERE fecha = ?').get(fecha);
}

// null si esa fecha nunca tuvo tabla o ya se borró (no distingue entre
// los dos casos — a la ruta que llama esto solo le importa "ya no está").
export function listarFilasDeTabla(fecha) {
  const registro = buscarRegistroPorFecha(fecha);
  if (!registro) return null;
  return db.prepare(`SELECT * FROM "${registro.nombre_tabla}" ORDER BY id DESC`).all();
}

function borrarTabla(registro) {
  db.exec(`DROP TABLE IF EXISTS "${registro.nombre_tabla}"`);
  db.prepare('DELETE FROM encuestas_hoja_tablas WHERE fecha = ?').run(registro.fecha);
}

// Borrado manual desde el panel (ej. justo después de descargar el CSV
// de ese día — la responsabilidad de conservar o no esa copia descargada
// es del administrador, ver el aviso en admin.html). Devuelve false si
// esa fecha ya no existía.
export function eliminarTablaHojaAhora(fecha) {
  const registro = buscarRegistroPorFecha(fecha);
  if (!registro) return false;
  borrarTabla(registro);
  return true;
}

// Para el barrido periódico (ver servidor/encuestas/barridoRespuestas.js):
// borra definitivamente cada tabla cuyos 3 meses ya se cumplieron.
export function purgarTablasVencidas() {
  const hoy = fechaDeHoy();
  const vencidas = db.prepare('SELECT * FROM encuestas_hoja_tablas WHERE elimina_en <= ?').all(hoy);
  for (const registro of vencidas) {
    borrarTabla(registro);
  }
  return vencidas.length;
}
