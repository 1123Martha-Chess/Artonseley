// formasPlurales.js
// -------------------------------------------------------------------
// El diccionario de sinónimos (diccionario.js) está escrito casi todo
// en singular. Antes de este archivo, buscar "ley" y buscar "leyes"
// daban resultados distintos: el motor solo reconocía la forma exacta
// tal cual estaba escrita en diccionario.js, y no sabía que una
// palabra en plural es la misma palabra que su forma singular.
//
// En vez de duplicar a mano cada una de las ~900 palabras y frases del
// diccionario agregándoles su plural (lo cual, para frases largas como
// "responsabilidad patrimonial del estado", requeriría decidir a mano
// qué palabra de la frase pluralizar y arriesgarse a escribirlo mal),
// este archivo centraliza las reglas de pluralización del español y
// las usa para comparar dos palabras por EQUIVALENCIA (¿son la misma
// palabra, una en singular y otra en plural?) en vez de por igualdad
// literal. Así cualquier palabra del diccionario reconoce su plural o
// singular automáticamente, incluidas las que se agreguen a futuro.
// -------------------------------------------------------------------

// Un puñado de sustantivos del español mueven el acento al pluralizar
// (la sílaba tónica no cambia de lugar, pero al ganar una sílaba deja
// de caer donde caía por default y hay que marcarlo con tilde). No hay
// una regla mecánica para esto — son excepciones que hay que enumerar.
// Se listan aquí las que aparecen en diccionario.js más las más
// comunes del español general, por si se agregan palabras parecidas.
const PLURALES_IRREGULARES = {
  crimen: 'crímenes',
  gravamen: 'gravámenes',
  joven: 'jóvenes',
  origen: 'orígenes',
  margen: 'márgenes',
  resumen: 'resúmenes',
  examen: 'exámenes',
  volumen: 'volúmenes',
  régimen: 'regímenes',
  espécimen: 'especímenes',
  carácter: 'caracteres',
};

const MAPA_SIN_ACENTO = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u' };

// Dada una palabra en singular, regresa su plural según las reglas
// generales del español. No es (ni pretende ser) un pluralizador
// perfecto para cualquier palabra del idioma — cubre los patrones que
// de verdad aparecen en el vocabulario jurídico de este diccionario.
export function pluralizarPalabra(palabraSingular) {
  const palabra = palabraSingular.toLowerCase().trim();

  if (palabra.length <= 2) return palabra;
  if (PLURALES_IRREGULARES[palabra]) return PLURALES_IRREGULARES[palabra];

  // Ya termina en "s": se asume que ya es plural (o invariable, como
  // "tesis"/"análisis") y se deja igual — intentar quitarle la "s" a
  // ciegas sería tan propenso a error como el problema que se corrige.
  if (palabra.endsWith('s')) return palabra;

  // "juez" -> "jueces", "voz" -> "voces", "matriz" -> "matrices"
  if (palabra.endsWith('z')) return palabra.slice(0, -1) + 'ces';

  // "ley" -> "leyes", "rey" -> "reyes"
  if (palabra.endsWith('y')) return palabra + 'es';

  // Palabras terminadas en "n" cuya vocal final lleva acento
  // ("legislación", "patrón", "motín"): al agregar "es" la sílaba
  // tónica queda donde ya caía por default, así que la tilde se
  // quita ("legislaciones", "patrones", "motines").
  if (palabra.endsWith('n')) {
    const vocalAcentuada = MAPA_SIN_ACENTO[palabra[palabra.length - 2]];
    if (vocalAcentuada) {
      return palabra.slice(0, -2) + vocalAcentuada + 'nes';
    }
    return palabra + 'es';
  }

  // Vocal simple (o acentuada, como "pagaré" -> "pagarés"): se agrega
  // solo "s".
  if (/[aeiouáéíóú]$/.test(palabra)) return palabra + 's';

  // Cualquier otra consonante: "tribunal" -> "tribunales",
  // "equidad" -> "equidades", "actor" -> "actores".
  return palabra + 'es';
}

// ¿"a" y "b" son la misma palabra, solo que una está en singular y la
// otra en plural? Para frases de varias palabras (como "carpeta de
// investigación") solo se flexiona la primera palabra (el sustantivo
// principal en la inmensa mayoría de las frases de este diccionario);
// el resto de la frase debe coincidir tal cual.
export function formasEquivalentes(a, b) {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return true;

  const espacioX = x.indexOf(' ');
  const espacioY = y.indexOf(' ');
  const primeraX = espacioX === -1 ? x : x.slice(0, espacioX);
  const restoX = espacioX === -1 ? '' : x.slice(espacioX);
  const primeraY = espacioY === -1 ? y : y.slice(0, espacioY);
  const restoY = espacioY === -1 ? '' : y.slice(espacioY);

  if (restoX !== restoY) return false;

  return pluralizarPalabra(primeraX) === primeraY || primeraX === pluralizarPalabra(primeraY);
}
