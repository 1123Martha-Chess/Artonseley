// manejaCrearCuenta.js
// -------------------------------------------------------------------
// Lógica de crear-cuenta.html. Al montar, consulta una sola vez
// /api/auth/estado-dispositivo (ver estadoDispositivo.js): si este
// dispositivo ya tiene sesión iniciada, oculta el formulario y muestra
// "Ya tienes una cuenta en este dispositivo"; si no, muestra el
// formulario normal.
//
// El formulario NO crea una cuenta capaz de iniciar sesión: manda
// POST /api/auth/solicitudes-registro, que solo deja la solicitud en una
// bandeja para que el administrador la revise y dé de alta la cuenta
// real a mano (ver el comentario en servidor/db/solicitudesRegistro.js).
// -------------------------------------------------------------------

import { obtenerEstadoDispositivo } from './estadoDispositivo.js';

const bloqueCuentaExistente = document.getElementById('bloqueCuentaExistente');
const bloqueFormulario = document.getElementById('bloqueFormulario');
const formulario = document.getElementById('formularioCrearCuenta');
const campoEmail = document.getElementById('campoEmail');
const campoContrasena = document.getElementById('campoContrasena');
const campoAceptoTerminos = document.getElementById('campoAceptoTerminos');
const botonCrearCuenta = document.getElementById('botonCrearCuenta');
const mensajeCrearCuenta = document.getElementById('mensajeCrearCuenta');

const MINIMO_CONTRASENA = 8;

function correoEsValido(valor) {
  return campoEmail.validity.valid && valor.trim().length > 0;
}

function actualizarEstadoBoton() {
  const correoValido = correoEsValido(campoEmail.value);
  const contrasenaValida = campoContrasena.value.length >= MINIMO_CONTRASENA;
  botonCrearCuenta.disabled = !(correoValido && contrasenaValida && campoAceptoTerminos.checked);
}

[campoEmail, campoContrasena].forEach(campo => campo.addEventListener('input', actualizarEstadoBoton));
campoAceptoTerminos.addEventListener('change', actualizarEstadoBoton);

formulario.addEventListener('submit', async (evento) => {
  evento.preventDefault();

  mensajeCrearCuenta.textContent = 'Enviando…';
  mensajeCrearCuenta.classList.remove('error');
  botonCrearCuenta.disabled = true;

  try {
    const respuesta = await fetch('/api/auth/solicitudes-registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: campoEmail.value.trim(),
        contrasena: campoContrasena.value,
        aceptoTerminos: campoAceptoTerminos.checked
      })
    });

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      mensajeCrearCuenta.textContent = datos.error || 'No se pudo enviar tu solicitud. Intenta de nuevo.';
      mensajeCrearCuenta.classList.add('error');
      actualizarEstadoBoton();
      return;
    }

    formulario.innerHTML = '';
    mensajeCrearCuenta.classList.remove('error');
    mensajeCrearCuenta.textContent = 'Tu solicitud fue enviada. Nos pondremos en contacto contigo por correo para activar tu cuenta.';
  } catch (error) {
    console.error('Error al conectar con el servidor:', error);
    mensajeCrearCuenta.textContent = 'No se pudo conectar con el servidor. Intenta de nuevo.';
    mensajeCrearCuenta.classList.add('error');
    actualizarEstadoBoton();
  }
});

const { cuentaLigada } = await obtenerEstadoDispositivo();
if (cuentaLigada) {
  bloqueFormulario.classList.add('oculto');
  bloqueCuentaExistente.classList.remove('oculto');
}
