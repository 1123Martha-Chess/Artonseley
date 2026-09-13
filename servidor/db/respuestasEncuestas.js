// respuestasEncuestas.js
// -------------------------------------------------------------------
// Acceso a "encuestas_respuestas" (la respuesta de un usuario a una
// encuesta, mientras sigue dentro del plazo de corrección) y a
// "encuestas_hoja" (donde quedan archivadas, ya definitivas, en un
// formato de filas y columnas tipo hoja de cálculo).
//
// Responder y corregir la respuesta son la misma operación: mientras no
// hayan pasado DIAS_PLAZO_EDICION_ENCUESTA días desde la PRIMERA vez que
// el usuario contestó esa encuesta (y mientras el barrido no la haya
// archivado ya), un nuevo envío actualiza la respuesta existente en vez
// de crear una segunda. Pasado ese plazo, la respuesta queda congelada
// para poder otorgar el beneficio ofrecido sin que cambie después.
// -------------------------------------------------------------------

import { db } from './conexion.js';

export const DIAS_PLAZO_EDICION_ENCUESTA = 3;

// Fecha límite para corregir una respuesta, a partir de la primera vez
// que se contestó esa encuesta (nunca desde la última corrección).
export function calcularPlazoVenceEn(primeraRespuestaEn) {
  return new Date(new Date(primeraRespuestaEn).getTime() + DIAS_PLAZO_EDICION_ENCUESTA * 24 * 60 * 60 * 1000);
}

export function haPasadoElPlazo(primeraRespuestaEn) {
  return new Date() > calcularPlazoVenceEn(primeraRespuestaEn);
}

function respuestaAJSON(fila) {
  const primeraRespuestaEn = fila.primera_respuesta_en;
  const editable = !fila.migrada_en && !haPasadoElPlazo(primeraRespuestaEn);
  return {
    encuestaId: fila.encuesta_id,
    respuestas: JSON.parse(fila.respuestas),
    primeraRespuestaEn,
    actualizadoEn: fila.actualizado_en,
    plazoVenceEn: calcularPlazoVenceEn(primeraRespuestaEn).toISOString(),
    editable
  };
}

export function buscarRespuesta(encuestaId, usuarioId) {
  return db
    .prepare('SELECT * FROM encuestas_respuestas WHERE encuesta_id = ? AND usuario_id = ?')
    .get(encuestaId, usuarioId);
}

// Para pintar en la lista de encuestas si el usuario ya contestó cada
// una, y si todavía puede corregir su respuesta.
export function listarRespuestasDeUsuarioComoMapa(usuarioId) {
  const filas = db.prepare('SELECT * FROM encuestas_respuestas WHERE usuario_id = ?').all(usuarioId);
  const mapa = new Map();
  for (const fila of filas) {
    mapa.set(fila.encuesta_id, respuestaAJSON(fila));
  }
  return mapa;
}

export function crearRespuesta({ encuestaId, usuarioId, correo, respuestas }) {
  db.prepare(
    'INSERT INTO encuestas_respuestas (encuesta_id, usuario_id, correo, respuestas) VALUES (?, ?, ?, ?)'
  ).run(encuestaId, usuarioId, correo, JSON.stringify(respuestas));
}

export function actualizarRespuesta(id, respuestas) {
  db.prepare(
    `UPDATE encuestas_respuestas SET respuestas = ?, actualizado_en = datetime('now') WHERE id = ?`
  ).run(JSON.stringify(respuestas), id);
}

// Para el barrido (ver servidor/encuestas/barridoRespuestas.js): todas
// las respuestas que todavía no se archivaron.
export function listarRespuestasNoMigradas() {
  return db.prepare('SELECT * FROM encuestas_respuestas WHERE migrada_en IS NULL').all();
}

export function marcarRespuestaMigrada(id) {
  db.prepare(`UPDATE encuestas_respuestas SET migrada_en = datetime('now') WHERE id = ?`).run(id);
}

// Vuelca una respuesta (una fila por pregunta contestada) a la "hoja" —
// ver el comentario de encuestas_hoja en conexion.js sobre por qué tiene
// esta forma. preguntasPorId permite seguir mostrando el texto de la
// pregunta aunque el administrador la haya editado o borrado después.
export function archivarEnHoja({ encuestaId, encuestaTitulo, correo, respuestas, respondidoEn, preguntasPorId }) {
  const insertar = db.prepare(
    `INSERT INTO encuestas_hoja
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

// Para el panel de administración: las respuestas ya definitivas, más
// nuevas primero — es la que se revisa para otorgar el beneficio
// ofrecido a quien contestó.
export function listarHojaParaAdmin() {
  return db.prepare('SELECT * FROM encuestas_hoja ORDER BY archivado_en DESC, id DESC').all();
}
