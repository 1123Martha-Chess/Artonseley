// generarVapid.js
// -------------------------------------------------------------------
// Genera UNA vez el par de claves VAPID que necesitan los "Recordatorios
// del calendario" (notificaciones Web Push). Copia los dos valores que
// imprime a tu archivo .env (VAPID_PUBLICA y VAPID_PRIVADA) y reinicia el
// servidor.
//
// Uso:
//   npm run generar-vapid
//
// Genera el par UNA sola vez y NO lo vuelvas a correr una vez que haya
// usuarios suscritos: si cambias las claves, todas las suscripciones
// existentes dejan de servir y cada usuario tendría que volver a activar
// los recordatorios.
// -------------------------------------------------------------------

import webpush from 'web-push';

const claves = webpush.generateVAPIDKeys();

console.log('\nClaves VAPID generadas. Pégalas en tu archivo .env:\n');
console.log(`VAPID_PUBLICA=${claves.publicKey}`);
console.log(`VAPID_PRIVADA=${claves.privateKey}`);
console.log('\n(La pública también viaja al navegador; la privada NUNCA sale del servidor.)\n');
