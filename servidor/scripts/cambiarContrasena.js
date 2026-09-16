// cambiarContrasena.js
// -------------------------------------------------------------------
// Repone la contraseña de una cuenta YA EXISTENTE, desde la terminal.
// Es el mecanismo real de recuperación de acceso hoy: el Titular avisa
// (por correo o WhatsApp) que olvidó su contraseña, el administrador
// verifica que es él y le pone una nueva con este comando (o desde
// admin.html → "Usuarios y licencias" → "Cambiar contraseña"), y le
// avisa que ya puede entrar con ella.
//
// Uso:
//   npm run cambiar-contrasena -- correo@ejemplo.com "contraseñaNueva123"
// -------------------------------------------------------------------

import { buscarUsuarioPorEmail, actualizarContrasena } from '../db/usuarios.js';
import { hashContrasena } from '../auth/contrasenas.js';

const MINIMO_CONTRASENA = 8;

function main() {
  const [email, contrasena] = process.argv.slice(2);

  if (!email || !contrasena) {
    console.error('Uso: npm run cambiar-contrasena -- correo@ejemplo.com "contraseña nueva"');
    process.exit(1);
  }
  if (contrasena.length < MINIMO_CONTRASENA || contrasena.length > 200) {
    console.error(`La contraseña debe tener entre ${MINIMO_CONTRASENA} y 200 caracteres.`);
    process.exit(1);
  }

  const usuario = buscarUsuarioPorEmail(email);
  if (!usuario) {
    console.error(`No existe ninguna cuenta con el correo "${email}".`);
    process.exit(1);
  }

  actualizarContrasena(usuario.id, hashContrasena(contrasena));
  console.log(`Contraseña actualizada para "${usuario.email}".`);
}

main();
