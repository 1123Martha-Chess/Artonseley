// encuestasPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de encuestas.html. Apartado OPCIONAL: el usuario
// decide si lo usa o no. Antes de poder contestar cualquier encuesta se
// muestra un aviso (ver bloqueAviso en encuestas.html) explicando que su
// correo viajará junto con sus respuestas — solo se avanza si acepta,
// con una segunda confirmación (window.confirm) para evitar un clic
// accidental. Esa aceptación se guarda en localStorage por correo, igual
// que otras preferencias por cuenta de este proyecto (ver
// "calendario::borradoAutomatico::<email>" en calendarioPrincipal.js), y
// se puede retirar en cualquier momento desde este mismo apartado.
//
// El servidor (GET /api/encuestas) ya manda, por cada encuesta activa,
// si el usuario ya la contestó y si todavía puede corregir su respuesta
// (dentro del plazo de "diasPlazoEdicion" días desde la primera vez que
// la contestó) — este archivo solo pinta ese estado y manda el
// formulario a POST /api/encuestas/:id/respuestas.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';

aplicarModoGuardado();

let usuarioEmail = null;

const bloqueAviso = document.getElementById('bloqueAviso');
const bloqueEncuestas = document.getElementById('bloqueEncuestas');
const botonAceptar = document.getElementById('botonAceptarEncuestas');

iniciar();

async function iniciar() {
  try {
    const respuesta = await fetch('/api/sesion');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const sesion = await respuesta.json();
    usuarioEmail = sesion.email;
  } catch (error) {
    console.error('encuestasPrincipal.js: no se pudo confirmar la sesión:', error);
    return;
  }

  botonAceptar.addEventListener('click', aceptarAviso);

  if (localStorage.getItem(claveConsentimiento())) {
    mostrarEncuestas();
  } else {
    bloqueAviso.hidden = false;
  }
}

function claveConsentimiento() {
  return `encuestas::consentimiento::${usuarioEmail}`;
}

function aceptarAviso() {
  const confirmado = window.confirm('¿Estás segur@ que aceptas compartir el correo electrónico con tus respuestas?');
  if (!confirmado) return;
  localStorage.setItem(claveConsentimiento(), '1');
  mostrarEncuestas();
}

function retirarConsentimiento() {
  localStorage.removeItem(claveConsentimiento());
  bloqueEncuestas.hidden = true;
  bloqueEncuestas.innerHTML = '';
  bloqueAviso.hidden = false;
}

async function mostrarEncuestas() {
  bloqueAviso.hidden = true;
  bloqueEncuestas.hidden = false;
  bloqueEncuestas.innerHTML = '<p class="mensaje-carga">Cargando encuestas…</p>';

  let datos;
  try {
    const respuesta = await fetch('/api/encuestas');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);
    datos = await respuesta.json();
  } catch (error) {
    console.error('encuestasPrincipal.js: no se pudieron cargar las encuestas:', error);
    bloqueEncuestas.innerHTML = '<p class="mensaje-error">No se pudieron cargar las encuestas.</p>';
    return;
  }

  pintarEncuestas(datos.encuestas || []);
}

function pintarEncuestas(encuestas) {
  bloqueEncuestas.innerHTML = '';

  if (encuestas.length === 0) {
    const p = document.createElement('p');
    p.className = 'bloque enc-vacio';
    p.textContent = 'No hay ninguna encuesta disponible por el momento. Vuelve más tarde.';
    bloqueEncuestas.appendChild(p);
  } else {
    for (const encuesta of encuestas) {
      bloqueEncuestas.appendChild(crearTarjetaEncuesta(encuesta));
    }
  }

  const botonRetirar = document.createElement('button');
  botonRetirar.type = 'button';
  botonRetirar.className = 'enc-retirar';
  botonRetirar.textContent = 'Ya no quiero participar (retirar mi aceptación)';
  botonRetirar.addEventListener('click', retirarConsentimiento);
  bloqueEncuestas.appendChild(botonRetirar);
}

