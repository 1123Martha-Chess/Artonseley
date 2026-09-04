// paginaConfiguracion.js
// -------------------------------------------------------------------
// Punto de entrada de configuracion.html. Antes la configuración era un
// menú desplegable del ícono ⚙️ (manejaConfiguracion.js, que todavía usa
// editor.html); ahora es una pantalla completa.
//
// Reúne:
//   - Mi cuenta: el correo (solo lectura) y el apodo del saludo del
//     inicio, que se guarda con POST /api/mi-cuenta.
//   - Personalización: el selector de modo de color, que pinta
//     manejaPersonalizacion.js dentro de #personalizacion.
//   - El acceso al Panel de administración (solo si el rol es admin).
//   - Cerrar sesión (POST /api/logout).
// -------------------------------------------------------------------

import { renderizarPersonalizacionEn } from './manejaPersonalizacion.js';
import * as recordatorios from './recordatoriosCalendario.js';

renderizarPersonalizacionEn(document.getElementById('personalizacion'));

const correoUsuario = document.getElementById('correoUsuario');
const campoNombre = document.getElementById('campoNombre');
const botonGuardarNombre = document.getElementById('botonGuardarNombre');
const confirmacionNombre = document.getElementById('confirmacionNombre');
const bloqueAdmin = document.getElementById('bloqueAdmin');
const botonCerrarSesion = document.getElementById('botonCerrarSesion');
const casillaBorradoCalendario = document.getElementById('casillaBorradoCalendario');
const confirmacionCalendario = document.getElementById('confirmacionCalendario');
const casillaRecordatorios = document.getElementById('casillaRecordatorios');
const estadoRecordatorios = document.getElementById('estadoRecordatorios');

cargarSesion();

botonGuardarNombre.addEventListener('click', guardarNombre);

botonCerrarSesion.addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' }).catch(() => {});
  window.location.href = 'login.html';
});

async function cargarSesion() {
  try {
    const respuesta = await fetch('/api/sesion');

    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!respuesta.ok) return;

    const sesion = await respuesta.json();
    correoUsuario.textContent = sesion.email;
    campoNombre.value = sesion.nombre || '';
    if (sesion.rol === 'admin') bloqueAdmin.hidden = false;

    configurarBorradoCalendario(sesion.email);
    configurarRecordatorios(sesion.email);
  } catch (error) {
    console.error('paginaConfiguracion.js: no se pudo consultar la sesión:', error);
  }
}

// El interruptor "Recordatorios del calendario": Web Push. La verdad de
// si está activado la tiene la suscripción del navegador (recordatorios.estado());
// la casilla solo la refleja. Ver Sistema/recordatoriosCalendario.js.
async function configurarRecordatorios(email) {
  if (!casillaRecordatorios) return;

  const pintar = (texto, esError = false) => {
    estadoRecordatorios.className = esError ? 'mensaje-error' : 'mensaje-ok';
    estadoRecordatorios.textContent = texto;
  };

  if (!recordatorios.soportado()) {
    casillaRecordatorios.disabled = true;
    pintar('Este navegador no permite estos recordatorios aquí. Ábrelo desde www.artonseley.site.', true);
    return;
  }

  const estadoInicial = await recordatorios.estado();
  casillaRecordatorios.checked = estadoInicial === 'activado';
  if (estadoInicial === 'permiso-denegado') {
    pintar('Bloqueaste las notificaciones para este sitio. Habilítalas en el candado de la barra de direcciones y vuelve a intentar.', true);
  } else if (estadoInicial === 'activado') {
    pintar('Activado. Recibirás un recordatorio al día en este navegador.');
  } else {
    pintar('');
  }

  // Mantiene viva la suscripción (renueva vencidas, actualiza el huso).
  recordatorios.sincronizar(email);

  casillaRecordatorios.addEventListener('change', async () => {
    casillaRecordatorios.disabled = true;
    try {
      if (casillaRecordatorios.checked) {
        pintar('Pidiendo permiso de notificaciones…');
        const resultado = await recordatorios.activar(email);
        if (resultado === 'activado') {
          pintar('Activado. Recibirás un recordatorio al día en este navegador.');
        } else if (resultado === 'permiso-denegado') {
          casillaRecordatorios.checked = false;
          pintar('No diste permiso de notificaciones, así que no se activó.', true);
        } else if (resultado === 'no-soportado') {
          casillaRecordatorios.checked = false;
          pintar('Este navegador no permite estos recordatorios aquí.', true);
        } else {
          casillaRecordatorios.checked = false;
          pintar('No se pudo activar. Intenta de nuevo en un momento.', true);
        }
      } else {
        await recordatorios.desactivar(email);
        pintar('Desactivado. Ya no recibirás recordatorios en este navegador.');
      }
    } finally {
      casillaRecordatorios.disabled = false;
    }
  });
}

// La casilla "borrar notas viejas del calendario" es una preferencia por
// navegador y por usuario: se guarda en localStorage con la misma clave
// que lee calendarioPrincipal.js (`calendario::borradoAutomatico::<correo>`).
// El calendario en sí no se toca desde aquí — solo esta bandera.
function configurarBorradoCalendario(email) {
  if (!casillaBorradoCalendario) return;
  const clave = `calendario::borradoAutomatico::${email}`;

  try {
    casillaBorradoCalendario.checked = localStorage.getItem(clave) === '1';
  } catch {
    // Sin localStorage: la casilla queda como está (desactivada).
  }

  casillaBorradoCalendario.addEventListener('change', () => {
    try {
      if (casillaBorradoCalendario.checked) {
        localStorage.setItem(clave, '1');
      } else {
        localStorage.removeItem(clave);
      }
      confirmacionCalendario.textContent = casillaBorradoCalendario.checked
        ? 'Activado. Las notas de más de un mes se borrarán al abrir el calendario.'
        : 'Desactivado. No se borrará ninguna nota automáticamente.';
    } catch {
      confirmacionCalendario.className = 'mensaje-error';
      confirmacionCalendario.textContent = 'Este navegador no permite guardar la preferencia.';
    }
  });
}

async function guardarNombre() {
  botonGuardarNombre.disabled = true;
  confirmacionNombre.className = '';
  confirmacionNombre.textContent = '';

  try {
    const respuesta = await fetch('/api/mi-cuenta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: campoNombre.value })
    });

    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.error || 'No se pudo guardar.');
    }

    campoNombre.value = datos.nombre || '';
    confirmacionNombre.className = 'mensaje-ok';
    confirmacionNombre.textContent = datos.nombre
      ? 'Listo, así te saludaremos en el inicio.'
      : 'Listo. El saludo del inicio mostrará "[user]".';
  } catch (error) {
    console.error('paginaConfiguracion.js: error al guardar el nombre:', error);
    confirmacionNombre.className = 'mensaje-error';
    confirmacionNombre.textContent = error.message || 'No se pudo guardar. Intenta de nuevo.';
  } finally {
    botonGuardarNombre.disabled = false;
  }
}
