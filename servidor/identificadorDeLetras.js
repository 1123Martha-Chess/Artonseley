// IdentificadorDeLetras.js
// Objetivo: si el usuario escribe letras que NO forman una palabra completa,
// buscamos en el diccionario cuáles palabras empiezan con ese orden de letras.

// 1. Importamos el diccionario. (Ver nota debajo: hay que agregarle "export" en diccionario.js)
import { diccionarioLeyes } from './diccionario.js';
import { formasEquivalentes } from './formasPlurales.js';

// 2. Función principal
export function identificarLetras(entrada) {
  const texto = entrada.toLowerCase().trim();

  // Juntamos en una sola lista todas las palabras del diccionario:
  // los conceptos principales ("robo", "fraude"...) + todos sus sinónimos.
  // Usamos un Set para no repetir palabras que aparezcan dos veces.
  const todasLasPalabras = new Set();
  for (const concepto in diccionarioLeyes) {
    todasLasPalabras.add(concepto);
    diccionarioLeyes[concepto].forEach(sinonimo => {
      todasLasPalabras.add(sinonimo.toLowerCase());
    });
  }
  const listaCompleta = Array.from(todasLasPalabras);

  // PASO 1: ¿"texto" ya es una palabra completa del diccionario? Se
  // compara con formasEquivalentes (no con .includes()) para que el
  // plural o singular de una palabra del diccionario también cuente
  // como palabra completa (ej. escribir "leyes" encuentra "ley") y no
  // cualquier otra parte del código tenga que adivinarlo después.
  const coincidenciaExacta = listaCompleta.find(palabra => formasEquivalentes(palabra, texto));
  if (coincidenciaExacta) {
    return [coincidenciaExacta];
  }

  // PASO 2: no es palabra completa -> buscamos palabras que EMPIECEN con esas letras
  const coincidencias = listaCompleta.filter(palabra => palabra.startsWith(texto));

  return coincidencias;
}