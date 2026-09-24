// noticiasJuridicasPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de noticias-juridicas.html ("¿Qué pasó en el DOF la
// semana pasada?"). El contenido sale de GET /api/noticias-juridicas
// (tablas "noticias_juridicas" / "noticias_juridicas_imagenes"), que el
// administrador gestiona desde admin.html — este archivo solo pinta los
// cuadros: título, fecha, fotos y el cuerpo.
//
// Si el administrador escribe una URL dentro del cuerpo, se detecta y se
// convierte en un enlace azul y subrayado que lleva ahí mismo — a
// propósito, en vez de un botón genérico ("Ver fuente"): así quien lee
// puede ver la dirección real ANTES de tocarla, para no acostumbrar al
// Usuario a confiar en botones que lo llevan a algún lado sin decirle
// a dónde (ver crearCuerpoConEnlaces más abajo).
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';

aplicarModoGuardado();

const contenedor = document.getElementById('listaNoticias');

cargarNoticias();

async function cargarNoticias() {
  try {
    // Ruta pública: no hay 401 que manejar (se lee sin cuenta).
    const respuesta = await fetch('/api/noticias-juridicas');

    if (!respuesta.ok) {
      throw new Error(`El servidor respondió ${respuesta.status}`);
    }

    const datos = await respuesta.json();
    pintarNoticias(datos.noticias || []);
  } catch (error) {
    console.error('noticiasJuridicasPrincipal.js: no se pudieron cargar las noticias:', error);
    contenedor.innerHTML = '<p class="mensaje-error">No se pudieron cargar las noticias.</p>';
  }
}

function pintarNoticias(noticias) {
  contenedor.innerHTML = '';

  if (noticias.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'bloque ntj-vacio';
    vacio.textContent = 'Todavía no hay ninguna noticia publicada. Vuelve más tarde.';
    contenedor.appendChild(vacio);
    return;
  }

  for (const noticia of noticias) {
    contenedor.appendChild(crearTarjetaNoticia(noticia));
  }
}

function formatearFecha(fecha) {
  // "fecha" llega como 'YYYY-MM-DD'; se arma la fecha en hora local (no
  // UTC) para que no se recorra un día por la zona horaria del navegador.
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return new Date(anio, mes - 1, dia).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

function crearTarjetaNoticia(noticia) {
  const tarjeta = document.createElement('div');
  tarjeta.className = 'bloque ntj-noticia';

  const h3 = document.createElement('h3');
  h3.textContent = noticia.titulo;
  tarjeta.appendChild(h3);

  const fecha = document.createElement('span');
  fecha.className = 'ntj-fecha';
  fecha.textContent = formatearFecha(noticia.fecha);
  tarjeta.appendChild(fecha);

  if (noticia.imagenes.length > 0) {
    const galeria = document.createElement('div');
    galeria.className = 'ntj-imagenes';
    for (const imagen of noticia.imagenes) {
      const enlaceImagen = document.createElement('a');
      enlaceImagen.href = `/api/noticias-juridicas/imagen/${imagen.id}`;
      enlaceImagen.target = '_blank';
      enlaceImagen.rel = 'noopener';

      const img = document.createElement('img');
      img.src = `/api/noticias-juridicas/imagen/${imagen.id}`;
      img.alt = '';
      img.loading = 'lazy';

      enlaceImagen.appendChild(img);
      galeria.appendChild(enlaceImagen);
    }
    tarjeta.appendChild(galeria);
  }

  tarjeta.appendChild(crearCuerpoConEnlaces(noticia.cuerpo));

  return tarjeta;
}

// Detecta URLs (http:// o https://) dentro del texto y arma el párrafo
// mezclando texto normal con enlaces reales <a> — nunca innerHTML, para no
// interpretar el cuerpo como HTML. Quita de la URL cualquier puntuación de
// cierre pegada al final (paréntesis, punto, coma...) que probablemente
// sea parte de la redacción y no de la dirección.
const PATRON_URL_EN_CUERPO = /https?:\/\/[^\s<>"']+/g;

function crearCuerpoConEnlaces(texto) {
  const parrafo = document.createElement('p');
  parrafo.className = 'ntj-cuerpo';

  let ultimoIndice = 0;
  let coincidencia;
  PATRON_URL_EN_CUERPO.lastIndex = 0;

  while ((coincidencia = PATRON_URL_EN_CUERPO.exec(texto)) !== null) {
    if (coincidencia.index > ultimoIndice) {
      parrafo.appendChild(document.createTextNode(texto.slice(ultimoIndice, coincidencia.index)));
    }

    let url = coincidencia[0];
    let sobrante = '';
    while (url && /[.,;:!?)\]'"]$/.test(url)) {
      sobrante = url.slice(-1) + sobrante;
      url = url.slice(0, -1);
    }

    const enlace = document.createElement('a');
    enlace.className = 'ntj-enlace-cuerpo';
    enlace.href = url;
    enlace.target = '_blank';
    enlace.rel = 'noopener';
    enlace.textContent = url;
    parrafo.appendChild(enlace);

    if (sobrante) parrafo.appendChild(document.createTextNode(sobrante));

    ultimoIndice = PATRON_URL_EN_CUERPO.lastIndex;
  }

  if (ultimoIndice < texto.length) {
    parrafo.appendChild(document.createTextNode(texto.slice(ultimoIndice)));
  }

  return parrafo;
}
