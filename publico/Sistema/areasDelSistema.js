// areasDelSistema.js
// -------------------------------------------------------------------
// Lista única de las "áreas" del sistema. Cada área es su propia página
// completa (buscador.html, calendario.html, ...). Esta lista la comparten
// dos pantallas que muestran varias áreas a la vez:
//
//   - El Escritorio (escritorioPrincipal.js): ventanas en mosaico sobre
//     una cuadrícula. NO se ofrece a sí mismo (no tiene sentido un
//     Escritorio dentro del Escritorio).
//   - Pestañas (pestanasPrincipal.js): un navegador interno con pestañas
//     tipo Chrome/Edge. NO se ofrece a sí mismo.
//
// Cada área: { id, nombre, icono, url }. Para agregar una nueva área al
// sistema basta con sumar una entrada aquí y las dos pantallas la toman.
// -------------------------------------------------------------------

export const AREAS = [
  { id: 'buscador', nombre: 'Buscador', icono: '🔍', url: 'buscador.html' },
  { id: 'cuadernos', nombre: 'Cuadernos', icono: '📓', url: 'editor.html' },
  { id: 'notificaciones', nombre: 'Notificaciones', icono: '🔔', url: 'notificaciones.html' },
  { id: 'sugerencias', nombre: 'Sugerencias', icono: '💡', url: 'sugerencias.html' },
  { id: 'configuracion', nombre: 'Configuración', icono: '⚙️', url: 'configuracion.html' },
  { id: 'calendario', nombre: 'Calendario', icono: '📅', url: 'calendario.html' },
  { id: 'musica', nombre: 'Música', icono: '🎵', url: 'musica.html' },
  { id: 'calculadora', nombre: 'Calculadora', icono: '🧮', url: 'calculadora.html' },
  { id: 'plantillas', nombre: 'Plantillas', icono: '📝', url: 'plantillas.html' },
  { id: 'escritorio', nombre: 'Escritorio', icono: '🧩', url: 'escritorio.html' },
  { id: 'pestanas', nombre: 'Pestañas', icono: '🗂️', url: 'pestanas.html' }
];

export const AREA_POR_ID = Object.fromEntries(AREAS.map((a) => [a.id, a]));
