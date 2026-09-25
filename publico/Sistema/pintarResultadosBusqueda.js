// pintarResultadosBusqueda.js
// -------------------------------------------------------------------
// Convierte la lista de resultados que regresa POST /api/buscar en
// tarjetas (.tarjeta-articulo), igual que en el buscador original. Lo
// usa buscadorPrincipal.js (buscador.html). Antes también lo usaba el
// buscador embebido de "Cuadernos" (editor.html), que se quitó porque
// con Escritorio/Pestañas el Buscador ya se abre al lado.
//
// Cada resultado que regresa el servidor tiene esta forma:
//   [Documento: "Artículo 210" Título] (coincide con: ...) texto del artículo
// Si cambias el formato de LectorDeJSON.formatearResultado en el
// servidor, actualiza también PATRON_ENCABEZADO_RESULTADO aquí abajo.
// -------------------------------------------------------------------

export const PATRON_ENCABEZADO_RESULTADO = /^(\[.*?\](?:\s\([^)]*\))?)\s(.*)$/s;

export function pintarResultados(contenedor, resultados, avisos = []) {
  contenedor.innerHTML = '';

  avisos.forEach((aviso) => {
    const parrafoAviso = document.createElement('p');
    parrafoAviso.classList.add('aviso-similares');
    parrafoAviso.textContent = aviso;
    contenedor.appendChild(parrafoAviso);
  });

  resultados.forEach((resultado) => {
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('tarjeta-articulo');

    const coincidencia = resultado.match(PATRON_ENCABEZADO_RESULTADO);

    if (coincidencia) {
      const encabezado = document.createElement('p');
      encabezado.classList.add('tarjeta-encabezado');
      encabezado.textContent = coincidencia[1].trim();
      tarjeta.appendChild(encabezado);

      const cuerpo = document.createElement('p');
      cuerpo.classList.add('tarjeta-cuerpo');
      cuerpo.textContent = coincidencia[2].trim();
      tarjeta.appendChild(cuerpo);
    } else {
      tarjeta.textContent = resultado;
    }

    contenedor.appendChild(tarjeta);
  });
}
