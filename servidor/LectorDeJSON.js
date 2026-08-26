// LectorDeJSON.js (versión con base de datos)
// -------------------------------------------------------------------
// Antes esta lógica leía los JSON de servidor/datos/ con fs. Ahora las
// leyes viven en SQLite (ver servidor/db/conexion.js) — así sobreviven
// a un despliegue con disco efímero, y el panel de administración
// (Fase 3) puede agregarlas/reemplazarlas/borrarlas con consultas de
// SQL en vez de reescribir archivos a mano.
//
// El nombre del archivo se queda igual por ahora para no romper el
// import en procesarBusqueda.js — lo que importa es que las tres
// funciones exportadas (obtenerDocumentosDisponibles,
// buscarArticulosPorGrupos, buscarArticuloPorNumero) mantienen
// exactamente la misma firma que la versión de archivos, así que
// procesarBusqueda.js no tuvo que cambiar en nada.
//
// Para cargar las leyes que ya existían en servidor/datos/*.json a esta
// base de datos, corre una sola vez: npm run migrar-datos
// (ver servidor/scripts/migrarDatosIniciales.js).
// -------------------------------------------------------------------

import { db } from './db/conexion.js';
import { obtenerTerminosEquivalentes } from './diccionario.js';

let leyesCache = null;

// El panel de administración (Fase 3) llama esto después de
// crear/reemplazar/borrar un documento legal, para que la siguiente
// búsqueda vuelva a leer de la base de datos en vez de seguir usando la
// copia en memoria de antes del cambio.
export function invalidarCacheDeLeyes() {
  leyesCache = null;
}

// A diferencia de la versión de archivos —donde el "id" de un artículo
// solo era único DENTRO de su propio JSON, y hacía falta combinarlo con
// el nombre de la fuente para no toparse con otro artículo de una ley
// distinta que compartiera número de id— aquí "articulos.id" es la
// llave primaria autoincremental de UNA sola tabla que junta todas las
// leyes: por construcción ya es única en todo el sistema, así que ya no
// hace falta ninguna clave compuesta para agrupar o buscar por id.
function cargarLeyes() {
  if (leyesCache) return leyesCache;

  const filas = db.prepare(`
    SELECT
      articulos.id AS id,
      documentos_legales.nombre AS documento,
      documentos_legales.ultima_reforma AS ultimaReforma,
      articulos.numero AS numero,
      articulos.titulo AS titulo,
      articulos.palabras_clave AS palabrasClaveJSON,
      textos.texto AS texto
    FROM articulos
    JOIN documentos_legales ON documentos_legales.id = articulos.documento_id
    LEFT JOIN textos ON textos.articulo_id = articulos.id
  `).all();

  leyesCache = filas.map(fila => ({
    id: fila.id,
    documento: fila.documento,
    ultimaReforma: fila.ultimaReforma,
    numero: fila.numero,
    titulo: fila.titulo,
    palabrasClave: JSON.parse(fila.palabrasClaveJSON),
    texto: fila.texto ?? ''
  }));

  return leyesCache;
}

function extraerNumero(texto) {
  const coincidencia = String(texto).match(/\d+/);
  return coincidencia ? coincidencia[0] : null;
}

// Lista de documentos (nombre + nombre de su sector, o null si no tiene
// uno asignado) para que el cliente pinte los botones agrupados por
// sector (ver publico/Sistema/sistemaDeBotones.js). El agrupamiento ya
// no vive en el cliente: sale directo de documentos_legales.sector_id.
export function obtenerDocumentosDisponibles() {
  return db.prepare(`
    SELECT documentos_legales.nombre AS nombre, sectores.nombre AS sector
    FROM documentos_legales
    LEFT JOIN sectores ON sectores.id = documentos_legales.sector_id
    ORDER BY documentos_legales.nombre
  `).all();
}

// "términos" es TODO el grupo de sinónimos equivalentes a la palabra
// buscada (ver obtenerTerminosEquivalentes en diccionario.js) — no un
// solo concepto canónico. Es lo que permite que, por ejemplo, buscar
// "querella" encuentre también los artículos cuyo palabrasClave dice
// literalmente "denuncia" (y viceversa), en vez de solo los que
// coinciden con la palabra exacta que se resolvió.
function filtrarPorTerminos(articulos, terminos) {
  return articulos.filter(articulo =>
    articulo.palabrasClave.some(clave => {
      const claveLimpia = clave.toLowerCase();
      return terminos.some(termino => claveLimpia === termino);
    })
  );
}

function filtrarPorSubcadena(articulos, terminos) {
  return articulos.filter(articulo =>
    articulo.palabrasClave.some(clave => {
      const claveLimpia = clave.toLowerCase();
      return terminos.some(termino => claveLimpia.includes(termino));
    })
  );
}

