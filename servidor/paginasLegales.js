// paginasLegales.js
// -------------------------------------------------------------------
// Genera las páginas /terminos-y-condiciones.html y
// /avisos-de-privacidad.html a partir de los archivos Markdown de la
// raíz del proyecto:
//   Terminos_y_Condiciones_Artonseley.md
//   Aviso_de_Privacidad_Artonseley.md
//
// La idea: el TEXTO de esos documentos se edita en un solo lugar —el
// .md, en texto plano— y la página se arma sola en cada carga. No hay
// que tocar HTML ni mantener dos copias en sincronía. Para publicar un
// cambio: editar el .md (en GitHub o local), hacer commit/push, y
// Render redespliega.
//
// El .md se lee en CADA petición (pesan ~20 KB y estas páginas casi no
// tienen tráfico), así que en desarrollo un cambio al archivo se ve con
// solo recargar, sin reiniciar el servidor.
// -------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderizarMarkdownLegal } from './renderizarMarkdownLegal.js';

const RAIZ_PROYECTO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Ruta pública -> archivo .md de origen + título corto para la pestaña.
const DOCUMENTOS = {
  'terminos-y-condiciones.html': {
    archivo: 'Terminos_y_Condiciones_Artonseley.md',
    titulo: 'Términos y Condiciones'
  },
  'avisos-de-privacidad.html': {
    archivo: 'Aviso_de_Privacidad_Artonseley.md',
    titulo: 'Avisos de Privacidad'
  }
};

// Mismo esqueleto que tenían las páginas .html estáticas: enlaza
// documento.css (el estilo compartido de las "hojas de documento") y
// Sistema/manejaPaginaLegal.js (ajusta el enlace "Volver" según haya o
// no sesión). El cuerpo se inserta dentro de .hoja-documento.
function armarPagina({ titulo, cuerpoHTML }) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${titulo} - Artonseley</title>
    <link rel="icon" type="image/png" href="imagenes/artonseley-favicon.png">
    <link rel="stylesheet" href="documento.css">
</head>
<body>
    <div class="hoja-documento">
        <a href="index.html" class="volver">← Volver al buscador</a>
${cuerpoHTML}
    </div>
    <script type="module" src="Sistema/manejaPaginaLegal.js"></script>
</body>
</html>
`;
}

export async function manejarPaginaLegal(nombreRutaHTML, respuesta) {
  const doc = DOCUMENTOS[nombreRutaHTML];
  if (!doc) {
    return respuesta.status(404).send('No encontrado.');
  }

  try {
    const markdown = await readFile(path.join(RAIZ_PROYECTO, doc.archivo), 'utf-8');
    const cuerpoHTML = renderizarMarkdownLegal(markdown);
    respuesta.type('html').send(armarPagina({ titulo: doc.titulo, cuerpoHTML }));
  } catch (error) {
    console.error(`No se pudo generar ${nombreRutaHTML} desde ${doc.archivo}:`, error);
    respuesta.status(500).send('No se pudo cargar el documento en este momento.');
  }
}
