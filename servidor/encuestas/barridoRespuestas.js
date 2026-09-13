// barridoRespuestas.js
// -------------------------------------------------------------------
// Archiva en "encuestas_hoja" (ver el comentario en conexion.js) toda
// respuesta a una encuesta cuyo plazo de corrección (ver
// DIAS_PLAZO_EDICION_ENCUESTA en servidor/db/respuestasEncuestas.js) ya
// venció. A partir de ahí la respuesta queda congelada — es la señal de
// que ya se puede otorgar el beneficio ofrecido por contestarla, sin que
// el dato cambie después.
//
// Corre en un temporizador interno (ver servidor.js), igual que el
// barrido de recordatoriosCalendario.js.
// -------------------------------------------------------------------

import { buscarEncuestaPorId, listarPreguntasDeEncuesta } from '../db/encuestas.js';
import {
  listarRespuestasNoMigradas,
  marcarRespuestaMigrada,
  archivarEnHoja,
  haPasadoElPlazo
} from '../db/respuestasEncuestas.js';

export function barrerYArchivar() {
  const resumen = { archivadas: 0 };

  for (const fila of listarRespuestasNoMigradas()) {
    if (!haPasadoElPlazo(fila.primera_respuesta_en)) continue;

    const encuesta = buscarEncuestaPorId(fila.encuesta_id);
    const preguntasPorId = new Map(
      listarPreguntasDeEncuesta(fila.encuesta_id).map((pregunta) => [pregunta.id, pregunta])
    );

    archivarEnHoja({
      encuestaId: fila.encuesta_id,
      encuestaTitulo: encuesta ? encuesta.titulo : '(encuesta eliminada)',
      correo: fila.correo,
      respuestas: JSON.parse(fila.respuestas),
      respondidoEn: fila.primera_respuesta_en,
      preguntasPorId
    });
    marcarRespuestaMigrada(fila.id);
    resumen.archivadas++;
  }

  return resumen;
}
