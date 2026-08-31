// verificarAcceso.js
// -------------------------------------------------------------------
// Bootstrap de una línea para páginas públicas que deban BLOQUEAR su
// contenido cuando el dispositivo no tiene sesión iniciada (ver
// bloqueoDeAcceso.js). Agrega este mismo script tag a la página.
//
// Nota: guia-de-uso.html y las páginas legales NO usan esto — se pueden
// leer sin cuenta y solo ajustan su enlace "Volver" (ver
// ajustaEnlaceVolver.js). Hoy ninguna página usa este bootstrap, pero
// se conserva como patrón para páginas futuras que sí deban bloquearse.
// -------------------------------------------------------------------

import { exigirCuentaLigada } from './bloqueoDeAcceso.js';

exigirCuentaLigada();
