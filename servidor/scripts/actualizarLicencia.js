// actualizarLicencia.js
// -------------------------------------------------------------------
// Script chico para cambiar la fecha de vencimiento de licencia de un
// usuario ya existente, sin tener que editar la base de datos a mano.
// Útil tanto para renovar de verdad a alguien como para PROBAR el
// bloqueo por licencia vencida (poniéndole una fecha pasada).
//
// Uso:
//   npm run actualizar-licencia -- correo@ejemplo.com 24            (24 meses desde hoy)
//   npm run actualizar-licencia -- correo@ejemplo.com 2024-01-01    (fecha ya pasada, para probar el bloqueo)
// -------------------------------------------------------------------

import { buscarUsuarioPorEmail, actualizarLicencia } from '../db/usuarios.js';
import { calcularVigenciaLicencia } from '../calcularVigenciaLicencia.js';

function main() {
  const [email, vigencia] = process.argv.slice(2);

  if (!email || !vigencia) {
    console.error('Uso: npm run actualizar-licencia -- correo@ejemplo.com [meses|AAAA-MM-DD]');
    process.exit(1);
  }

  const usuario = buscarUsuarioPorEmail(email);
  if (!usuario) {
    console.error(`No existe ningún usuario con el correo "${email}".`);
    process.exit(1);
  }

  const licenciaVenceEn = calcularVigenciaLicencia(vigencia);
  actualizarLicencia(usuario.id, licenciaVenceEn);

  console.log(`Licencia de ${usuario.email} actualizada. Ahora vence: ${new Date(licenciaVenceEn).toLocaleString('es-MX')}`);
}

main();
