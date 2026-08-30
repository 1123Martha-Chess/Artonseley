// criptografiaCuadernos.js
// -------------------------------------------------------------------
// Motor de cifrado y de la frase de recuperación (BIP-39) para "Mis
// cuadernos" (ver manejaBovedaCifrada.js). Todo corre en el navegador
// con Web Crypto API (window.crypto.subtle) — nada de esto se manda al
// servidor, ni siquiera para verificar la frase: es cero-conocimiento
// de verdad, el servidor nunca ve ni la frase ni el texto sin cifrar.
//
// Cómo encajan las piezas:
//   1) Frase de recuperación (12 palabras, BIP-39 real: con checksum,
//      no 12 palabras sueltas al azar) -> semilla de 64 bytes, con el
//      mismo algoritmo estándar que usan las billeteras de
//      criptomonedas (PBKDF2-HMAC-SHA512, 2048 iteraciones). Ver
//      generarFraseDeRecuperacion / derivarSemillaDesdeFrase.
//   2) Esa semilla + una sal (salt) al azar -> una llave AES-256 para
//      cifrar/descifrar, con PBKDF2-HMAC-SHA256 y 100,000+ iteraciones
//      (ver derivarClaveDesdeSemilla). La sal se guarda junto con los
//      datos cifrados — no es secreta, solo evita que la misma frase
//      produzca siempre la misma llave.
//   3) Cada cifrado (de un cuaderno, una nota, o un respaldo .arton)
//      usa un IV (vector de inicialización) de 12 bytes al azar, nuevo
//      cada vez — nunca se reutiliza un IV con la misma llave.
//
// Todas las llaves se generan/importan como "no exportables"
// (extractable: false): una vez creadas, el propio navegador impide
// sacarlas en crudo — solo sirven para cifrar/descifrar con
// SubtleCrypto, nunca se puede leer su valor desde JavaScript.
// -------------------------------------------------------------------

import { PALABRAS_BIP39_ES } from './listaPalabrasBip39Es.js';

// OJO — esto no es opcional, es la causa de un bug real que ya pasó: el
// archivo oficial de la lista en español (igual que otras listas BIP-39
// que no son inglés) guarda las tildes en Unicode "descompuesto" (NFD:
// la "a" y el acento como DOS caracteres separados), pero cuando alguien
// teclea una palabra con tilde en un teclado normal, el sistema casi
// siempre produce la forma "compuesta" (NFC: "á" como UN solo
// carácter). Las dos se VEN idénticas, pero en JavaScript
// "'á' === 'á'" puede dar false si una viene de cada forma — por eso
// hay que normalizar SIEMPRE antes de comparar (el propio estándar
// BIP-39 pide NFKD para esto). Sin este normalizarPalabra(), una frase
// escrita perfectamente bien podía rechazarse como "incorrecta" nada
// más por tener alguna palabra con tilde.
function normalizarPalabra(palabra) {
  return String(palabra).trim().normalize('NFKD').toLowerCase();
}

// Se arma una sola vez: palabra normalizada -> su posición en la lista.
const INDICE_POR_PALABRA_NORMALIZADA = new Map(
  PALABRAS_BIP39_ES.map((palabra, indice) => [normalizarPalabra(palabra), indice])
);

const ITERACIONES_PBKDF2_LLAVE = 100000;
const LARGO_IV_BYTES = 12;
const LARGO_ENTROPIA_BITS = 128; // 128 bits de entropía -> 12 palabras BIP-39
const LARGO_CHECKSUM_BITS = LARGO_ENTROPIA_BITS / 32; // 4 bits, por estándar BIP-39

// ===================== BIP-39: frase de recuperación =====================

// Genera una frase de recuperación de 12 palabras VÁLIDA de verdad (con
// el checksum del estándar BIP-39): 128 bits de entropía real +
// 4 bits de checksum (los primeros 4 bits del SHA-256 de esa
// entropía), repartidos en 12 grupos de 11 bits — cada uno es el
// índice de una palabra en PALABRAS_BIP39_ES.
export async function generarFraseDeRecuperacion() {
  const entropia = new Uint8Array(LARGO_ENTROPIA_BITS / 8);
  crypto.getRandomValues(entropia);

  const hashEntropia = new Uint8Array(await crypto.subtle.digest('SHA-256', entropia));
  const bitsCompletos = bytesABits(entropia) + bytesABits(hashEntropia).slice(0, LARGO_CHECKSUM_BITS);

  const palabras = [];
  for (let i = 0; i < bitsCompletos.length; i += 11) {
    const indice = parseInt(bitsCompletos.slice(i, i + 11), 2);
    palabras.push(PALABRAS_BIP39_ES[indice]);
  }
  return palabras; // arreglo de 12 palabras
}

// Verifica que una frase (12 palabras, ya sea la que se acaba de
// generar o una escrita a mano al desbloquear en otro dispositivo) sea
// una frase BIP-39 válida de verdad: todas las palabras existen en la
// lista Y el checksum cuadra. Avisa de un error de dedo ANTES de
// intentar descifrar nada con ella.
export async function fraseEsValida(palabras) {
  if (!Array.isArray(palabras) || palabras.length !== 12) return false;

  const indices = palabras.map((palabra) => INDICE_POR_PALABRA_NORMALIZADA.get(normalizarPalabra(palabra)) ?? -1);
  if (indices.some((indice) => indice === -1)) return false;

  const bitsCompletos = indices.map((indice) => indice.toString(2).padStart(11, '0')).join('');
  const bitsEntropia = bitsCompletos.slice(0, LARGO_ENTROPIA_BITS);
  const bitsChecksumEsperado = bitsCompletos.slice(LARGO_ENTROPIA_BITS);

  const entropia = bitsABytes(bitsEntropia);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', entropia));
  const bitsChecksumReal = bytesABits(hash).slice(0, LARGO_CHECKSUM_BITS);

  return bitsChecksumReal === bitsChecksumEsperado;
}

