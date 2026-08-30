// manejaNotas.js
// -------------------------------------------------------------------
// "Notas", a la derecha del área de escritura (ver editor.html /
// editorPrincipal.js). Tiene su PROPIO espacio en el layout — no es una
// ventana flotando encima de nada — y dos estados:
//   - Colapsada: solo el botón "(+) Notas", junto a la barra de
//     herramientas (ver .fila-superior-editor) — el área de escritura
//     usa entonces TODO el ancho, sin dejar espacio de más.
//   - Expandida: aparece la columna completa (.columna-notas, ancho fijo
//     --ancho-notas) con la cabecera, "(+) Crear nota" y la lista — el
//     área de escritura se achica para hacerle lugar (ver la clase
//     "notas-abierta" en .cuerpo-editor).
//
// Cada nota pertenece al cuaderno donde se creó, salvo que el abogado
// encienda el círculo de "aplicar en todos los cuadernos" — esas se
// muestran sin importar qué cuaderno esté abierto, pensado para
// recordatorios que no quiere perder de vista.
//
// Igual que los cuadernos (ver manejaCuadernos.js), todo se guarda
// CIFRADO en IndexedDB — este archivo cifra antes de guardar y descifra
// al cargar, usando la bóveda ya desbloqueada (ver manejaBovedaCifrada.js).
// -------------------------------------------------------------------
// CÓMO CAMBIAR LOS COLORES DISPONIBLES:
//   Edita el arreglo COLORES_NOTA aquí abajo.
// -------------------------------------------------------------------

import { listarNotasCifradas, guardarNotaCifrada, eliminarNotaCifrada } from './almacenamientoCifradoIndexedDB.js';
import { cifrarObjeto, descifrarObjeto } from './manejaBovedaCifrada.js';

const COLORES_NOTA = ['#FEF08A', '#DCFCE7', '#E0F2FE', '#FFEDD5', '#FCE7F3', '#F3E8FF', '#CCFBF1', '#F3F4F6'];

// Ya descifradas en memoria: { id, cuadernoId, texto, color, global, creadoEn }.
let notas = [];
let cuerpoEditorEl = null; // .cuerpo-editor: le agrega/quita "notas-abierta"
let botonColapsado = null; // el botón "(+) Notas" en .fila-superior-editor
let panelExpandido = null; // #columnaNotas: el panel completo (cabecera + lista)
let idCuadernoActual = null;

// idCuerpoEditor: el contenedor en cuadrícula del editor (ver
// .cuerpo-editor en editor.html) — le agrega/quita "notas-abierta" para
// que aparezca la 2ª columna donde vive el panel expandido. idBoton: el
// botón colapsado "(+) Notas". idPanel: el panel completo, que se pinta
// solo cuando está expandido.
export async function inicializarNotas(idCuerpoEditor, idBoton, idPanel) {
  cuerpoEditorEl = document.getElementById(idCuerpoEditor);
  botonColapsado = document.getElementById(idBoton);
  panelExpandido = document.getElementById(idPanel);
  if (!cuerpoEditorEl || !botonColapsado || !panelExpandido) {
    console.error(`manejaNotas.js: no encontré #${idCuerpoEditor}, #${idBoton} o #${idPanel} en el HTML.`);
  }

  const registros = await listarNotasCifradas();
  notas = await Promise.all(
    registros.map(async (registro) => ({ id: registro.id, ...(await descifrarObjeto(registro)) }))
  );
}

async function guardarNotaEnBoveda(nota) {
  const { iv, ciphertext } = await cifrarObjeto({
    cuadernoId: nota.cuadernoId,
    texto: nota.texto,
    color: nota.color,
    global: nota.global,
    creadoEn: nota.creadoEn
  });
  await guardarNotaCifrada({ id: nota.id, iv, ciphertext, actualizadoEn: new Date().toISOString() });
}

// Lo llama editorPrincipal.js cada vez que se abre un cuaderno distinto,
// para que la columna (si está expandida) muestre las notas de ese
// cuaderno.
export function establecerCuadernoActual(id) {
  idCuadernoActual = id;
  if (panelNotasEstaAbierto()) pintarNotas();
}

export async function eliminarNotasDeCuaderno(idCuaderno) {
  const paraBorrar = notas.filter((n) => n.cuadernoId === idCuaderno);
  notas = notas.filter((n) => n.cuadernoId !== idCuaderno);
  await Promise.all(paraBorrar.map((nota) => eliminarNotaCifrada(nota.id)));
}

