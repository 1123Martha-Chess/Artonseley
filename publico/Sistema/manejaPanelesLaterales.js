// manejaPanelesLaterales.js
// -------------------------------------------------------------------
// Los tres paneles que se abren desde la barra superior — 🔔
// Notificaciones, y "Buzón de sugerencias" y "Personalización" (los dos
// dentro de ⚙️) — viven todos en el mismo lugar de la pantalla (a la
// derecha, ver la clase .panel-sugerencias en index.html). Antes cada
// uno se abría y cerraba por su cuenta (cada módulo hacía su propio
// classList.toggle('panel-abierto')), así que si abrías uno y luego
// otro, los dos quedaban abiertos y se encimaban en vez de que el
// segundo reemplazara al primero.
//
// Este archivo lleva el registro de cuál panel está abierto ahora
// mismo. manejaSugerencias.js, manejaBuzonSugerencias.js y
// manejaPersonalizacion.js llaman a alternarPanelLateral(suPanel) en
// vez de tocar la clase "panel-abierto" directamente, así que abrir
// cualquiera de los tres cierra automáticamente el que estuviera abierto.
// -------------------------------------------------------------------

let panelAbiertoActualmente = null;

export function alternarPanelLateral(panel) {
  if (!panel) return;

  const seVaAAbrir = !panel.classList.contains('panel-abierto');

  if (panelAbiertoActualmente && panelAbiertoActualmente !== panel) {
    panelAbiertoActualmente.classList.remove('panel-abierto');
  }

  panel.classList.toggle('panel-abierto', seVaAAbrir);
  panelAbiertoActualmente = seVaAAbrir ? panel : null;
}