// Antes esto elegía UNA sola estrategia por palabra: exacta si había
// alguna coincidencia exacta, o subcadena si no. Esa elección todo-o-nada
// resultó no tener una sola forma correcta de decidirse:
//   - Decidirla sobre los documentos YA filtrados rompía la sinonimia:
//     con pocos documentos seleccionados (ej. solo "Civil", donde
//     "denuncia" no es etiqueta exacta de ningún artículo, solo aparece
//     dentro de palabras como "denunciante" o "denunciado") se activaba
//     el fallback de subcadena y aparecían más resultados que buscando
//     en TODOS los documentos (donde si el Código de Justicia Militar sí
//     tiene "denuncia" como etiqueta exacta, la coincidencia exacta
//     ganaba y el fallback nunca se intentaba) — menos documentos
//     seleccionados daba MÁS resultados que todos seleccionados.
//   - Decidirla sobre TODO el corpus (sin importar el filtro) arregló
//     eso, pero rompió el caso contrario: como el Código de Justicia
//     Militar SÍ tiene "denuncia" exacta, esa sola coincidencia en un
//     documento que la persona ni siquiera tenía seleccionado apagaba el
//     fallback de subcadena para todos los demás documentos — filtrar
//     solo a "Civil" pasó de dar 7 resultados a dar 0, aunque esos 7
//     artículos de Civil no cambiaron en nada.
//
// La solución real es no elegir: se juntan los resultados de las dos
// búsquedas (exacta ∪ subcadena) sobre los documentos que de verdad
// están seleccionados, sin mirar el resto del corpus para decidir nada.
// Así, agregar más documentos a la selección solo puede sumar
// resultados, nunca quitarlos — y cada documento aporta sus propias
// coincidencias sin que lo que tenga otro documento (seleccionado o no)
// se lo impida.
function encontrarArticulosPorPalabra(articulos, palabraBuscada) {
  const palabraLimpia = palabraBuscada.toLowerCase().trim();
  const terminosEquivalentes = obtenerTerminosEquivalentes(palabraLimpia);

  if (!terminosEquivalentes) {
    return filtrarPorSubcadena(articulos, [palabraLimpia]);
  }

  return [
    ...filtrarPorTerminos(articulos, terminosEquivalentes),
    ...filtrarPorSubcadena(articulos, terminosEquivalentes)
  ];
}

// La fecha se guarda como texto "AAAA-MM-DD" (viene de un <input type="date">
// del panel de administración). Se arma la versión "DD/MM/AAAA" a mano,
// con split, en vez de pasar por new Date().toLocaleDateString(): un
// objeto Date interpretaría "2025-01-15" como medianoche UTC, y en
// husos horarios al oeste de Greenwich (como México) eso puede mostrar
// un día antes del que realmente se guardó.
function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split('-');
  return `${dia}/${mes}/${anio}`;
}

function formatearResultado(articulo) {
  const etiquetaReforma = articulo.ultimaReforma
    ? ` (última reforma: ${formatearFecha(articulo.ultimaReforma)})`
    : '';
  return `[${articulo.documento}: "${articulo.numero}" ${articulo.titulo}]${etiquetaReforma} ${articulo.texto}`;
}

export function buscarArticulosPorGrupos(gruposDePalabras, documentosSeleccionados = null) {
  const todosLosArticulos = cargarLeyes();
  const articulos = documentosSeleccionados
    ? todosLosArticulos.filter(a => documentosSeleccionados.includes(a.documento))
    : todosLosArticulos;

  const idsPorGrupo = gruposDePalabras.map(grupo => {
    const ids = new Set();
    grupo.forEach(palabra => {
      encontrarArticulosPorPalabra(articulos, palabra).forEach(art => ids.add(art.id));
    });
    return ids;
  });

  const idsComunes = idsPorGrupo.length > 0
    ? [...idsPorGrupo[0]].filter(id => idsPorGrupo.every(conjunto => conjunto.has(id)))
    : [];

  return idsComunes.map(id => formatearResultado(articulos.find(a => a.id === id)));
}

export function buscarArticuloPorNumero(numeroBuscado, documentosSeleccionados = null) {
  const numeroLimpio = extraerNumero(numeroBuscado);
  if (!numeroLimpio) return [];

  const todosLosArticulos = cargarLeyes();
  const articulos = documentosSeleccionados
    ? todosLosArticulos.filter(a => documentosSeleccionados.includes(a.documento))
    : todosLosArticulos;

  return articulos
    .filter(a => extraerNumero(a.numero) === numeroLimpio)
    .map(formatearResultado);
}
