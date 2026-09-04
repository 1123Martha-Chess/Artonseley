// extraerVariables.js
// -------------------------------------------------------------------
// Encuentra los marcadores {{clave}} de una plantilla y arma, para cada
// uno, una etiqueta legible para el formulario de captura del cliente.
// El admin solo escribe el texto con sus marcadores; la lista de
// variables sale de aquí, no se captura a mano.
// -------------------------------------------------------------------

const PATRON_MARCADOR = /\{\{\s*([\w.]+)\s*\}\}/g;

// 'cliente.nombre'   -> 'Cliente — nombre'
// 'expedienteNumero' -> 'Expediente Numero'
function etiquetaDesde(clave) {
  return clave
    .split('.')
    .map((parte) =>
      parte
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase())
    )
    .join(' — ');
}

export function extraerVariables(cuerpo) {
  const texto = String(cuerpo ?? '');
  const claves = [...new Set([...texto.matchAll(PATRON_MARCADOR)].map((m) => m[1]))];
  return claves.map((clave) => ({ clave, etiqueta: etiquetaDesde(clave) }));
}