// Elige N posiciones distintas al azar entre 1 y "cantidadPalabras"
// (1-indexado, para mostrar "palabra #3" tal cual al usuario) — se usa
// para pedirle que confirme algunas palabras de su frase antes de dar
// por hecho que la anotó bien (ver manejaBovedaCifrada.js).
export function elegirPosicionesParaVerificar(cantidadPalabras = 12, cuantasVerificar = 3) {
  const posiciones = new Set();
  while (posiciones.size < cuantasVerificar) {
    const indiceAlAzar = crypto.getRandomValues(new Uint32Array(1))[0] % cantidadPalabras;
    posiciones.add(indiceAlAzar + 1);
  }
  return [...posiciones].sort((a, b) => a - b);
}

// ===================== Semilla BIP-39 (frase -> 64 bytes) =====================

// Semilla estándar BIP-39 (64 bytes) a partir de la frase: el mismo
// algoritmo que usa cualquier billetera compatible (PBKDF2-HMAC-SHA512,
// 2048 iteraciones, sal = "mnemonic" + una frase-contraseña opcional).
// Esta semilla NUNCA se guarda en ningún lado — vive solo en memoria
// mientras la bóveda está desbloqueada (ver manejaBovedaCifrada.js).
export async function derivarSemillaDesdeFrase(palabras, frasePassphrase = '') {
  const codificador = new TextEncoder();
  const mnemonico = palabras.join(' ').normalize('NFKD');
  const sal = ('mnemonic' + frasePassphrase).normalize('NFKD');

  const llaveBase = await crypto.subtle.importKey('raw', codificador.encode(mnemonico), { name: 'PBKDF2' }, false, [
    'deriveBits'
  ]);

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: codificador.encode(sal), iterations: 2048, hash: 'SHA-512' },
    llaveBase,
    512 // 64 bytes
  );

  return new Uint8Array(bits);
}

// ===================== Llave AES-256 (semilla + sal -> CryptoKey) =====================

export function generarSalAleatoria() {
  return crypto.getRandomValues(new Uint8Array(16));
}

// A partir de la semilla (ver arriba) y una sal al azar, deriva la
// llave AES-256 real usada para cifrar/descifrar. "extractable: false"
// -> una vez creada, el navegador no permite sacarla en crudo con
// ningún método de JavaScript, solo usarla para cifrar/descifrar.
export async function derivarClaveDesdeSemilla(semilla, sal) {
  const llaveBase = await crypto.subtle.importKey('raw', semilla, { name: 'PBKDF2' }, false, ['deriveKey']);

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: sal, iterations: ITERACIONES_PBKDF2_LLAVE, hash: 'SHA-256' },
    llaveBase,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ===================== Cifrar / descifrar (AES-GCM-256) =====================

// Cifra un texto (UTF-8) con AES-GCM-256. Genera un IV de 12 bytes al
// azar, nuevo en cada llamada — nunca se reutiliza un IV con la misma
// llave. Regresa {iv, ciphertext} en base64, listos para guardar.
export async function cifrarTexto(claveAES, textoPlano) {
  const iv = crypto.getRandomValues(new Uint8Array(LARGO_IV_BYTES));
  const datos = new TextEncoder().encode(textoPlano);

  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, claveAES, datos);

  return {
    iv: arrayBufferABase64(iv),
    ciphertext: arrayBufferABase64(cifrado)
  };
}

// Descifra lo que regresó cifrarTexto(). Si la llave es incorrecta (ej.
// se escribió mal la frase de recuperación) o los datos fueron
// alterados, AES-GCM lo detecta solo: el "tag" de autenticidad no
// cuadra y SubtleCrypto.decrypt truena con una excepción — se
// intercepta y se relanza un error claro, sin exponer nada del
// contenido cifrado ni distinguir cuál de los dos motivos fue.
export async function descifrarTexto(claveAES, ivBase64, ciphertextBase64) {
  const iv = base64AArrayBuffer(ivBase64);
  const datos = base64AArrayBuffer(ciphertextBase64);

  try {
    const descifrado = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, claveAES, datos);
    return new TextDecoder().decode(descifrado);
  } catch {
    throw new Error('No se pudo descifrar: la frase de recuperación es incorrecta, o los datos están dañados.');
  }
}

// ===================== base64 <-> bytes (para guardar/exportar) =====================

export function arrayBufferABase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  const TAMANO_BLOQUE = 0x8000; // evita desbordar la pila con String.fromCharCode(...bytes) en archivos grandes
  for (let i = 0; i < bytes.length; i += TAMANO_BLOQUE) {
    binario += String.fromCharCode.apply(null, bytes.subarray(i, i + TAMANO_BLOQUE));
  }
  return btoa(binario);
}

export function base64AArrayBuffer(base64) {
  return Uint8Array.from(atob(base64), (caracter) => caracter.charCodeAt(0));
}

// ===================== bits <-> bytes (solo para el checksum BIP-39) =====================

function bytesABits(bytes) {
  return Array.from(bytes)
    .map((byte) => byte.toString(2).padStart(8, '0'))
    .join('');
}

function bitsABytes(bits) {
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }
  return bytes;
}
