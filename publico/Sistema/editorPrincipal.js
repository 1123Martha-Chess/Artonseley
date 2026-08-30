// editorPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de editor.html ("Mis cuadernos" — la nueva interfaz
// de edición de texto, accesible desde Configuración ⚙️ → debajo de
// Personalización). Junta todas las piezas:
//
//   - La misma barra superior, panel de Configuración/Personalización y
//     notificaciones que index.html (son los mismos módulos).
//   - El mismo sistemaDeBotones.js de siempre, pero ahora dentro de un
//     desplegable que abre el botón "Documentos seleccionados", en vez
//     de vivir fijo en un sidebar.
//   - Un buscador embebido (mismo /api/buscar y mismas tarjetas que el
//     buscador principal) para consultar leyes sin salir de esta página.
//   - La bóveda cifrada (ver manejaBovedaCifrada.js): antes de mostrar
//     nada, hay que resolver incógnito/configurar la frase/desbloquear.
//   - La vista de "Cuadernos" (lista) y la vista de "Editor" (escribir),
//     con notas y exportar/importar (ver manejaCuadernos.js,
//     manejaNotas.js, manejaHerramientasEdicion.js, formatoTextoPlano.js).
//
// Cualquier click fuera de "Documentos seleccionados" o de "Notas"
// cierra esas dos ventanas (lo maneja este archivo, más abajo).
// -------------------------------------------------------------------

import { inicializarSistemaDeBotones, obtenerDocumentosSeleccionados } from './sistemaDeBotones.js';
import { inicializarSugerencias } from './manejaSugerencias.js';
import { inicializarConfiguracion } from './manejaConfiguracion.js';
import { inicializarBuzonSugerencias } from './manejaBuzonSugerencias.js';
import { inicializarPersonalizacion } from './manejaPersonalizacion.js';
import { pintarResultados } from './pintarResultadosBusqueda.js';
import { inicializarBoveda, exportarRespaldoArton, importarRespaldoArton, olvidarEnEsteDispositivo } from './manejaBovedaCifrada.js';
import {
  inicializarCuadernos,
  listarCuadernos,
  obtenerCuaderno,
  crearCuaderno,
  renombrarCuaderno,
  guardarContenidoCuaderno,
  eliminarCuaderno,
  establecerCuadernoAbierto,
  obtenerCuadernoAbierto,
  exportarCuaderno,
  importarCuadernoDesdeArchivo,
  puedeCrearCuaderno,
  obtenerTodosLosCuadernos,
  importarCuadernosDesdeRespaldo,
  MAXIMO_CUADERNOS
} from './manejaCuadernos.js';
import {
  inicializarNotas,
  establecerCuadernoActual,
  alternarPanelNotas,
  cerrarPanelNotas,
  panelNotasEstaAbierto,
  obtenerTodasLasNotas,
  importarNotasDesdeRespaldo
} from './manejaNotas.js';
import { inicializarHerramientasEdicion } from './manejaHerramientasEdicion.js';

console.log('editorPrincipal.js se cargó correctamente.');

// ---- Mismo truco que buscadorPrincipal.js para que los paneles nunca
// tapen la barra superior ni el pie de aviso legal, sin importar cuánto
// midan (ver los comentarios largos en index.html sobre esto). ----
const barraSuperior = document.querySelector('.barra-superior');
if (barraSuperior) {
  const actualizarAlturaBarraSuperior = () =>
    document.documentElement.style.setProperty('--altura-barra-superior', `${barraSuperior.offsetHeight}px`);
  actualizarAlturaBarraSuperior();
  new ResizeObserver(actualizarAlturaBarraSuperior).observe(barraSuperior);
}

const pieAvisoLegal = document.querySelector('.pie-aviso-legal');
if (pieAvisoLegal) {
  const actualizarAlturaPieLegal = () =>
    document.documentElement.style.setProperty('--altura-pie-legal', `${pieAvisoLegal.offsetHeight}px`);
  actualizarAlturaPieLegal();
  new ResizeObserver(actualizarAlturaPieLegal).observe(pieAvisoLegal);
}

