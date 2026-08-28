// crearUsuario.js
// -------------------------------------------------------------------
// Script de línea de comandos para dar de alta un usuario (fundador o
// administrador) sin necesitar todavía el panel de administración
// (eso llega en la Fase 3). La duración de la licencia NO está fija en
// el código: se la das tú explícitamente cada vez, como fecha exacta o
// como "número de meses a partir de hoy" — así el "24 meses" de la
// versión fundadores es una decisión que tomas al correr el comando,
// no una constante enterrada en el sistema.
//
// Uso:
//   npm run crear-usuario -- correo@ejemplo.com "contraseñaSegura123" abogado 24
//   npm run crear-usuario -- admin@ejemplo.com "otraContraseña"        admin   2026-12-31
//
// Argumentos:
//   1) email
//   2) contraseña en texto plano (solo se usa para calcular el hash; nunca se guarda así)
//   3) rol: "abogado" o "admin" (opcional, por defecto "abogado")
//   4) vigencia de la licencia: un número = meses a partir de hoy,
//      o una fecha AAAA-MM-DD (opcional, por defecto 24 meses desde hoy)
// -------------------------------------------------------------------

import { crearUsuario, buscarUsuarioPorEmail } from '../db/usuarios.js';
import { hashContrasena } from '../auth/contrasenas.js';
import { calcularVigenciaLicencia } from '../calcularVigenciaLicencia.js';

function main() {
  const [email, contrasena, rol = 'abogado', vigencia] = process.argv.slice(2);

  if (!email || !contrasena) {
    console.error(
      'Uso: npm run crear-usuario -- correo@ejemplo.com "contraseña" [abogado|admin] [meses|AAAA-MM-DD]'
    );
    process.exit(1);
  }

  if (rol !== 'abogado' && rol !== 'admin') {
    console.error(`Rol inválido: "${rol}". Debe ser "abogado" o "admin".`);
    process.exit(1);
  }

  if (buscarUsuarioPorEmail(email)) {
    console.error(`Ya existe un usuario con el correo "${email}".`);
    process.exit(1);
  }

  const licenciaVenceEn = calcularVigenciaLicencia(vigencia, { porDefectoMeses: 24 });
  const usuario = crearUsuario({
    email,
    hashContrasena: hashContrasena(contrasena),
    rol,
    licenciaVenceEn
  });

  console.log('Usuario creado:');
  console.log(`  id: ${usuario.id}`);
  console.log(`  email: ${usuario.email}`);
  console.log(`  rol: ${usuario.rol}`);
  console.log(`  licencia vence: ${new Date(usuario.licencia_vence_en).toLocaleString('es-MX')}`);
}

main();
