// plantillasPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de plantillas.html. Solo interfaz:
//   - pide la lista de plantillas (GET /api/plantillas) y la pinta en la
//     barra lateral, agrupada por categoría y colapsable;
//   - al elegir una, pide su cuerpo + variables (GET /api/plantillas/:id)
//     y arma un formulario con un campo por marcador;
//   - "Generar" fusiona en el navegador (Sistema/fusionPlantilla.js) y
//     muestra la vista previa; de ahí se exporta a Word (.doc) o PDF.
// Nada de lógica de negocio del servidor vive aquí.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';
import { fusionar, tieneFaltantes, descargarComoWord, imprimir } from './fusionPlantilla.js';

aplicarModoGuardado();

const listaCategorias = document.getElementById('listaCategorias');
const areaPlantilla = document.getElementById('areaPlantilla');

let plantillaActual = null; // { id, titulo, cuerpo, version, variables }

iniciar();

async function iniciar() {
  try {
    const respuesta = await fetch('/api/sesion');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
  } catch (error) {
    console.error('plantillasPrincipal.js: no se pudo confirmar la sesión:', error);
  }
  await cargarLista();
}

async function cargarLista() {
  let plantillas;
  try {
    const respuesta = await fetch('/api/plantillas');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (respuesta.status === 403) {
      const datos = await respuesta.json().catch(() => ({}));
      listaCategorias.innerHTML = `<p class="mensaje-error">${escapar(datos.error || 'No tienes acceso a las plantillas.')}</p>`;
      return;
    }
    if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);
    plantillas = (await respuesta.json()).plantillas || [];
  } catch (error) {
    console.error('plantillasPrincipal.js: no se pudieron cargar las plantillas:', error);
    listaCategorias.innerHTML = '<p class="mensaje-error">No se pudo cargar la lista de plantillas.</p>';
    return;
  }

  if (plantillas.length === 0) {
    listaCategorias.innerHTML = '<p class="plt-vacio">Todavía no hay plantillas. El administrador puede agregarlas desde el panel.</p>';
    return;
  }

  const porCategoria = new Map();
  for (const plantilla of plantillas) {
    if (!porCategoria.has(plantilla.categoria)) porCategoria.set(plantilla.categoria, []);
    porCategoria.get(plantilla.categoria).push(plantilla);
  }
  const categoriasOrdenadas = [...porCategoria.keys()].sort((a, b) => a.localeCompare(b, 'es'));

  listaCategorias.innerHTML = '';
  for (const categoria of categoriasOrdenadas) {
    listaCategorias.appendChild(crearBloqueCategoria(categoria, porCategoria.get(categoria)));
  }
}

function crearBloqueCategoria(categoria, plantillas) {
  const bloque = document.createElement('div');
  bloque.className = 'plt-categoria';

  const titulo = document.createElement('div');
  titulo.className = 'plt-categoria-titulo';
  titulo.innerHTML = `<span class="plt-flecha">▶</span> ${escapar(categoria)}`;

  const lista = document.createElement('div');
  lista.className = 'plt-categoria-lista';

  titulo.addEventListener('click', () => {
    titulo.classList.toggle('abierta');
    lista.classList.toggle('abierta');
  });

  for (const plantilla of plantillas) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'plt-boton-plantilla';
    boton.textContent = plantilla.titulo;
    boton.dataset.id = String(plantilla.id);
    boton.addEventListener('click', () => seleccionarPlantilla(plantilla.id, boton));
    lista.appendChild(boton);
  }

  bloque.append(titulo, lista);
  return bloque;
}

async function seleccionarPlantilla(id, boton) {
  for (const b of listaCategorias.querySelectorAll('.plt-boton-plantilla')) {
    b.classList.toggle('activa', b === boton);
  }

  areaPlantilla.innerHTML = '<p class="mensaje-carga">Cargando plantilla…</p>';
  try {
    const respuesta = await fetch(`/api/plantillas/${id}`);
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);
    plantillaActual = await respuesta.json();
  } catch (error) {
    console.error('plantillasPrincipal.js: no se pudo cargar la plantilla:', error);
    areaPlantilla.innerHTML = '<p class="mensaje-error">No se pudo cargar la plantilla.</p>';
    return;
  }

  pintarFormulario();
}