inicializarSugerencias('botonSugerencias', 'panelSugerencias');
inicializarBuzonSugerencias();
inicializarPersonalizacion();
inicializarConfiguracion('botonConfiguracion', 'menuConfiguracion');
inicializarSistemaDeBotones('contenedorSectoresEditor');
inicializarHerramientasEdicion('areaEscritura', 'barraHerramientasEdicion');

// "+Notas" ahora es un botón fijo en editor.html (la mitad colapsada de
// la columna de Notas, ver manejaNotas.js) en vez de vivir dentro de la
// barra de herramientas.
document.getElementById('botonAbrirNotas').addEventListener('click', () => alternarPanelNotas());

iniciar();

async function iniciar() {
  let correo;
  try {
    correo = await obtenerCorreoUsuario();
  } catch (error) {
    console.error('editorPrincipal.js: no se pudo confirmar la sesión:', error);
    return;
  }

  // Nada de esto (cuadernos, notas, banner) se muestra hasta que la
  // bóveda quede desbloqueada — ver manejaBovedaCifrada.js, que se
  // encarga de la pantalla de incógnito/configuración/desbloqueo y
  // llama a esta función cuando ya se puede seguir.
  await inicializarBoveda(
    correo,
    'pantallaBoveda',
    {
      cargando: 'vistaBovedaCargando',
      incognito: 'vistaBovedaIncognito',
      configuracion: 'vistaBovedaConfiguracion',
      verificacion: 'vistaBovedaVerificacion',
      desbloqueo: 'vistaBovedaDesbloqueo'
    },
    alDesbloquearBoveda
  );
}

async function alDesbloquearBoveda() {
  await inicializarNotas('cuerpoEditor', 'botonAbrirNotas', 'columnaNotas');
  await inicializarCuadernos();
  await pintarListaCuadernos();
  document.getElementById('bannerAdvertenciaCache').hidden = false;
}

async function obtenerCorreoUsuario() {
  const respuesta = await fetch('/api/sesion');
  if (!respuesta.ok) {
    if (respuesta.status === 401) window.location.href = 'login.html';
    throw new Error('Sesión no válida.');
  }
  const sesion = await respuesta.json();
  return sesion.email;
}

// ========================= Documentos seleccionados =========================

const botonDocSeleccionados = document.getElementById('botonDocSeleccionados');
const panelDocSeleccionados = document.getElementById('panelDocSeleccionados');

botonDocSeleccionados.addEventListener('click', (evento) => {
  evento.stopPropagation();
  panelDocSeleccionados.classList.toggle('panel-abierto');
});

// OJO: esto escucha "mousedown", no "click". Crear/editar/borrar/activar
// una nota vuelve a pintar TODO el panel (panel.innerHTML = ...) dentro
// de su propio manejador de "click" — para cuando ese click termina de
// subir (burbujear) hasta document, el botón que se apretó ya no está en
// el árbol del documento (fue reemplazado), así que
// "panelNotas.contains(evento.target)" da falso y esto cerraría el panel
// justo después de cada acción. Con "mousedown" esta comprobación corre
// ANTES de que el click dispare el repintado, así que todavía ve el DOM
// de verdad.
document.addEventListener('mousedown', (evento) => {
  if (
    panelDocSeleccionados.classList.contains('panel-abierto') &&
    !panelDocSeleccionados.contains(evento.target) &&
    evento.target !== botonDocSeleccionados
  ) {
    panelDocSeleccionados.classList.remove('panel-abierto');
  }

  // La columna de Notas ya no es una ventana flotando encima de todo —
  // tiene su propio espacio en el layout (ver editor.html) — así que
  // "cerrarla" ahora vuelve a mostrar el botón colapsado "(+) Notas" en
  // su lugar, y el área de escritura recupera todo el ancho.
  const columnaNotas = document.getElementById('columnaNotas');
  if (panelNotasEstaAbierto() && !columnaNotas.contains(evento.target)) {
    cerrarPanelNotas();
  }
});

