// calcularVigenciaLicencia.js
// -------------------------------------------------------------------
// Convierte "cuánto dura la licencia" —expresado como número de meses a
// partir de hoy, o como fecha exacta AAAA-MM-DD— en la fecha ISO que se
// guarda en usuarios.licencia_vence_en.
//
// Vive aquí, y no repetida en cada script, porque ahora la usan tres
// caminos: los scripts de terminal (scripts/crearUsuario.js y
// scripts/actualizarLicencia.js) y el panel de administración (rutas
// POST /api/admin/usuarios, .../:id/licencia y
// .../solicitudes-registro/:id/aprobar en servidor.js).
//
// Lanza un Error con mensaje en español si el valor no sirve; quien la
// llama decide si eso es un console.error + exit (scripts) o un 400 con
// ese mismo texto (API).
// -------------------------------------------------------------------

// "desde": fecha base para el "número de meses" (por defecto, hoy). Al
// RENOVAR una licencia que todavía no vence, servidor.js manda aquí la
// fecha de vencimiento actual en vez de "hoy", para que los meses
// nuevos se SUMEN al tiempo que ya le quedaba en vez de reiniciar la
// cuenta desde cero — así una renovación anticipada nunca le quita
// tiempo a nadie. Al CREAR una cuenta nueva no aplica (no hay nada que
// extender), así que ese caso simplemente no manda "desde".
export function calcularVigenciaLicencia(valor, { porDefectoMeses = null, desde = null } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (porDefectoMeses === null) {
      throw new Error('Falta indicar la vigencia de la licencia (número de meses o fecha AAAA-MM-DD).');
    }
    return mesesDesde(porDefectoMeses, desde);
  }

  const texto = String(valor).trim();

  if (/^\d+$/.test(texto)) {
    const meses = Number(texto);
    if (meses <= 0) {
      throw new Error('El número de meses debe ser mayor a 0.');
    }
    return mesesDesde(meses, desde);
  }

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`"${texto}" no es ni un número de meses ni una fecha válida (usa AAAA-MM-DD).`);
  }
  return fecha.toISOString();
}

function mesesDesde(meses, desde) {
  const fecha = desde ? new Date(desde) : new Date();
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString();
}