function pintarFormulario() {
  const { titulo, version, variables } = plantillaActual;
  areaPlantilla.innerHTML = '';

  const h2 = document.createElement('h2');
  h2.className = 'plt-titulo-plantilla';
  h2.textContent = titulo;
  areaPlantilla.appendChild(h2);

  const pVersion = document.createElement('p');
  pVersion.className = 'plt-version';
  pVersion.textContent = `Versión ${version}`;
  areaPlantilla.appendChild(pVersion);

  const form = document.createElement('form');
  form.id = 'formPlantilla';

  if (variables.length === 0) {
    const p = document.createElement('p');
    p.className = 'plt-vacio';
    p.textContent = 'Esta plantilla no tiene marcadores para llenar.';
    form.appendChild(p);
  }

  for (const variable of variables) {
    const campo = document.createElement('div');
    campo.className = 'plt-campo';

    const label = document.createElement('label');
    label.textContent = variable.etiqueta;
    label.setAttribute('for', `v_${variable.clave}`);

    const input = document.createElement('input');
    input.type = 'text';
    input.id = `v_${variable.clave}`;
    input.dataset.clave = variable.clave;
    input.autocomplete = 'off';

    campo.append(label, input);
    form.appendChild(campo);
  }

  const acciones = document.createElement('div');
  acciones.className = 'plt-acciones';

  const botonGenerar = document.createElement('button');
  botonGenerar.type = 'submit';
  botonGenerar.className = 'plt-btn-primario';
  botonGenerar.textContent = 'Generar documento';
  acciones.appendChild(botonGenerar);

  form.appendChild(acciones);
  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    generar();
  });
  areaPlantilla.appendChild(form);

  const contenedorPrevia = document.createElement('div');
  contenedorPrevia.id = 'contenedorPrevia';
  areaPlantilla.appendChild(contenedorPrevia);
}

function recogerValores() {
  const valores = {};
  for (const input of document.querySelectorAll('#formPlantilla input[data-clave]')) {
    valores[input.dataset.clave] = input.value;
  }
  return valores;
}

function generar() {
  const texto = fusionar(plantillaActual.cuerpo, recogerValores());
  const contenedor = document.getElementById('contenedorPrevia');
  contenedor.innerHTML = '';

  const previa = document.createElement('div');
  previa.className = 'plt-previa';
  // Resalta los [falta: x] sin usar innerHTML con el texto del usuario.
  const partes = texto.split(/(\[falta:\s[\w.]+\])/g);
  for (const parte of partes) {
    if (/^\[falta:\s[\w.]+\]$/.test(parte)) {
      const span = document.createElement('span');
      span.className = 'falta';
      span.textContent = parte;
      previa.appendChild(span);
    } else {
      previa.appendChild(document.createTextNode(parte));
    }
  }
  contenedor.appendChild(previa);

  if (tieneFaltantes(texto)) {
    const aviso = document.createElement('p');
    aviso.className = 'plt-aviso-faltantes';
    aviso.textContent = 'Quedaron marcadores sin llenar (resaltados en rojo). Puedes exportar de todos modos y completarlos a mano.';
    contenedor.appendChild(aviso);
  }

  const acciones = document.createElement('div');
  acciones.className = 'plt-acciones';

  const botonWord = document.createElement('button');
  botonWord.type = 'button';
  botonWord.className = 'plt-btn-secundario';
  botonWord.textContent = 'Descargar como Word (.doc)';
  botonWord.addEventListener('click', () => descargarComoWord(plantillaActual.titulo, texto));

  const botonPdf = document.createElement('button');
  botonPdf.type = 'button';
  botonPdf.className = 'plt-btn-secundario';
  botonPdf.textContent = 'Imprimir / Guardar como PDF';
  botonPdf.addEventListener('click', () => imprimir(plantillaActual.titulo, texto));

  acciones.append(botonWord, botonPdf);
  contenedor.appendChild(acciones);
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto ?? '');
  return div.innerHTML;
}