// Para el respaldo completo (.arton) — ver manejaBovedaCifrada.js.
export function obtenerTodasLasNotas() {
  return notas;
}

// Importa las notas de un respaldo .arton ya descifrado. mapaIdsCuadernos
// (que regresa manejaCuadernos.js -> importarCuadernosDesdeRespaldo) liga
// el id de cuaderno que traía el respaldo con el id nuevo que le tocó
// aquí; una nota cuyo cuaderno no se pudo importar (ej. por el máximo de
// 10) simplemente no se importa tampoco — no tendría dónde vivir.
export async function importarNotasDesdeRespaldo(notasDelRespaldo, mapaIdsCuadernos) {
  let importadas = 0;
  for (const notaRespaldo of notasDelRespaldo) {
    const nuevoCuadernoId = mapaIdsCuadernos.get(notaRespaldo.cuadernoId);
    if (!nuevoCuadernoId) continue;

    const nota = {
      id: generarId(),
      cuadernoId: nuevoCuadernoId,
      texto: notaRespaldo.texto,
      color: notaRespaldo.color,
      global: !!notaRespaldo.global,
      creadoEn: notaRespaldo.creadoEn || new Date().toISOString()
    };
    await guardarNotaEnBoveda(nota);
    notas.push(nota);
    importadas++;
  }
  return importadas;
}

export function alternarPanelNotas() {
  if (panelNotasEstaAbierto()) {
    cerrarPanelNotas();
  } else {
    abrirPanelNotas();
  }
}

function abrirPanelNotas() {
  if (!botonColapsado || !panelExpandido) return;
  botonColapsado.hidden = true;
  panelExpandido.hidden = false;
  cuerpoEditorEl?.classList.add('notas-abierta');
  pintarNotas();
}

export function cerrarPanelNotas() {
  if (!botonColapsado || !panelExpandido) return;
  panelExpandido.hidden = true;
  botonColapsado.hidden = false;
  cuerpoEditorEl?.classList.remove('notas-abierta');
}

export function panelNotasEstaAbierto() {
  return !!panelExpandido && !panelExpandido.hidden;
}

function notasVisibles() {
  return notas
    .filter((n) => n.cuadernoId === idCuadernoActual || n.global)
    .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn));
}

function pintarNotas() {
  panelExpandido.innerHTML = '';

  const cabecera = document.createElement('div');
  cabecera.classList.add('cabecera-panel-notas');

  const titulo = document.createElement('h3');
  titulo.textContent = 'Notas';
  cabecera.appendChild(titulo);

  const botonCrear = document.createElement('button');
  botonCrear.type = 'button';
  botonCrear.classList.add('boton-crear-nota');
  botonCrear.textContent = '(+) Crear nota';
  botonCrear.addEventListener('click', () => pintarFormularioNota());
  cabecera.appendChild(botonCrear);

  panelExpandido.appendChild(cabecera);

  const contenedorLista = document.createElement('div');
  contenedorLista.classList.add('lista-notas');
  contenedorLista.id = 'listaNotasInterna';
  panelExpandido.appendChild(contenedorLista);

  const visibles = notasVisibles();
  if (visibles.length === 0) {
    const vacio = document.createElement('p');
    vacio.classList.add('aviso-sin-notas');
    vacio.textContent = 'Todavía no hay notas en este cuaderno.';
    contenedorLista.appendChild(vacio);
  } else {
    visibles.forEach((nota) => contenedorLista.appendChild(crearTarjetaNota(nota)));
  }
}

