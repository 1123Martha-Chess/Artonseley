// contrasenas.js
// -------------------------------------------------------------------
// Hash de contraseñas con bcryptjs (implementación en JS puro, no el
// paquete "bcrypt" nativo). Se eligió así para no depender de
// compilación nativa (node-gyp / Visual Studio Build Tools) al hacer
// npm install en Windows sin ese toolchain ya instalado — para el
// volumen de usuarios de este sistema, la seguridad práctica es
// equivalente.
// -------------------------------------------------------------------

import bcrypt from 'bcryptjs';

const RONDAS_SAL = 12;

export function hashContrasena(contrasenaPlana) {
  return bcrypt.hashSync(contrasenaPlana, RONDAS_SAL);
}

export function verificarContrasena(contrasenaPlana, hashGuardado) {
  return bcrypt.compareSync(contrasenaPlana, hashGuardado);
}
