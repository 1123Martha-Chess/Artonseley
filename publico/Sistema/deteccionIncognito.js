// deteccionIncognito.js
// -------------------------------------------------------------------
// Heurística para detectar navegación privada/incógnito: no existe una
// API que lo diga directo ("¿estoy en modo privado?" no existe a
// propósito, para no delatar al usuario ante sitios curiosos), así que
// se usa una señal indirecta: en modo privado, la cuota de
// almacenamiento que reporta navigator.storage.estimate() suele ser
// muchísimo más chica que en una ventana normal — los navegadores
// limitan a propósito cuánto se puede guardar en una sesión privada,
// para que se borre fácil al cerrarla.
//
// Por qué importa aquí: la bóveda cifrada vive en IndexedDB de este
// navegador (ver almacenamientoCifradoIndexedDB.js) — en modo privado
// esos datos desaparecen en cuanto se cierra la ventana, así que dejar
// crear cuadernos ahí sería garantizar perderlos sin avisar.
//
// OJO — esto es una heurística, no una certeza absoluta: un
// dispositivo con muy poco disco libre en modo NORMAL también podría
// dar una cuota chica y disparar un falso positivo, y los navegadores
// van cambiando estos límites con el tiempo. Se documenta así de claro
// para quien mantenga esto en el futuro.
// -------------------------------------------------------------------

// Bajo este umbral (120 MB) se considera "probablemente modo privado" —
// es, en la práctica, el límite que usa Chrome en incógnito. Otros
// navegadores pueden variar; por eso es un umbral generoso y no un
// número exacto.
const UMBRAL_CUOTA_BYTES = 120 * 1024 * 1024;

export async function estaEnNavegacionPrivada() {
  if (!navigator.storage?.estimate) {
    // Si el navegador ni siquiera tiene esta API (muy viejo), no hay
    // forma de saberlo — se deja pasar en vez de bloquear a alguien
    // sin motivo real.
    return false;
  }

  try {
    const { quota } = await navigator.storage.estimate();
    if (typeof quota !== 'number') return false;
    return quota < UMBRAL_CUOTA_BYTES;
  } catch {
    return false;
  }
}
