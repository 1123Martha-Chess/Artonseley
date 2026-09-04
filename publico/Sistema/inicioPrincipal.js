// inicioPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de index.html, que ahora es la PANTALLA DE INICIO
// (las "burbujas" de acceso), no el buscador. Hace dos cosas:
//
//   1) Aplica el modo de color guardado (ver manejaPersonalizacion.js),
//      igual que las demás páginas de la plataforma.
//   2) Pide la sesión a /api/sesion para saludar al usuario por su apodo
//      y elige una frase al azar (ver frasesBienvenida.js). Si no hay
//      sesión, manda al login.
//
// Las burbujas son enlaces normales en el HTML — este archivo no las
// toca; solo se ocupa del saludo y el color.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';
import { fraseDeBienvenidaAleatoria } from './frasesBienvenida.js';

console.log('inicioPrincipal.js se cargó correctamente.');

aplicarModoGuardado();

const saludo = document.getElementById('saludo');

try {
  const respuesta = await fetch('/api/sesion');

  if (respuesta.status === 401) {
    window.location.href = 'login.html';
  } else if (respuesta.ok) {
    const sesion = await respuesta.json();
    if (saludo) saludo.textContent = fraseDeBienvenidaAleatoria(sesion.nombre);
  }
  // Cualquier otro código: se deja el saludo genérico que ya trae el HTML.
} catch (error) {
  console.error('inicioPrincipal.js: no se pudo consultar la sesión:', error);
  // Sin conexión: también se queda el saludo genérico del HTML.
}
