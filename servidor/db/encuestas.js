// encuestas.js
// -------------------------------------------------------------------
// Acceso a las tablas "encuestas" y "encuestas_preguntas" (ver
// conexion.js): el apartado "Encuestas", opcional para el usuario. Aquí
// solo vive el TEXTO de cada encuesta y sus preguntas; las respuestas
// (con el correo del usuario) viven en servidor/db/respuestasEncuestas.js.
//
// El administrador la gestiona desde el panel (rutas /api/admin/encuestas
// en servidor.js). El usuario la consume con GET /api/encuestas.
// -------------------------------------------------------------------

import { db, ejecutarEnTransaccion } from './conexion.js';

function preguntaAJSON(fila) {
  return {
    id: fila.id,
    texto: fila.texto,
    tipo: fila.tipo,
    opciones: fila.opciones ? JSON.parse(fila.opciones) : []
  };
}

export function listarPreguntasDeEncuesta(encuestaId) {
  return db
    .prepare('SELECT * FROM encuestas_preguntas WHERE encuesta_id = ? ORDER BY orden ASC, id ASC')
    .all(encuestaId)
    .map(preguntaAJSON);
}

// Para la burbuja de Encuestas: solo las activas, con sus preguntas ya
// incluidas para no tener que pedirlas aparte.
export function listarEncuestasActivasConPreguntas() {
  const encuestas = db
    .prepare('SELECT * FROM encuestas WHERE activa = 1 ORDER BY orden ASC, id ASC')
    .all();
  return encuestas.map((encuesta) => ({
    id: encuesta.id,
    titulo: encuesta.titulo,
    descripcion: encuesta.descripcion,
    preguntas: listarPreguntasDeEncuesta(encuesta.id)
  }));
}

// Para el panel de administración: todas (activas e inactivas), con sus preguntas.
export function listarEncuestasParaAdmin() {
  const encuestas = db.prepare('SELECT * FROM encuestas ORDER BY orden ASC, id ASC').all();
  return encuestas.map((encuesta) => ({
    id: encuesta.id,
    titulo: encuesta.titulo,
    descripcion: encuesta.descripcion,
    activa: !!encuesta.activa,
    actualizadoEn: encuesta.actualizado_en,
    preguntas: listarPreguntasDeEncuesta(encuesta.id)
  }));
}

export function buscarEncuestaPorId(id) {
  return db.prepare('SELECT * FROM encuestas WHERE id = ?').get(id);
}

function insertarPreguntas(encuestaId, preguntas) {
  const insertar = db.prepare(
    'INSERT INTO encuestas_preguntas (encuesta_id, texto, tipo, opciones, orden) VALUES (?, ?, ?, ?, ?)'
  );
  preguntas.forEach((pregunta, indice) => {
    insertar.run(
      encuestaId,
      pregunta.texto,
      pregunta.tipo,
      pregunta.tipo === 'opcion_multiple' ? JSON.stringify(pregunta.opciones) : null,
      indice
    );
  });
}

// Crea la encuesta y sus preguntas en una sola transacción: si algo falla
// a media inserción de preguntas, no queda una encuesta a medias.
export function crearEncuestaConPreguntas({ titulo, descripcion, preguntas }) {
  return ejecutarEnTransaccion(() => {
    const info = db
      .prepare('INSERT INTO encuestas (titulo, descripcion) VALUES (?, ?)')
      .run(titulo, descripcion || null);
    insertarPreguntas(info.lastInsertRowid, preguntas);
    return buscarEncuestaPorId(info.lastInsertRowid);
  });
}

// Igual que crear, pero reemplaza TODAS las preguntas anteriores por las
// nuevas (ON DELETE CASCADE en encuestas_preguntas.encuesta_id se encarga
// del borrado al eliminar la fila de "encuestas" — aquí solo se borran
// las preguntas, la encuesta se conserva).
export function actualizarEncuestaConPreguntas(id, { titulo, descripcion, preguntas }) {
  return ejecutarEnTransaccion(() => {
    db.prepare(
      `UPDATE encuestas SET titulo = ?, descripcion = ?, actualizado_en = datetime('now') WHERE id = ?`
    ).run(titulo, descripcion || null, id);
    db.prepare('DELETE FROM encuestas_preguntas WHERE encuesta_id = ?').run(id);
    insertarPreguntas(id, preguntas);
    return buscarEncuestaPorId(id);
  });
}

export function actualizarActivaDeEncuesta(id, activa) {
  db.prepare('UPDATE encuestas SET activa = ? WHERE id = ?').run(activa ? 1 : 0, id);
}

export function eliminarEncuesta(id) {
  db.prepare('DELETE FROM encuestas WHERE id = ?').run(id);
}
