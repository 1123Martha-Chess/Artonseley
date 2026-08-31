// ajustaEnlaceVolver.js
// -------------------------------------------------------------------
// Usado por las "hojas de documento" que son públicas pero NO deben
// bloquear su contenido cuando el dispositivo no tiene sesión:
// terminos-y-condiciones.html, avisos-de-privacidad.html y
// guia-de-uso.html.
//
// Todas esas páginas traen un enlace ".volver" fijo a "Volver al
// buscador". Esto lo ajusta una sola vez al montar la página, según si
// este dispositivo ya tiene cuenta ligada (ver estadoDispositivo.js):
//   - Con cuenta: se deja "← Volver al buscador" tal cual (el enlace
//     ya apunta a index.html; no hace falta tocar nada).
//   - Sin cuenta: se cambia a "← Ir a Crear Cuenta" apuntando a
//     crear-cuenta.html, porque mandarlo a index.html no serviría de
//     nada (esa página sí exige sesión).
//
// A diferencia de verificarAcceso.js / bloqueoDeAcceso.js, este script
// NO cubre el contenido: la página se puede leer sin cuenta.
// -------------------------------------------------------------------

import { obtenerEstadoDispositivo } from './estadoDispositivo.js';

const enlaceVolver = document.querySelector('.volver');

const { cuentaLigada } = await obtenerEstadoDispositivo();
if (!cuentaLigada && enlaceVolver) {
  enlaceVolver.href = 'crear-cuenta.html';
  enlaceVolver.textContent = '← Ir a Crear Cuenta';
}
