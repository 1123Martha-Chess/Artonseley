// validarDocumentoLegal.js
// -------------------------------------------------------------------
// Antes de guardar un documento legal cargado desde el panel de
// administración, se valida que:
//   - cada artículo traiga los campos que necesita el resto del sistema
//     (id, numero, titulo, palabrasClave no vacío).
//   - cada artículo tenga su texto correspondiente, y que ese texto no
//     esté vacío.
//   - no queden textos "huérfanos" (con un id que no corresponde a
//     ningún artículo del mismo documento).
//
// Si hay CUALQUIER problema, se regresa la lista completa de errores y
// el documento NO se guarda — mejor que el administrador corrija el
// JSON antes de que un abogado vea una tarjeta de resultado con texto
// vacío (fue justo el problema que encontramos con "Ley de Aguas
// Nacionales" en la Fase 1).
//
// Acepta tanto el formato con wrapper ({ articulos: [...] } /
// { textos: [...] }, el mismo de siempre en servidor/datos/) como un
// arreglo suelto, para no obligar al administrador a acordarse de la
// envoltura exacta.
// -------------------------------------------------------------------

function comoArreglo(datos, nombreClave) {
  if (Array.isArray(datos)) return datos;
  if (datos && Array.isArray(datos[nombreClave])) return datos[nombreClave];
  return null;
}

export function normalizarArticulos(datos) {
  return comoArreglo(datos, 'articulos');
}

export function normalizarTextos(datos) {
  return comoArreglo(datos, 'textos');
}

export function validarDocumentoLegal({ nombre, articulos, textos }) {
  const errores = [];

  if (!nombre || !nombre.trim()) {
    errores.push('Falta el nombre del documento (ej. "Código Penal").');
  } else if (nombre.trim().length > 200) {
    errores.push('El nombre del documento es demasiado largo (máximo 200 caracteres).');
  }

  if (!Array.isArray(articulos)) {
    errores.push('El JSON de artículos no tiene la forma esperada: un arreglo, o un objeto { "articulos": [...] }.');
  }
  if (!Array.isArray(textos)) {
    errores.push('El JSON de textos no tiene la forma esperada: un arreglo, o un objeto { "textos": [...] }.');
  }

  // Sin ambos arreglos no hay nada más que validar de forma segura.
  if (errores.length > 0) return errores;

  if (articulos.length === 0) {
    errores.push('El documento no trae ningún artículo.');
    return errores;
  }

  const idsVistos = new Set();
  articulos.forEach((articulo, indice) => {
    const etiqueta = `Artículo #${indice + 1}${articulo?.numero ? ` (${articulo.numero})` : ''}`;

    if (articulo?.id === undefined || articulo?.id === null || String(articulo.id).trim() === '') {
      errores.push(`${etiqueta}: falta "id".`);
    } else if (idsVistos.has(String(articulo.id))) {
      errores.push(`${etiqueta}: el id "${articulo.id}" está repetido dentro de este mismo documento.`);
    } else {
      idsVistos.add(String(articulo.id));
    }

    if (!articulo?.numero || !String(articulo.numero).trim()) {
      errores.push(`${etiqueta}: falta "numero".`);
    }
    if (!articulo?.titulo || !String(articulo.titulo).trim()) {
      errores.push(`${etiqueta}: falta "titulo".`);
    }
    if (!Array.isArray(articulo?.palabrasClave) || articulo.palabrasClave.length === 0) {
      errores.push(`${etiqueta}: "palabrasClave" debe ser una lista con al menos una palabra.`);
    }
  });

  const textosPorId = new Map(
    textos
      .filter(t => t && t.id !== undefined && t.id !== null)
      .map(t => [String(t.id), t.texto])
  );

  for (const articulo of articulos) {
    if (articulo?.id === undefined || articulo?.id === null) continue; // ya se avisó arriba
    const idArticulo = String(articulo.id);
    const etiqueta = `Artículo "${articulo.numero || idArticulo}"`;

    if (!textosPorId.has(idArticulo)) {
      errores.push(`${etiqueta}: no tiene ningún texto correspondiente (id "${idArticulo}" no aparece en el JSON de textos).`);
    } else if (!textosPorId.get(idArticulo)?.trim()) {
      errores.push(`${etiqueta}: su texto está vacío.`);
    }
  }

  for (const idTexto of textosPorId.keys()) {
    if (!idsVistos.has(idTexto)) {
      errores.push(`El texto con id "${idTexto}" no corresponde a ningún artículo de este documento (texto huérfano).`);
    }
  }

  return errores;
}
