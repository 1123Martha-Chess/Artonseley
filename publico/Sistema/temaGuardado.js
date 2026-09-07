// temaGuardado.js
// -------------------------------------------------------------------
// Script CLÁSICO (no módulo). Se carga BLOQUEANTE en el <head> de cada
// página con tema, antes de cualquier contenido, para que la preferencia
// guardada (color de acento + tema claro/oscuro) se aplique ANTES del
// primer pintado y no haya parpadeo claro→oscuro.
//
// Solo hace lo mínimo para evitar el parpadeo: escribe --color-primario /
// --color-primario-suave y el atributo data-tema en <html>. El resto
// —pintar el selector de Configuración y reteñir el logo— corre después,
// sin prisa, en Sistema/manejaPersonalizacion.js.
//
// Los valores de aquí DEBEN coincidir con COLORES/TEMAS de
// manejaPersonalizacion.js (son 4 constantes, se toleró la duplicación a
// cambio de no cargar el módulo entero de forma bloqueante).
// -------------------------------------------------------------------
(function () {
  try {
    var raiz = document.documentElement;
    var color = localStorage.getItem('modoPersonalizacion'); // 'azul' | 'morado'
    var oscuro = localStorage.getItem('temaPersonalizacion') === 'oscuro';

    if (color === 'morado') {
      raiz.style.setProperty('--color-primario', '#8b0999');
      raiz.style.setProperty('--color-primario-suave', oscuro ? '#241026' : '#f6ebf7');
    } else if (oscuro) {
      // azul + oscuro: el tinte suave del bloque :root (claro) no aplica.
      raiz.style.setProperty('--color-primario-suave', '#1b2735');
    }

    if (oscuro) {
      raiz.setAttribute('data-tema', 'oscuro');
      raiz.style.colorScheme = 'dark';
    }
  } catch (e) {
    // Sin localStorage (modo privado estricto): queda el tema claro por
    // defecto, que es un estado válido.
  }
})();
