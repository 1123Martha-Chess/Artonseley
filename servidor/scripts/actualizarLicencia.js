// actualizarLicencia.js
// -------------------------------------------------------------------
// Script chico para cambiar la fecha de vencimiento de licencia de un
// usuario ya existente, sin tener que editar la base de datos a mano.
// Útil tanto para renovar de verdad a alguien como para PROBAR el
// bloqueo por licencia vencida (poniéndole una fecha pasada).
//
// Si la cuenta todavía no vence (y no es vitalicia) y le das un número
// de meses, esos meses se SUMAN al tiempo que ya le quedaba, en vez de
// reiniciar la cuenta desde hoy — igual que al renovar desde el panel.
//
// Uso:
//   npm run actualizar-licencia -- correo@ejemplo.com 24            (24 meses, sumados a lo que le quedaba)
//   npm run actualizar-licencia -- correo@ejemplo.com 2024-01-01    (fecha ya pasada, para probar el bloqueo)
//   npm run actualizar-licencia -- correo@ejemplo.com vitalicia     (Plan Fundador: acceso de por vida)
// -------------------------------------------------------------------

import { buscarUsuarioPorEmail, actualizarLicencia } from '../db/usuarios.js';
import { calcularVigenciaLicencia } from '../calcularVigenciaLicencia.js';

function main() {
  const [email, vigencia] = process.argv.slice(2);

  if (!email || !vigencia) {
    console.error('Uso: npm run actualizar-licencia -- correo@ejemplo.com [meses|AAAA-MM-DD|vitalicia]');
    process.exit(1);
  }

  const usuario = buscarUsuarioPorEmail(email);
  if (!usuario) {
    console.error(`No existe ningún usuario con el correo "${email}".`);
    process.exit(1);
  }

  if (vigencia.trim().toLowerCase() === 'vitalicia') {
    actualizarLicencia(usuario.id, { licenciaVenceEn: null, licenciaVitalicia: true });
    console.log(`Licencia de ${usuario.email} actualizada: ahora es vitalicia (Plan Fundador).`);
    return;
  }

  const licenciaVigenteYNoVitalicia = !usuario.licencia_vitalicia && new Date(usuario.licencia_vence_en) > new Date();
  const licenciaVenceEn = calcularVigenciaLicencia(vigencia, {
    desde: licenciaVigenteYNoVitalicia ? usuario.licencia_vence_en : null
  });
  actualizarLicencia(usuario.id, { licenciaVenceEn, licenciaVitalicia: false });

  console.log(`Licencia de ${usuario.email} actualizada. Ahora vence: ${new Date(licenciaVenceEn).toLocaleString('es-MX')}`);
}

main();
