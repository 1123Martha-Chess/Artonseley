// frasesBienvenida.js
// -------------------------------------------------------------------
// La frase que saluda al usuario en la pantalla de inicio (index.html).
// Cada vez que se abre el inicio se elige una al azar de esta lista.
//
// En cada frase, "{user}" se reemplaza por el apodo que el usuario haya
// puesto en "Mi cuenta" (ver configuracion.html). Si todavía no eligió
// ninguno, se muestra el texto literal "[user]" — así el saludo deja
// claro que falta ese dato sin inventar un nombre.
//
// CÓMO EDITAR: agrega o quita renglones del arreglo FRASES. Usa "{user}"
// donde quieras que aparezca el nombre.
// -------------------------------------------------------------------

const FRASES = [
  'Bienvenido/a, {user}',
  '¿Por dónde empezarás, {user}?',
  '{user}, ¿cómo se empieza?',
  '¡Qué gusto verte de nuevo, {user}!',
  '¡Adelante, {user}!',
  '¿Preparado/a, {user}?',
  '¿Lista/o para hoy, {user}?',
  'Manos a la obra, {user}',
  '¿Qué vas a consultar hoy, {user}?',
  'Aquí estás de nuevo, {user}',
];

// Texto que se usa en lugar del apodo cuando el usuario no ha puesto uno.
export const NOMBRE_POR_DEFECTO = '[user]';

// nombre: el apodo del usuario, o null/'' si no tiene. Devuelve una frase
// ya lista para mostrar, con el nombre sustituido.
export function fraseDeBienvenidaAleatoria(nombre) {
  const nombreMostrado = (nombre && String(nombre).trim()) || NOMBRE_POR_DEFECTO;
  const plantilla = FRASES[Math.floor(Math.random() * FRASES.length)];
  return plantilla.replaceAll('{user}', nombreMostrado);
}
