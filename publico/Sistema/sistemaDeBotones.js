// sistemaDeBotones.js
// -------------------------------------------------------------------
// Reemplaza a "seleccionadorDeDocumentos.js". En vez de una lista plana
// de botones (uno por documento), pinta sectores en la barra izquierda.
// Cada sector agrupa uno o varios "documento" (los mismos nombres que
// usa LectorDeJSON.js, ej. "Código Penal", "Ley de Amparo"...).
//
// Hay 3 niveles de selección:
//   1) Un botón "Seleccionar todo" arriba de todo -> selecciona TODOS
//      los documentos de TODOS los sectores.
//   2) Un botón "Seleccionar todo" dentro de cada sector -> selecciona
//      solo los documentos de ESE sector.
//   3) Un botón por cada documento individual dentro de su sector.
//
// -------------------------------------------------------------------
// CÓMO AGREGAR / QUITAR UN SECTOR O UN DOCUMENTO:
//
//   Ya no se edita este archivo. Los sectores viven en la base de datos
//   y se administran desde el panel de administración (admin.html,
//   sección "Sectores"): ahí se crean/eliminan sectores, y al cargar o
//   reemplazar un documento se elige a qué sector pertenece. Este
//   archivo solo pinta lo que el servidor le manda en GET /api/documentos
//   (cada documento con el nombre de su sector, o null si no tiene uno).
//
//   Un documento sin sector asignado NO desaparece: se agrupa
//   automáticamente en "Otros" para que siempre puedas encontrarlo y
//   seleccionarlo (ver función agruparPorSector).
// -------------------------------------------------------------------

// Antes esto importaba obtenerDocumentosDisponibles() directo de
// LectorDeJSON.js. Ese archivo ya no existe en el cliente (vive solo en
// el servidor), así que ahora le preguntamos al servidor por la lista.
// Cada elemento es { nombre, sector } — "sector" es el nombre del sector
// asignado desde el panel de administración, o null si no tiene uno.
async function obtenerDocumentosDisponibles() {
  const respuesta = await fetch('/api/documentos');

  if (!respuesta.ok) {
    // Guardamos el status en el error para que inicializarSistemaDeBotones
    // pueda distinguir "no hay sesión" (mandar a login) de cualquier otro
    // problema (mostrar un mensaje y dejar reintentar).
    const datosError = await respuesta.json().catch(() => ({}));
    const error = new Error(datosError.error || 'No se pudo obtener la lista de documentos del servidor.');
    error.status = respuesta.status;
    throw error;
  }

  const datos = await respuesta.json();
  return datos.documentos;
}

// Agrupa la lista plana de documentos ({ nombre, sector }) en un objeto
// { nombreDeSector: [nombreDeDocumento, ...] }. Los sin sector caen en
// "Otros", que siempre queda al final; el resto se ordena alfabéticamente.
function agruparPorSector(documentos) {
  const agrupado = {};
  documentos.forEach(({ nombre, sector }) => {
    const clave = sector || 'Otros';
    if (!agrupado[clave]) agrupado[clave] = [];
    agrupado[clave].push(nombre);
  });

  const nombresDeSectores = Object.keys(agrupado)
    .filter(nombreSector => nombreSector !== 'Otros')
    .sort((a, b) => a.localeCompare(b, 'es'));
  if (agrupado['Otros']) nombresDeSectores.push('Otros');

  const ordenado = {};
  nombresDeSectores.forEach(nombreSector => (ordenado[nombreSector] = agrupado[nombreSector]));
  return ordenado;
}

const seleccionados = new Set();
let listo = false; // true cuando ya se terminaron de pintar los botones

export async function inicializarSistemaDeBotones(idContenedor) {
  const contenedor = document.getElementById(idContenedor);
  if (!contenedor) {
    console.error(`sistemaDeBotones.js: no encontré #${idContenedor} en el HTML.`);
    return;
  }

  // Antes, si /api/documentos fallaba (servidor caído, red, etc.), la
  // promesa tronaba sin capturarse y el usuario se quedaba viendo la
  // barra lateral vacía sin ninguna pista de qué pasó. Ahora mostramos
  // un mensaje claro y dejamos un botón para reintentar.
  contenedor.innerHTML = '<p class="mensaje-carga">Cargando leyes disponibles…</p>';

  let documentosExistentes;
  try {
    documentosExistentes = await obtenerDocumentosDisponibles();
  } catch (error) {
    console.error('sistemaDeBotones.js: no se pudo obtener la lista de documentos:', error);

    if (error.status === 401) {
      window.location.href = 'login.html';
      return;
    }

    // 403 (ej. licencia vencida) trae un mensaje específico del
    // servidor en error.message; cualquier otro caso usa uno genérico.
    // Se arma con textContent (no innerHTML) para no interpretar el
    // mensaje como HTML por accidente.
    contenedor.innerHTML = '';
    const parrafoError = document.createElement('p');
    parrafoError.classList.add('mensaje-error');
    parrafoError.textContent = error.status === 403
      ? error.message
      : 'No se pudo cargar la lista de leyes. Revisa tu conexión con el servidor.';
    contenedor.appendChild(parrafoError);

    const botonReintentar = document.createElement('button');
    botonReintentar.type = 'button';
    botonReintentar.classList.add('boton-checkbox');
    botonReintentar.textContent = 'Reintentar';
    botonReintentar.addEventListener('click', () => inicializarSistemaDeBotones(idContenedor));
    contenedor.appendChild(botonReintentar);
    return;
  }

  const nombresDeDocumentos = documentosExistentes.map(doc => doc.nombre);
  const sectoresAgrupados = agruparPorSector(documentosExistentes);

  nombresDeDocumentos.forEach(doc => seleccionados.add(doc)); // todo activo al inicio

  contenedor.innerHTML = '';
  contenedor.appendChild(crearBotonGeneral(nombresDeDocumentos));

  for (const nombreSector in sectoresAgrupados) {
    contenedor.appendChild(crearBloqueSector(nombreSector, sectoresAgrupados[nombreSector]));
  }

  listo = true;
}