function crearTarjetaEncuesta(encuesta) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'bloque enc-encuesta';

  const h3 = document.createElement('h3');
  h3.textContent = encuesta.titulo;
  tarjeta.appendChild(h3);

  if (encuesta.descripcion) {
    const descripcion = document.createElement('p');
    descripcion.className = 'enc-descripcion-encuesta';
    descripcion.textContent = encuesta.descripcion;
    tarjeta.appendChild(descripcion);
  }

  const miRespuesta = encuesta.miRespuesta;

  // Respuesta ya definitiva (pasó el plazo de corrección): solo lectura,
  // sin formulario — así queda congelada tal como se usó para otorgar el
  // beneficio ofrecido.
  if (miRespuesta && !miRespuesta.editable) {
    const estado = document.createElement('span');
    estado.className = 'enc-estado enc-estado-definitiva';
    estado.textContent = 'Respuesta definitiva — ¡gracias por participar!';
    tarjeta.appendChild(estado);

    for (const pregunta of encuesta.preguntas) {
      const bloquePregunta = document.createElement('div');
      bloquePregunta.className = 'enc-pregunta';
      const label = document.createElement('label');
      label.className = 'enc-texto-pregunta';
      label.textContent = pregunta.texto;
      const valor = document.createElement('p');
      valor.className = 'enc-respuesta-congelada';
      valor.textContent = miRespuesta.respuestas[pregunta.id] ?? '—';
      bloquePregunta.append(label, valor);
      tarjeta.appendChild(bloquePregunta);
    }
    return tarjeta;
  }

  if (miRespuesta && miRespuesta.editable) {
    const estado = document.createElement('span');
    estado.className = 'enc-estado enc-estado-editable';
    estado.textContent =
      `Ya respondiste — puedes corregir tu respuesta hasta el ${new Date(miRespuesta.plazoVenceEn).toLocaleString('es-MX')}.`;
    tarjeta.appendChild(estado);
  }

  const seleccionActual = miRespuesta ? { ...miRespuesta.respuestas } : {};

  const form = document.createElement('form');
  for (const pregunta of encuesta.preguntas) {
    form.appendChild(crearCampoPregunta(pregunta, seleccionActual));
  }

  const botonEnviar = document.createElement('button');
  botonEnviar.type = 'submit';
  botonEnviar.className = 'boton-plataforma';
  botonEnviar.textContent = miRespuesta ? 'Actualizar respuestas' : 'Enviar respuestas';
  form.appendChild(botonEnviar);

  const mensaje = document.createElement('p');
  form.appendChild(mensaje);

  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    botonEnviar.disabled = true;
    mensaje.className = '';
    mensaje.textContent = '';

    try {
      const respuesta = await fetch(`/api/encuestas/${encuesta.id}/respuestas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: seleccionActual })
      });

      if (respuesta.status === 401) {
        window.location.href = 'login.html';
        return;
      }
      if (!respuesta.ok) {
        const datosError = await respuesta.json().catch(() => ({}));
        throw new Error(datosError.error || 'No se pudo enviar tu respuesta.');
      }

      mensaje.className = 'mensaje-ok';
      mensaje.textContent = '¡Gracias! Tu respuesta quedó guardada.';
      await mostrarEncuestas();
    } catch (error) {
      mensaje.className = 'mensaje-error';
      mensaje.textContent = error.message;
      botonEnviar.disabled = false;
    }
  });

  tarjeta.appendChild(form);
  return tarjeta;
}

function crearCampoPregunta(pregunta, seleccionActual) {
  const bloque = document.createElement('div');
  bloque.className = 'enc-pregunta';

  const label = document.createElement('label');
  label.className = 'enc-texto-pregunta';
  label.textContent = pregunta.texto;
  bloque.appendChild(label);

  if (pregunta.tipo === 'opcion_multiple') {
    const contenedorOpciones = document.createElement('div');
    contenedorOpciones.className = 'enc-opciones';

    for (const opcion of pregunta.opciones) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton-checkbox';
      boton.textContent = opcion;
      boton.classList.toggle('activo', seleccionActual[pregunta.id] === opcion);
      boton.addEventListener('click', () => {
        seleccionActual[pregunta.id] = opcion;
        contenedorOpciones.querySelectorAll('.boton-checkbox').forEach((b) => {
          b.classList.toggle('activo', b.textContent === opcion);
        });
      });
      contenedorOpciones.appendChild(boton);
    }

    bloque.appendChild(contenedorOpciones);
  } else {
    const textarea = document.createElement('textarea');
    textarea.className = 'campo-texto';
    textarea.rows = 3;
    textarea.value = seleccionActual[pregunta.id] || '';
    textarea.addEventListener('input', () => {
      seleccionActual[pregunta.id] = textarea.value;
    });
    bloque.appendChild(textarea);
  }

  return bloque;
}