// ========================= Buscador embebido (sidebar) =========================
// Su propio espacio, siempre visible a la izquierda — ya no es una
// sección que aparece/desaparece según haya o no resultados.

const campoPalabra = document.getElementById('campoPalabraEditor');
const botonBuscar = document.getElementById('botonBuscarEditor');
const contenedorResultados = document.getElementById('resultadosEditor');

botonBuscar.addEventListener('click', () => buscarEnEditor(campoPalabra.value));
campoPalabra.addEventListener('keydown', (evento) => {
  if (evento.key === 'Enter') buscarEnEditor(campoPalabra.value);
});

async function buscarEnEditor(palabraEscrita) {
  contenedorResultados.innerHTML = '<p class="mensaje-carga">Buscando…</p>';
  botonBuscar.disabled = true;

  try {
    const respuesta = await fetch('/api/buscar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: palabraEscrita, documentos: obtenerDocumentosSeleccionados() })
    });

    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    if (!respuesta.ok) {
      const datosError = await respuesta.json().catch(() => ({}));
      mostrarMensajeBusqueda(datosError.error || 'Ocurrió un error al buscar. Intenta de nuevo.', 'mensaje-error');
      return;
    }

    const datos = await respuesta.json();
    if (datos.tipo === 'mensaje') {
      mostrarMensajeBusqueda(datos.mensaje);
    } else {
      pintarResultados(contenedorResultados, datos.resultados, datos.avisos);
    }
  } catch (error) {
    console.error('editorPrincipal.js: error al buscar:', error);
    mostrarMensajeBusqueda('No se pudo conectar con el servidor. Intenta de nuevo.', 'mensaje-error');
  } finally {
    botonBuscar.disabled = false;
  }
}

function mostrarMensajeBusqueda(texto, claseExtra = '') {
  contenedorResultados.innerHTML = '';
  const parrafo = document.createElement('p');
  if (claseExtra) parrafo.classList.add(claseExtra);
  parrafo.textContent = texto;
  contenedorResultados.appendChild(parrafo);
}

// ========================= Vista de Cuadernos =========================

const vistaCuadernos = document.getElementById('vistaCuadernos');
const vistaEditor = document.getElementById('vistaEditor');
const listaCuadernosEl = document.getElementById('listaCuadernos');
const botonCrearCuaderno = document.getElementById('botonCrearCuaderno');
const botonImportarCuaderno = document.getElementById('botonImportarCuaderno');
const inputImportarCuaderno = document.getElementById('inputImportarCuaderno');
const botonExportarTodo = document.getElementById('botonExportarTodo');
const botonImportarTodo = document.getElementById('botonImportarTodo');
const inputImportarTodo = document.getElementById('inputImportarTodo');
const botonOlvidarDispositivo = document.getElementById('botonOlvidarDispositivo');

botonCrearCuaderno.addEventListener('click', async () => {
  try {
    const cuaderno = await crearCuaderno(`Cuaderno ${listarCuadernos().length + 1}`);
    await pintarListaCuadernos();
    abrirCuaderno(cuaderno.id);
  } catch (error) {
    window.alert(error.message);
  }
});

botonImportarCuaderno.addEventListener('click', () => inputImportarCuaderno.click());

inputImportarCuaderno.addEventListener('change', async () => {
  const archivo = inputImportarCuaderno.files[0];
  inputImportarCuaderno.value = '';
  if (!archivo) return;

  try {
    const cuaderno = await importarCuadernoDesdeArchivo(archivo);
    await pintarListaCuadernos();
    abrirCuaderno(cuaderno.id);
  } catch (error) {
    window.alert(error.message);
  }
});

// Respaldo completo cifrado (.arton) — distinto del "Exportar (.txt)"
// de un solo cuaderno: junta TODOS los cuadernos y notas en un archivo
// cifrado con la frase de recuperación (ver manejaBovedaCifrada.js).
botonExportarTodo.addEventListener('click', async () => {
  try {
    await exportarRespaldoArton({ cuadernos: obtenerTodosLosCuadernos(), notas: obtenerTodasLasNotas() });
  } catch (error) {
    console.error('editorPrincipal.js: error al exportar el respaldo:', error);
    window.alert('No se pudo exportar el respaldo.');
  }
});

