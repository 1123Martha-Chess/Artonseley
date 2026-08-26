// migrarDatosIniciales.js
// -------------------------------------------------------------------
// Script de un solo uso: lee las leyes que hoy viven en
// servidor/datos/articulos|textos/*.json (el formato de siempre,
// { articulos: [...] } / { textos: [...] }) y las inserta en las tablas
// SQLite (documentos_legales / articulos / textos). También importa
// servidor/datos/sugerencias.json si existe.
//
// A partir de la Fase 3, este mismo formato JSON es el que acepta el
// panel de administración para cargar/reemplazar leyes — este script
// solo hace, a mano y una vez, lo que el panel hará por HTTP después.
//
// OJO: "Ley de Aguas Nacionales" (servidor/datos/articulos/leyesAguasNacionales.json)
// se deja fuera a propósito: su archivo de textos está casi vacío (solo
// 3 de 126 artículos tienen texto real) y sus ids no corresponden entre
// articulos y textos. Cárgala más adelante desde el panel de
// administración cuando el texto esté completo.
//
// Uso:
//   npm run migrar-datos
//   npm run migrar-datos -- --forzar   (si ya habías corrido esto antes
//                                        y quieres agregar de nuevo)
// -------------------------------------------------------------------

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, ejecutarEnTransaccion } from '../db/conexion.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CARPETA_DATOS = path.join(__dirname, '..', 'datos');

const FUENTES = [
  { archivo: 'leyes.json', archivoTextos: 'leyesTexto.json' },
  { archivo: 'leyes2.json', archivoTextos: 'leyes2Texto.json' }
];

async function cargarJSON(rutaRelativa) {
  const contenido = await readFile(path.join(CARPETA_DATOS, rutaRelativa), 'utf-8');
  return JSON.parse(contenido);
}

function insertarDocumento(nombre) {
  const existente = db.prepare('SELECT id FROM documentos_legales WHERE nombre = ?').get(nombre);
  if (existente) return existente.id;

  const info = db.prepare('INSERT INTO documentos_legales (nombre) VALUES (?)').run(nombre);
  return info.lastInsertRowid;
}

async function migrarLeyes() {
  const insertarArticulo = db.prepare(`
    INSERT INTO articulos (documento_id, articulo_ref, numero, titulo, palabras_clave)
    VALUES (?, ?, ?, ?, ?)
  `);
  const insertarTexto = db.prepare('INSERT INTO textos (articulo_id, texto) VALUES (?, ?)');

  let totalArticulos = 0;

  for (const fuente of FUENTES) {
    const datosArticulos = await cargarJSON(path.join('articulos', fuente.archivo));
    const datosTextos = await cargarJSON(path.join('textos', fuente.archivoTextos));
    const textosPorId = new Map(datosTextos.textos.map(t => [String(t.id), t.texto]));

    ejecutarEnTransaccion(() => {
      for (const articulo of datosArticulos.articulos) {
        const documentoId = insertarDocumento(articulo.documento.trim());
        const info = insertarArticulo.run(
          documentoId,
          String(articulo.id),
          articulo.numero,
          articulo.titulo,
          JSON.stringify(articulo.palabrasClave)
        );

        const texto = textosPorId.get(String(articulo.id));
        if (texto) {
          insertarTexto.run(info.lastInsertRowid, texto);
        } else {
          console.warn(`  ⚠️  Artículo "${articulo.numero}" (${articulo.documento}) no tiene texto correspondiente — se guardó sin texto.`);
        }
        totalArticulos++;
      }
    });

    console.log(`✔ ${fuente.archivo}: ${datosArticulos.articulos.length} artículos migrados.`);
  }

  console.log(`Total de artículos migrados: ${totalArticulos}`);
}

async function migrarSugerencias() {
  const rutaSugerencias = path.join(CARPETA_DATOS, 'sugerencias.json');
  let sugerencias;
  try {
    sugerencias = JSON.parse(await readFile(rutaSugerencias, 'utf-8'));
  } catch {
    console.log('No hay servidor/datos/sugerencias.json que migrar (no existe o está vacío) — se omite.');
    return;
  }

  const insertar = db.prepare('INSERT INTO sugerencias (mensaje, urgencia, creado_en) VALUES (?, ?, ?)');
  ejecutarEnTransaccion(() => {
    for (const s of sugerencias) {
      insertar.run(s.mensaje, s.urgencia || 'No especificada', s.fecha || new Date().toISOString());
    }
  });
  console.log(`✔ ${sugerencias.length} sugerencias migradas desde sugerencias.json.`);
}

async function main() {
  const forzar = process.argv.includes('--forzar');

  const yaHayDatos = db.prepare('SELECT COUNT(*) AS total FROM documentos_legales').get().total > 0;
  if (yaHayDatos && !forzar) {
    console.log(
      'Ya hay documentos legales cargados en la base de datos. Si de verdad quieres ' +
      'volver a insertar (esto puede duplicar leyes), corre:\n  npm run migrar-datos -- --forzar'
    );
    process.exit(0);
  }

  await migrarLeyes();
  await migrarSugerencias();
  console.log('Migración terminada.');
}

main().catch(error => {
  console.error('La migración falló:', error);
  process.exit(1);
});
