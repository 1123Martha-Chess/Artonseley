// manejaPaginaLegal.js
// -------------------------------------------------------------------
// Usado por terminos-y-condiciones.html y avisos-de-privacidad.html.
// Ambas páginas ya traían un enlace ".volver" fijo a "Volver al
// buscador"; esto lo ajusta una sola vez al montar la página, según si
// este dispositivo ya tiene sesión iniciada (ver estadoDispositivo.js):
//   - Con sesión: se deja "Volver al buscador" tal cual (comportamiento
//     por defecto del HTML, no hace falta tocar nada).
//   - Sin sesión: se cambia a "Ir a Crear Cuenta", porque mandarlo a
//     index.html no serviría de nada (esa página también exige sesión).
// -------------------------------------------------------------------

import { obtenerEstadoDispositivo } from './estadoDispositivo.js';

const enlaceVolver = document.querySelector('.volver');

const { cuentaLigada } = await obtenerEstadoDispositivo();
if (!cuentaLigada && enlaceVolver) {
  enlaceVolver.href = 'crear-cuenta.html';
  enlaceVolver.textContent = '← Ir a Crear Cuenta';
}