// Botón de hasta arriba: selecciona/deselecciona TODOS los documentos.
function crearBotonGeneral(todosLosDocumentos) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.classList.add('boton-checkbox', 'boton-general', 'activo');
  boton.textContent = 'Seleccionar todo';

  boton.addEventListener('click', () => {
    const activar = !boton.classList.contains('activo');
    todosLosDocumentos.forEach(doc => (activar ? seleccionados.add(doc) : seleccionados.delete(doc)));
    document.querySelectorAll('.boton-checkbox').forEach(b => b.classList.toggle('activo', activar));
    console.log('Documentos seleccionados:', [...seleccionados]);
  });

  return boton;
}

// Un bloque = título del sector + su botón "seleccionar todo" + un botón
// por cada documento que pertenece a ese sector.
function crearBloqueSector(nombreSector, documentosDelSector) {
  const bloque = document.createElement('div');
  bloque.classList.add('bloque-sector');

  // NUEVO: título ahora es clicable y trae una flecha (▶) que gira a (▼)
  // cuando el sector está abierto. Esto NO toca la selección de documentos,
  // solo oculta/muestra lo que hay debajo.
  const titulo = document.createElement('h3');
  titulo.classList.add('titulo-sector');
  titulo.innerHTML = '<span class="flecha-sector">▶</span> ' + nombreSector;
  bloque.appendChild(titulo);

  // NUEVO: todo lo que antes iba directo en "bloque" (botón de sector +
  // botones de documentos) ahora vive dentro de este contenedor, que es
  // el que se oculta/muestra. La lógica de adentro no cambió en nada.
  const contenidoSector = document.createElement('div');
  contenidoSector.classList.add('contenido-sector');
  bloque.appendChild(contenidoSector);

  const botonSector = document.createElement('button');
  botonSector.type = 'button';
  botonSector.classList.add('boton-checkbox', 'boton-sector', 'activo');
  botonSector.textContent = 'Seleccionar todo';
  contenidoSector.appendChild(botonSector);

  const botonesDeDocumentos = documentosDelSector.map(nombreDocumento =>
    crearBotonDocumento(nombreDocumento, contenidoSector)
  );

  botonSector.addEventListener('click', () => {
    const activar = !botonSector.classList.contains('activo');
    documentosDelSector.forEach(doc => (activar ? seleccionados.add(doc) : seleccionados.delete(doc)));
    botonSector.classList.toggle('activo', activar);
    botonesDeDocumentos.forEach(b => b.classList.toggle('activo', activar));
    console.log('Documentos seleccionados:', [...seleccionados]);
  });

  // NUEVO: clic en el título -> abre/cierra el sector (solo visual).
  titulo.addEventListener('click', () => {
    titulo.classList.toggle('abierto');
    contenidoSector.classList.toggle('abierto');
  });

  return bloque;
}

function crearBotonDocumento(nombreDocumento, bloqueDondeAgregarlo) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.classList.add('boton-checkbox', 'boton-documento-sector', 'activo');
  boton.textContent = nombreDocumento;

  boton.addEventListener('click', () => {
    if (seleccionados.has(nombreDocumento)) {
      seleccionados.delete(nombreDocumento);
      boton.classList.remove('activo');
    } else {
      seleccionados.add(nombreDocumento);
      boton.classList.add('activo');
    }
    console.log('Documentos seleccionados:', [...seleccionados]);
  });

  bloqueDondeAgregarlo.appendChild(boton);
  return boton;
}

// Mientras los botones no han terminado de pintarse, regresamos null para
// que buscarArticulosPorGrupos() no filtre nada (busque en todo) en vez de
// devolver 0 resultados por una carrera de tiempos.
export function obtenerDocumentosSeleccionados() {
  return listo ? [...seleccionados] : null;
}