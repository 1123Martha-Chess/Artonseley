// informacionOficialPrincipal.js
// -------------------------------------------------------------------
// Entry point de informacion-oficial.html. Pide GET /api/informacion-oficial
// (ruta pública, sin sesión — ver servidor.js) y pinta el texto de
// presentación más las dos listas fijas de enlaces que mantiene el
// administrador desde admin.html: cuentas oficiales y fuentes oficiales
// (DOF). No hay lógica aquí más allá de mostrar lo que el servidor manda.
// -------------------------------------------------------------------

function crearSeccionDeEnlaces(titulo, enlaces) {
  const seccion = document.createElement('div');
  seccion.className = 'seccion-legal';

  const encabezado = document.createElement('h2');
  encabezado.textContent = titulo;
  seccion.appendChild(encabezado);

  if (enlaces.length === 0) {
    const vacio = document.createElement('p');
    vacio.textContent = 'Todavía no hay nada publicado en esta sección.';
    seccion.appendChild(vacio);
    return seccion;
  }

  const lista = document.createElement('ul');
  lista.className = 'lista-enlaces-oficiales';
  enlaces.forEach(({ etiqueta, url }) => {
    const item = document.createElement('li');
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.textContent = etiqueta;
    if (url.startsWith('http')) {
      enlace.target = '_blank';
      enlace.rel = 'noopener';
    }
    item.appendChild(enlace);
    lista.appendChild(item);
  });
  seccion.appendChild(lista);
  return seccion;
}

async function cargarInformacionOficial() {
  const contenedor = document.getElementById('contenidoInformacion');
  try {
    const respuesta = await fetch('/api/informacion-oficial');
    if (!respuesta.ok) throw new Error('No se pudo cargar la información.');
    const { descripcion, cuentasOficiales, fuentesOficiales } = await respuesta.json();

    contenedor.innerHTML = '';

    if (descripcion && descripcion.trim()) {
      descripcion.split('\n').filter((parrafo) => parrafo.trim()).forEach((parrafo) => {
        const p = document.createElement('p');
        p.textContent = parrafo;
        contenedor.appendChild(p);
      });
    }

    contenedor.appendChild(crearSeccionDeEnlaces('Cuentas oficiales', cuentasOficiales));
    contenedor.appendChild(crearSeccionDeEnlaces('Fuentes oficiales (DOF)', fuentesOficiales));
  } catch (error) {
    contenedor.innerHTML = `<p class="mensaje-error">${error.message}</p>`;
  }
}

cargarInformacionOficial();
