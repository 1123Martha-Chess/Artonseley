// probarCifradoCuadernos.js
// -------------------------------------------------------------------
// Verificación manual del motor de cifrado de "Mis cuadernos" (ver
// publico/Sistema/criptografiaCuadernos.js). Este proyecto no usa un
// framework de pruebas (ver CLAUDE.md: "no test suite, no linter, no
// build step") — así que en vez de Jest/Vitest, este es un script
// normal de Node que corre los mismos casos que pediría una prueba
// unitaria, usando solo node:assert (ya viene con Node, cero
// dependencias nuevas). El motor de cifrado usa únicamente Web Crypto
// API (globalThis.crypto.subtle), disponible también en Node desde la
// versión 19 — por eso este mismo módulo del navegador se puede probar
// aquí tal cual, sin abrir un navegador.
//
// Para correrlo:
//   npm run probar-cifrado
// -------------------------------------------------------------------

import assert from 'node:assert/strict';
import {
  generarFraseDeRecuperacion,
  fraseEsValida,
  derivarSemillaDesdeFrase,
  derivarClaveDesdeSemilla,
  generarSalAleatoria,
  cifrarTexto,
  descifrarTexto
} from '../../publico/Sistema/criptografiaCuadernos.js';

let pruebasCorridas = 0;

async function prueba(nombre, funcion) {
  pruebasCorridas++;
  try {
    await funcion();
    console.log(`✔ ${nombre}`);
  } catch (error) {
    console.error(`✘ ${nombre}`);
    console.error(error);
    process.exitCode = 1;
  }
}

async function derivarClaveDePrueba(palabras, sal) {
  const semilla = await derivarSemillaDesdeFrase(palabras);
  return derivarClaveDesdeSemilla(semilla, sal);
}

// Regresión de un bug real: la lista oficial de palabras en español
// guarda las tildes en Unicode "descompuesto" (NFD — la vocal y el
// acento como dos caracteres separados), pero teclear una tilde en un
// teclado normal produce la forma "compuesta" (NFC — un solo
// carácter). Se ven idénticas, pero sin normalizar antes de comparar,
// una frase escrita perfectamente bien se rechazaba como inválida en
// cuanto tenía alguna palabra con tilde (ver criptografiaCuadernos.js).
await prueba('fraseEsValida() acepta una palabra con tilde tecleada en forma NFC (normal)', async () => {
  let frase = null;
  for (let intento = 0; intento < 300 && !frase; intento++) {
    const candidata = await generarFraseDeRecuperacion();
    if (candidata.some((palabra) => palabra !== palabra.normalize('NFC'))) frase = candidata;
  }
  assert.ok(frase, 'no salió ninguna palabra con tilde en 300 intentos — revisa la lista');

  const fraseTecleadaAMano = frase.map((palabra) => palabra.normalize('NFC'));
  assert.equal(await fraseEsValida(fraseTecleadaAMano), true);
});

await prueba('generarFraseDeRecuperacion() da 12 palabras y es válida según BIP-39', async () => {
  const frase = await generarFraseDeRecuperacion();
  assert.equal(frase.length, 12);
  assert.equal(await fraseEsValida(frase), true);
});

await prueba('fraseEsValida() rechaza una palabra que no está en la lista', async () => {
  const frase = await generarFraseDeRecuperacion();
  frase[0] = 'palabraquenoexisteenlalista';
  assert.equal(await fraseEsValida(frase), false);
});

await prueba('fraseEsValida() rechaza un cambio de palabra que rompe el checksum', async () => {
  const frase = await generarFraseDeRecuperacion();
  // Cambia la última palabra por otra válida de la lista, pero eso
  // rompe el checksum salvo coincidencia astronómica.
  const otraFrase = await generarFraseDeRecuperacion();
  frase[11] = otraFrase[0] === frase[11] ? otraFrase[1] : otraFrase[0];
  assert.equal(await fraseEsValida(frase), false);
});

await prueba('un texto cifrado con una frase se descifra igual con la MISMA frase', async () => {
  const frase = await generarFraseDeRecuperacion();
  const sal = generarSalAleatoria();
  const clave = await derivarClaveDePrueba(frase, sal);

  const textoOriginal = 'Artículo de prueba: esto debe ir y volver exactamente igual, con acentos y "símbolos".';
  const { iv, ciphertext } = await cifrarTexto(clave, textoOriginal);

  // Se vuelve a derivar la MISMA llave desde cero (como pasaría al
  // volver a abrir la bóveda en otra sesión) para probar que no hace
  // falta guardar la llave en sí, solo la frase + la sal.
  const claveReconstruida = await derivarClaveDePrueba(frase, sal);
  const textoDescifrado = await descifrarTexto(claveReconstruida, iv, ciphertext);

  assert.equal(textoDescifrado, textoOriginal);
});

await prueba('un texto cifrado con una frase NO se descifra con una frase DISTINTA', async () => {
  const fraseA = await generarFraseDeRecuperacion();
  const fraseB = await generarFraseDeRecuperacion();
  const sal = generarSalAleatoria();

  const claveA = await derivarClaveDePrueba(fraseA, sal);
  const { iv, ciphertext } = await cifrarTexto(claveA, 'Contenido secreto del cuaderno.');

  const claveB = await derivarClaveDePrueba(fraseB, sal);
  await assert.rejects(() => descifrarTexto(claveB, iv, ciphertext));
});

await prueba('una sal distinta con la MISMA frase también produce una llave distinta (no descifra)', async () => {
  const frase = await generarFraseDeRecuperacion();
  const salUno = generarSalAleatoria();
  const salDos = generarSalAleatoria();

  const claveUno = await derivarClaveDePrueba(frase, salUno);
  const { iv, ciphertext } = await cifrarTexto(claveUno, 'Otro contenido de prueba.');

  const claveDos = await derivarClaveDePrueba(frase, salDos);
  await assert.rejects(() => descifrarTexto(claveDos, iv, ciphertext));
});

await prueba('dos cifrados del mismo texto con la misma llave usan IVs distintos', async () => {
  const frase = await generarFraseDeRecuperacion();
  const clave = await derivarClaveDePrueba(frase, generarSalAleatoria());

  const primero = await cifrarTexto(clave, 'Mismo texto, dos veces.');
  const segundo = await cifrarTexto(clave, 'Mismo texto, dos veces.');

  assert.notEqual(primero.iv, segundo.iv);
  assert.notEqual(primero.ciphertext, segundo.ciphertext);
});

console.log(`\n${pruebasCorridas} verificaciones corridas.`);
if (process.exitCode === 1) {
  console.error('❌ Alguna verificación falló — revisa criptografiaCuadernos.js.');
} else {
  console.log('✅ Todo bien: el cifrado va y vuelve con la frase correcta, y falla con cualquier otra.');
}
