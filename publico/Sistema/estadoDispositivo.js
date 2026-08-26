// estadoDispositivo.js
// -------------------------------------------------------------------
// Helper compartido por las páginas públicas (crear-cuenta.html,
// terminos-y-condiciones.html, avisos-de-privacidad.html, guia-de-uso.html,
// y cualquier otra que se agregue después) para preguntarle al servidor,
// una sola vez al montar la página, si este navegador ya tiene una
// sesión iniciada. Nunca hace polling: cada página lo llama una vez y
// decide qué mostrar con la respuesta.
// -------------------------------------------------------------------

export async function obtenerEstadoDispositivo() {
  try {
    const respuesta = await fetch('/api/auth/estado-dispositivo');
    if (!respuesta.ok) return { cuentaLigada: false };
    return await respuesta.json();
  } catch (error) {
    console.error('No se pudo consultar el estado del dispositivo:', error);
    return { cuentaLigada: false };
  }
}
