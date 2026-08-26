// bloqueoDeAcceso.js
// -------------------------------------------------------------------
// Para cualquier página pública que NO tenga un comportamiento propio
// definido (a diferencia de crear-cuenta.html y de los enlaces "volver"
// de terminos-y-condiciones.html / avisos-de-privacidad.html): consulta
// una sola vez al montar si este dispositivo ya tiene sesión iniciada
// (ver estadoDispositivo.js) y, si no, cubre el contenido con un aviso
// y un acceso directo a "Crear Cuenta" — sin borrar el contenido real
// de la página, por si acaso.
//
// Uso: agrega en el HTML de la página
//   <script type="module" src="Sistema/verificarAcceso.js"></script>
// -------------------------------------------------------------------

import { obtenerEstadoDispositivo } from './estadoDispositivo.js';

export async function exigirCuentaLigada() {
  const { cuentaLigada } = await obtenerEstadoDispositivo();
  if (cuentaLigada) return;

  const overlay = document.createElement('div');
  overlay.className = 'bloqueo-acceso';
  overlay.innerHTML = `
    <div class="bloqueo-acceso-tarjeta">
      <p>Necesitas registrarte para acceder a esta plataforma</p>
      <a href="crear-cuenta.html" class="bloqueo-acceso-boton">Crear Cuenta</a>
    </div>
  `;
  document.body.appendChild(overlay);
}
