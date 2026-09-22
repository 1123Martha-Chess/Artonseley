// noticiasJuridicasPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de noticias-juridicas.html ("¿Qué pasó en el DOF la
// semana pasada?"). El contenido sale de GET /api/noticias-juridicas
// (tablas "noticias_juridicas" / "noticias_juridicas_imagenes"), que el
// administrador gestiona desde admin.html — este archivo solo pinta los
// cuadros: título, fecha, fotos, cuerpo y, si tiene, un enlace que abre
// la página web en una pestaña nueva.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';

aplicarModoGuardado();

const contenedor = document.getElementById('listaNoticias');

cargarNoticias();

async function cargarNoticias() {
  try {
    const respuesta = await fetch('/api/noticias-juridicas');

    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
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

  const cuerpo = document.createElement('p');
  cuerpo.className = 'ntj-cuerpo';
  cuerpo.textContent = noticia.cuerpo;
  tarjeta.appendChild(cuerpo);

  if (noticia.enlace) {
    const boton = document.createElement('a');
    boton.className = 'boton-plataforma';
    boton.href = noticia.enlace;
    boton.target = '_blank';
    boton.rel = 'noopener';
    boton.textContent = 'Ver fuente';
    tarjeta.appendChild(boton);
  }

  return tarjeta;
}
