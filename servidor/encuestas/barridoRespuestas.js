// barridoRespuestas.js
// -------------------------------------------------------------------
// Dos tareas, una sola vez por hora (ver servidor.js):
//
//   1) Archiva en la "hoja" del día de HOY (ver
//      servidor/db/hojaEncuestasDiaria.js) toda respuesta a una encuesta
//      cuyo plazo de corrección (ver DIAS_PLAZO_EDICION_ENCUESTA en
//      servidor/db/respuestasEncuestas.js) ya venció. A partir de ahí la
//      respuesta queda congelada — es la señal de que ya se puede
//      otorgar el beneficio ofrecido por contestarla, sin que el dato
//      cambie después.
//   2) Borra definitivamente cualquier tabla-día de la hoja cuyos 3 meses
//      de retención ya se cumplieron (ver purgarTablasVencidas).
// -------------------------------------------------------------------

import { buscarEncuestaPorId, listarPreguntasDeEncuesta } from '../db/encuestas.js';
import {
  listarRespuestasNoMigradas,
  marcarRespuestaMigrada,
  haPasadoElPlazo
} from '../db/respuestasEncuestas.js';
import { archivarEnHojaDeHoy, purgarTablasVencidas } from '../db/hojaEncuestasDiaria.js';

export function barrerYArchivar() {
  const resumen = { archivadas: 0, tablasBorradas: 0 };

  for (const fila of listarRespuestasNoMigradas()) {
    if (!haPasadoElPlazo(fila.primera_respuesta_en)) continue;

    const encuesta = buscarEncuestaPorId(fila.encuesta_id);
    const preguntasPorId = new Map(
      listarPreguntasDeEncuesta(fila.encuesta_id).map((pregunta) => [pregunta.id, pregunta])
    );

    archivarEnHojaDeHoy({
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

  resumen.tablasBorradas = purgarTablasVencidas();
  return resumen;
}