// "Recordar en este dispositivo" es el comportamiento normal (ver
// manejaBovedaCifrada.js) — este botón es la salida, para computadoras
// compartidas/públicas donde no se quiere dejar la frase guardada.
botonOlvidarDispositivo.addEventListener('click', () => {
  if (
    !window.confirm(
      '¿Olvidar la frase de recuperación guardada en esta computadora? La próxima vez que entres a "Mis cuadernos" aquí, vas a tener que escribir tus 12 palabras completas de nuevo.'
    )
  ) {
    return;
  }
  olvidarEnEsteDispositivo();
});

botonImportarTodo.addEventListener('click', () => inputImportarTodo.click());

inputImportarTodo.addEventListener('change', async () => {
  const archivo = inputImportarTodo.files[0];
  inputImportarTodo.value = '';
  if (!archivo) return;

  const frase = window.prompt(
    'Escribe las 12 palabras de recuperación con las que se creó ese respaldo, separadas por espacios:'
  );
  if (!frase) return;

  try {
    const textoArchivo = await archivo.text();
    const { cuadernos: cuadernosRespaldo = [], notas: notasRespaldo = [] } = await importarRespaldoArton(
      textoArchivo,
      frase.trim().toLowerCase().split(/\s+/).filter(Boolean)
    );

    const mapaIds = await importarCuadernosDesdeRespaldo(cuadernosRespaldo);
    const notasImportadas = await importarNotasDesdeRespaldo(notasRespaldo, mapaIds);
    await pintarListaCuadernos();

    const seOmitieronCuadernos = mapaIds.size < cuadernosRespaldo.length;
    window.alert(
      `Se importaron ${mapaIds.size} cuaderno(s) y ${notasImportadas} nota(s).` +
        (seOmitieronCuadernos ? ` Algunos cuadernos no se importaron por el máximo de ${MAXIMO_CUADERNOS}.` : '')
    );
  } catch (error) {
    console.error('editorPrincipal.js: error al importar el respaldo:', error);
    window.alert(error.message || 'No se pudo importar ese respaldo.');
  }
});

async function pintarListaCuadernos() {
  listaCuadernosEl.innerHTML = '';
  const cuadernos = listarCuadernos();

  const alcanzoElMaximo = !(await puedeCrearCuaderno());
  botonCrearCuaderno.disabled = alcanzoElMaximo;
  botonImportarCuaderno.disabled = alcanzoElMaximo;
  botonImportarTodo.disabled = alcanzoElMaximo;

  if (cuadernos.length === 0) {
    const vacio = document.createElement('p');
    vacio.classList.add('aviso-sin-cuadernos');
    vacio.textContent = 'Todavía no tienes cuadernos. Crea uno para empezar a escribir.';
    listaCuadernosEl.appendChild(vacio);
    return;
  }

  cuadernos.forEach((cuaderno) => listaCuadernosEl.appendChild(crearTarjetaCuaderno(cuaderno)));
}