function pintarFormularioNota(notaExistente = null) {
  const contenedorLista = panelExpandido.querySelector('#listaNotasInterna');
  contenedorLista.querySelector('.aviso-sin-notas')?.remove();

  const formulario = document.createElement('div');
  formulario.classList.add('formulario-nota');

  const textarea = document.createElement('textarea');
  textarea.rows = 4;
  textarea.value = notaExistente?.texto || '';
  textarea.placeholder = 'Escribe la nota o comentario...';
  formulario.appendChild(textarea);

  const filaColores = document.createElement('div');
  filaColores.classList.add('fila-colores-nota');
  let colorElegido = notaExistente?.color || COLORES_NOTA[0];

  COLORES_NOTA.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.classList.add('swatch-color-nota');
    swatch.style.background = color;
    swatch.classList.toggle('elegido', color === colorElegido);
    swatch.title = color;
    swatch.addEventListener('click', () => {
      colorElegido = color;
      filaColores.querySelectorAll('.swatch-color-nota').forEach((s) => s.classList.remove('elegido'));
      swatch.classList.add('elegido');
    });
    filaColores.appendChild(swatch);
  });
  formulario.appendChild(filaColores);

  const filaBotones = document.createElement('div');
  filaBotones.classList.add('fila-botones-formulario-nota');

  const botonGuardar = document.createElement('button');
  botonGuardar.type = 'button';
  botonGuardar.classList.add('boton-checkbox', 'boton-general');
  botonGuardar.textContent = 'Guardar';
  botonGuardar.addEventListener('click', async () => {
    const texto = textarea.value.trim();
    if (!texto) {
      textarea.focus();
      return;
    }
    botonGuardar.disabled = true;
    try {
      if (notaExistente) {
        notaExistente.texto = texto;
        notaExistente.color = colorElegido;
        await guardarNotaEnBoveda(notaExistente);
      } else {
        const nuevaNota = {
          id: generarId(),
          cuadernoId: idCuadernoActual,
          texto,
          color: colorElegido,
          global: false,
          creadoEn: new Date().toISOString()
        };
        await guardarNotaEnBoveda(nuevaNota);
        notas.push(nuevaNota);
      }
      pintarNotas();
    } catch (error) {
      console.error('manejaNotas.js: no se pudo guardar la nota:', error);
      window.alert('No se pudo guardar la nota. Intenta de nuevo.');
      botonGuardar.disabled = false;
    }
  });
  filaBotones.appendChild(botonGuardar);

  const botonCancelar = document.createElement('button');
  botonCancelar.type = 'button';
  botonCancelar.classList.add('boton-checkbox');
  botonCancelar.textContent = 'Cancelar';
  botonCancelar.addEventListener('click', () => pintarNotas());
  filaBotones.appendChild(botonCancelar);

  formulario.appendChild(filaBotones);
  contenedorLista.prepend(formulario);
  textarea.focus();
}

function crearTarjetaNota(nota) {
  const tarjeta = document.createElement('div');
  tarjeta.classList.add('tarjeta-nota');
  tarjeta.style.background = nota.color;

  const texto = document.createElement('p');
  texto.classList.add('texto-nota');
  texto.textContent = nota.texto;
  tarjeta.appendChild(texto);

  const filaAcciones = document.createElement('div');
  filaAcciones.classList.add('fila-acciones-nota');

  const botonGlobal = document.createElement('button');
  botonGlobal.type = 'button';
  botonGlobal.classList.add('boton-circulo-global');
  botonGlobal.classList.toggle('activo', !!nota.global);
  botonGlobal.title = nota.global
    ? 'Se muestra en todos los cuadernos (click para dejar de mostrarla en todos)'
    : 'Mostrar esta nota en todos los cuadernos';
  botonGlobal.addEventListener('click', async () => {
    nota.global = !nota.global;
    botonGlobal.disabled = true;
    try {
      await guardarNotaEnBoveda(nota);
      pintarNotas();
    } catch (error) {
      console.error('manejaNotas.js: no se pudo actualizar la nota:', error);
      nota.global = !nota.global; // revierte si no se pudo guardar
      botonGlobal.disabled = false;
    }
  });
  filaAcciones.appendChild(botonGlobal);

  const botonEditar = document.createElement('button');
  botonEditar.type = 'button';
  botonEditar.classList.add('boton-icono-nota');
  botonEditar.title = 'Editar nota';
  botonEditar.textContent = '✎';
  botonEditar.addEventListener('click', () => pintarFormularioNota(nota));
  filaAcciones.appendChild(botonEditar);

  const botonBorrar = document.createElement('button');
  botonBorrar.type = 'button';
  botonBorrar.classList.add('boton-icono-nota');
  botonBorrar.title = 'Borrar nota';
  botonBorrar.textContent = '🗑';
  botonBorrar.addEventListener('click', async () => {
    if (!window.confirm('¿Seguro que quieres borrar esta nota? Esto no se puede deshacer.')) return;
    notas = notas.filter((n) => n.id !== nota.id);
    await eliminarNotaCifrada(nota.id);
    pintarNotas();
  });
  filaAcciones.appendChild(botonBorrar);

  tarjeta.appendChild(filaAcciones);
  return tarjeta;
}

function generarId() {
  if (window.crypto?.randomUUID) return `n_${window.crypto.randomUUID()}`;
  return `n_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
