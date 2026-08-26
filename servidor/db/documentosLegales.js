// documentosLegales.js
// -------------------------------------------------------------------
// Consultas para administrar leyes completas (documento + sus artículos
// + sus textos) desde el panel de administración. Reemplaza lo que
// antes era "agregar una línea a FUENTES y poner dos archivos JSON en
// servidor/datos/" — ahora es todo por SQL, dentro de una transacción
// (o se guarda completo, o no se guarda nada).
// -------------------------------------------------------------------

import { db, ejecutarEnTransaccion } from './conexion.js';

const insertarArticuloStmt = db.prepare(`
  INSERT INTO articulos (documento_id, articulo_ref, numero, titulo, palabras_clave)
  VALUES (?, ?, ?, ?, ?)
`);
const insertarTextoStmt = db.prepare('INSERT INTO textos (articulo_id, texto) VALUES (?, ?)');

export function listarDocumentosConConteo() {
  return db.prepare(`
    SELECT
      documentos_legales.id,
      documentos_legales.nombre,
      documentos_legales.ultima_reforma,
      documentos_legales.actualizado_en,
      documentos_legales.sector_id,
      sectores.nombre AS sector_nombre,
      COUNT(articulos.id) AS total_articulos
    FROM documentos_legales
    LEFT JOIN articulos ON articulos.documento_id = documentos_legales.id
    LEFT JOIN sectores ON sectores.id = documentos_legales.sector_id
    GROUP BY documentos_legales.id
    ORDER BY documentos_legales.nombre
  `).all();
}

export function buscarDocumentoPorId(id) {
  return db.prepare('SELECT * FROM documentos_legales WHERE id = ?').get(id);
}

export function buscarDocumentoPorNombre(nombre) {
  return db.prepare('SELECT * FROM documentos_legales WHERE nombre = ?').get(nombre);
}

function insertarArticulosYTextos(documentoId, articulos, textosPorId) {
  let totalConTexto = 0;
  for (const articulo of articulos) {
    const info = insertarArticuloStmt.run(
      documentoId,
      String(articulo.id),
      articulo.numero,
      articulo.titulo,
      JSON.stringify(articulo.palabrasClave)
    );
    const texto = textosPorId.get(String(articulo.id));
    if (texto) {
      insertarTextoStmt.run(info.lastInsertRowid, texto);
      totalConTexto++;
    }
  }
  return totalConTexto;
}

// Crea un documento legal NUEVO (ya validado por quien llama, ver
// servidor/admin/validarDocumentoLegal.js) con todos sus artículos y
// textos, todo en una sola transacción. sectorId es opcional — sin él,
// el documento se agrupa en "Otros" del lado del cliente.
export function crearDocumentoConArticulos({ nombre, ultimaReforma, sectorId, articulos, textosPorId }) {
  return ejecutarEnTransaccion(() => {
    const info = db.prepare('INSERT INTO documentos_legales (nombre, ultima_reforma, sector_id) VALUES (?, ?, ?)')
      .run(nombre, ultimaReforma || null, sectorId || null);
    const documentoId = info.lastInsertRowid;
    insertarArticulosYTextos(documentoId, articulos, textosPorId);
    return documentoId;
  });
}

// Reemplaza TODO el contenido de un documento legal que ya existía:
// borra sus artículos/textos viejos (el ON DELETE CASCADE de la tabla
// articulos se encarga de borrar los textos asociados) y mete los
// nuevos. También actualiza nombre, última reforma y sector por si
// cambiaron.
export function reemplazarArticulosDeDocumento(documentoId, { nombre, ultimaReforma, sectorId, articulos, textosPorId }) {
  return ejecutarEnTransaccion(() => {
    db.prepare('DELETE FROM articulos WHERE documento_id = ?').run(documentoId);
    db.prepare(`
      UPDATE documentos_legales
      SET nombre = ?, ultima_reforma = ?, sector_id = ?, actualizado_en = datetime('now')
      WHERE id = ?
    `).run(nombre, ultimaReforma || null, sectorId || null, documentoId);
    insertarArticulosYTextos(documentoId, articulos, textosPorId);
    return documentoId;
  });
}

// ON DELETE CASCADE en "articulos" (y de ahí a "textos") se encarga del
// resto: borrar el documento basta.
export function eliminarDocumento(documentoId) {
  db.prepare('DELETE FROM documentos_legales WHERE id = ?').run(documentoId);
}