function crearTarjetaCuaderno(cuaderno) {
  const tarjeta = document.createElement('div');
  tarjeta.classList.add('tarjeta-cuaderno');
  tarjeta.tabIndex = 0;

  const nombre = document.createElement('div');
  nombre.classList.add('nombre-cuaderno-editable');
  nombre.textContent = cuaderno.nombre;
  tarjeta.appendChild(nombre);

  const botonBorrar = document.createElement('button');
  botonBorrar.type = 'button';
  botonBorrar.classList.add('boton-borrar-cuaderno');
  botonBorrar.title = 'Borrar cuaderno';
  botonBorrar.textContent = '🗑';
  botonBorrar.addEventListener('click', async (evento) => {
    evento.stopPropagation();
    if (!window.confirm(`¿Seguro que quieres borrar "${cuaderno.nombre}"? Esto no se puede deshacer.`)) return;
    await eliminarCuaderno(cuaderno.id);
    await pintarListaCuadernos();
  });
  tarjeta.appendChild(botonBorrar);

  // Doble click en el nombre: lo hace editable ahí mismo (ver
  // .nombre-cuaderno-editable en editor.html — crece con el texto y, si
  // llega al borde derecho, pasa a una segunda línea, sin JS extra).
  nombre.addEventListener('dblclick', (evento) => {
    evento.stopPropagation();
    nombre.contentEditable = 'true';
    nombre.focus();
    document.execCommand('selectAll', false, null);
  });

  async function confirmarRenombrado() {
    nombre.contentEditable = 'false';
    await renombrarCuaderno(cuaderno.id, nombre.textContent);
    nombre.textContent = obtenerCuaderno(cuaderno.id).nombre;
  }

  nombre.addEventListener('blur', confirmarRenombrado);
  nombre.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter') {
      evento.preventDefault();
      nombre.blur();
    }
  });
  // Un doble click dispara, ANTES del propio "dblclick", dos eventos
  // "click" normales — sin esto, esos dos clicks burbujean hasta la
  // tarjeta y abren el cuaderno antes de que dé tiempo a activar el
  // modo de renombrar. Por eso se corta la propagación en todo click
  // sobre el nombre (el doble click para renombrar es la única acción
  // que vive ahí; abrir el cuaderno es con un click en cualquier otra
  // parte de la tarjeta).
  nombre.addEventListener('click', (evento) => evento.stopPropagation());

  // Un solo click en cualquier otra parte de la tarjeta -> abre el
  // cuaderno para editarlo.
  tarjeta.addEventListener('click', () => {
    if (!nombre.isContentEditable) abrirCuaderno(cuaderno.id);
  });

  return tarjeta;
}

// ========================= Vista de Editor =========================

const areaEscritura = document.getElementById('areaEscritura');
const nombreCuadernoActual = document.getElementById('nombreCuadernoActual');
let temporizadorGuardado = null;

function abrirCuaderno(id) {
  const cuaderno = obtenerCuaderno(id);
  if (!cuaderno) return;

  establecerCuadernoAbierto(id);
  establecerCuadernoActual(id);
  nombreCuadernoActual.textContent = cuaderno.nombre;
  areaEscritura.innerHTML = cuaderno.contenidoHtml || '';

  vistaCuadernos.hidden = true;
  vistaEditor.hidden = false;
}

areaEscritura.addEventListener('input', () => {
  clearTimeout(temporizadorGuardado);
  temporizadorGuardado = setTimeout(guardarCuadernoAbierto, 500);
});

async function guardarCuadernoAbierto() {
  const abierto = obtenerCuadernoAbierto();
  if (!abierto) return;
  await guardarContenidoCuaderno(abierto.id, areaEscritura.innerHTML);
}

// Por si se cierra/recarga la pestaña justo después de escribir, antes
// de que corriera el temporizador de arriba. Los navegadores no
// esperan a que termine un "async" en beforeunload — es un intento de
// mejor esfuerzo, no una garantía (por eso también hay guardado cada
// 500ms mientras se escribe, y exportar/respaldar seguido).
window.addEventListener('beforeunload', () => {
  guardarCuadernoAbierto();
});

document.getElementById('botonVolverCuadernos').addEventListener('click', async () => {
  await guardarCuadernoAbierto();
  cerrarPanelNotas();
  establecerCuadernoAbierto(null);
  vistaEditor.hidden = true;
  vistaCuadernos.hidden = false;
  await pintarListaCuadernos();
});

document.getElementById('botonExportarCuaderno').addEventListener('click', async () => {
  await guardarCuadernoAbierto();
  const abierto = obtenerCuadernoAbierto();
  if (abierto) exportarCuaderno(abierto.id);
});

console.log('Cuadernos máximos por usuario:', MAXIMO_CUADERNOS);
