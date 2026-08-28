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

export function calcularVigenciaLicencia(valor, { porDefectoMeses = null } = {}) {
  if (valor === undefined || valor === null || String(valor).trim() === '') {
    if (porDefectoMeses === null) {
      throw new Error('Falta indicar la vigencia de la licencia (número de meses o fecha AAAA-MM-DD).');
    }
    return mesesDesdeHoy(porDefectoMeses);
  }

  const texto = String(valor).trim();

  if (/^\d+$/.test(texto)) {
    const meses = Number(texto);
    if (meses <= 0) {
      throw new Error('El número de meses debe ser mayor a 0.');
    }
    return mesesDesdeHoy(meses);
  }

  const fecha = new Date(texto);
  if (Number.isNaN(fecha.getTime())) {
    throw new Error(`"${texto}" no es ni un número de meses ni una fecha válida (usa AAAA-MM-DD).`);
  }
  return fecha.toISOString();
}

function mesesDesdeHoy(meses) {
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString();
}
