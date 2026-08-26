// verificarAcceso.js
// -------------------------------------------------------------------
// Bootstrap de una línea para páginas públicas sin comportamiento propio
// (hoy: guia-de-uso.html). Agrega este mismo script tag a cualquier
// página pública nueva que deba bloquearse cuando el dispositivo no
// tiene sesión iniciada (ver bloqueoDeAcceso.js).
// -------------------------------------------------------------------

import { exigirCuentaLigada } from './bloqueoDeAcceso.js';

exigirCuentaLigada();
