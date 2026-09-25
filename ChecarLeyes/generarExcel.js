// generarExcel.js — Arma leyes_artonseley.xlsx a partir de los CSV de ChecarLeyes, con formato
// (encabezados de color, fila de encabezado fija, filtros, anchos ajustados, fechas y números reales,
// enlaces que se pueden abrir y las leyes pendientes de actualizar resaltadas en amarillo).
//
// Pensado para subirlo a Google Drive y abrirlo con Hojas de cálculo de Google (no hace falta Excel).
//
// Uso:  node generarExcel.js      (checarLeyes.js también lo llama al final de cada revisión)
//
// Sin dependencias: el .xlsx (un .zip con XML adentro) se arma a mano con zlib de Node.

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const CARPETA = __dirname;
const ARCHIVO_EXCEL = path.join(CARPETA, 'leyes_artonseley.xlsx');

// Una hoja por CSV, en este orden.
const HOJAS = [
  { nombre: 'Leyes (Cámara)', csv: 'leyes_artonseley.csv' },
  { nombre: 'Leyes (DOF)', csv: 'leyes_artonseley_DOF.csv' },
  { nombre: 'Historial de cambios', csv: 'historial_cambios.csv' },
];

const COL_ULTIMA_REFORMA = 'Última reforma';
const COL_ACTUALIZADO = 'Actualizado en Artonseley';

const ANCHO_MINIMO = 6;
const ANCHO_MAXIMO = 60;
const LARGO_PARA_AJUSTAR_TEXTO = 60;

// ---------------------------------------------------------------------------
// Estilos (índices de cellXfs en styles.xml)
// ---------------------------------------------------------------------------

// Cada tipo de celda tiene su versión normal y su versión resaltada (fila pendiente de actualizar).
const TIPOS = ['texto', 'numero', 'fecha', 'fechaHora', 'enlace', 'textoLargo'];
const ESTILO_ENCABEZADO = 1;
const estiloDe = (tipo, resaltado) => 2 + TIPOS.indexOf(tipo) * 2 + (resaltado ? 1 : 0);

function xmlEstilos() {
  // numFmtId 164 = fecha, 165 = fecha y hora. fontId 0 = normal, 1 = encabezado, 2 = enlace.
  // fillId 2 = encabezado (azul de Artonseley), 3 = resaltado. borderId 1 = borde gris claro.
  const formato = { texto: 0, numero: 1, fecha: 164, fechaHora: 165, enlace: 0, textoLargo: 0 };
  const xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'];
  for (const tipo of TIPOS) {
    for (const resaltado of [false, true]) {
      const alineacion = tipo === 'textoLargo' ? '<alignment vertical="top" wrapText="1"/>' : '<alignment vertical="top"/>';
      xfs.push(`<xf numFmtId="${formato[tipo]}" fontId="${tipo === 'enlace' ? 2 : 0}" fillId="${resaltado ? 3 : 0}" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${alineacion}</xf>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="yyyy-mm-dd"/><numFmt numFmtId="165" formatCode="yyyy-mm-dd hh:mm"/></numFmts>
<fonts count="3">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
<font><u/><sz val="11"/><color rgb="FF1155CC"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF2A6BAF"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2CC"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="${xfs.length}">${xfs.join('')}</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

// ---------------------------------------------------------------------------
// Celdas
// ---------------------------------------------------------------------------

function escaparXML(texto) {
  return String(texto)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 1 → "A", 27 → "AA"
function letraDeColumna(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// Número de serie de fecha de hojas de cálculo (días desde 1899-12-30).
function serieDeFecha(a, m, d, h = 0, min = 0) {
  return (Date.UTC(a, m - 1, d, h, min) - Date.UTC(1899, 11, 30)) / 86400000;
}

function tipoDeValor(valor) {
  if (/^\d{1,9}$/.test(valor)) return 'numero';
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return 'fecha';
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(valor)) return 'fechaHora';
  if (/^https?:\/\/\S+$/.test(valor)) return 'enlace';
  return valor.length > LARGO_PARA_AJUSTAR_TEXTO ? 'textoLargo' : 'texto';
}

// ---------------------------------------------------------------------------
// Hojas
// ---------------------------------------------------------------------------

function xmlHoja({ encabezado, registros }, textosCompartidos) {
  const indiceDeTexto = (t) => {
    if (!textosCompartidos.mapa.has(t)) { textosCompartidos.mapa.set(t, textosCompartidos.lista.length); textosCompartidos.lista.push(t); }
    return textosCompartidos.mapa.get(t);
  };
  const anchos = encabezado.map((h) => h.length + 4); // + espacio para la flechita del filtro
  const filas = [];

  filas.push(`<row r="1">${encabezado.map((h, i) => `<c r="${letraDeColumna(i + 1)}1" t="s" s="${ESTILO_ENCABEZADO}"><v>${indiceDeTexto(h)}</v></c>`).join('')}</row>`);

  registros.forEach((r, j) => {
    const fila = j + 2;
    // Resaltada si la ley se reformó después de la última vez que se actualizó en Artonseley.
    const resaltada = !!(r[COL_ULTIMA_REFORMA] && r[COL_ACTUALIZADO] && r[COL_ULTIMA_REFORMA] > r[COL_ACTUALIZADO]);
    const celdas = encabezado.map((h, i) => {
      const valor = String(r[h] ?? '');
      const ref = `${letraDeColumna(i + 1)}${fila}`;
      const tipo = tipoDeValor(valor);
      const s = estiloDe(tipo, resaltada);
      anchos[i] = Math.max(anchos[i], valor.length + 2);
      if (valor === '') return `<c r="${ref}" s="${s}"/>`;
      if (tipo === 'numero') return `<c r="${ref}" s="${s}"><v>${valor}</v></c>`;
      if (tipo === 'fecha' || tipo === 'fechaHora') {
        const [a, m, d, hh = 0, mm = 0] = valor.match(/\d+/g).map(Number);
        return `<c r="${ref}" s="${s}"><v>${serieDeFecha(a, m, d, hh, mm)}</v></c>`;
      }
      if (tipo === 'enlace') {
        const formula = `HYPERLINK("${valor.replace(/"/g, '""')}")`;
        return `<c r="${ref}" t="str" s="${s}"><f>${escaparXML(formula)}</f><v>${escaparXML(valor)}</v></c>`;
      }
      return `<c r="${ref}" t="s" s="${s}"><v>${indiceDeTexto(valor)}</v></c>`;
    });
    filas.push(`<row r="${fila}">${celdas.join('')}</row>`);
  });

  const ultimaCelda = `${letraDeColumna(encabezado.length)}${registros.length + 1}`;
  const columnas = anchos.map((a, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(ANCHO_MAXIMO, Math.max(ANCHO_MINIMO, a))}" customWidth="1"/>`).join('');
  return {
    rango: `$A$1:$${letraDeColumna(encabezado.length)}$${registros.length + 1}`,
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<dimension ref="A1:${ultimaCelda}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${columnas}</cols>
<sheetData>${filas.join('')}</sheetData>
<autoFilter ref="A1:${ultimaCelda}"/>
</worksheet>`,
  };
}

// ---------------------------------------------------------------------------
// Zip (el .xlsx es un zip con estos XML)
// ---------------------------------------------------------------------------

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buffer) {
  if (zlib.crc32) return zlib.crc32(buffer);
  let c = 0xffffffff;
  for (const b of buffer) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function armarZip(archivos) {
  const partes = [];
  const central = [];
  let desplazamiento = 0;
  for (const { nombre, contenido } of archivos) {
    const nombreBytes = Buffer.from(nombre, 'utf8');
    const datos = Buffer.from(contenido, 'utf8');
    const comprimidos = zlib.deflateRawSync(datos);
    const crc = crc32(datos);
    // Fecha/hora fija (1980-01-01): el zip no necesita la real.
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(comprimidos.length, 18); local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombreBytes.length, 26); local.writeUInt16LE(0, 28);
    const cabecera = Buffer.alloc(46);
    cabecera.writeUInt32LE(0x02014b50, 0); cabecera.writeUInt16LE(20, 4); cabecera.writeUInt16LE(20, 6);
    cabecera.writeUInt16LE(0x0800, 8); cabecera.writeUInt16LE(8, 10); cabecera.writeUInt16LE(0, 12); cabecera.writeUInt16LE(0x21, 14);
    cabecera.writeUInt32LE(crc, 16); cabecera.writeUInt32LE(comprimidos.length, 20); cabecera.writeUInt32LE(datos.length, 24);
    cabecera.writeUInt16LE(nombreBytes.length, 28); cabecera.writeUInt32LE(desplazamiento, 42);
    partes.push(local, nombreBytes, comprimidos);
    central.push(cabecera, nombreBytes);
    desplazamiento += local.length + nombreBytes.length + comprimidos.length;
  }
  const directorio = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(archivos.length, 8); fin.writeUInt16LE(archivos.length, 10);
  fin.writeUInt32LE(directorio.length, 12); fin.writeUInt32LE(desplazamiento, 16);
  return Buffer.concat([...partes, directorio, fin]);
}

// ---------------------------------------------------------------------------
// Libro
// ---------------------------------------------------------------------------

function generarExcel() {
  const { leerCSV } = require('./checarLeyes.js');
  const textosCompartidos = { lista: [], mapa: new Map() };
  const hojas = HOJAS
    .filter((h) => fs.existsSync(path.join(CARPETA, h.csv)))
    .map((h) => ({ ...h, ...xmlHoja(leerCSV(path.join(CARPETA, h.csv)), textosCompartidos) }));

  const archivos = [
    { nombre: '[Content_Types].xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
${hojas.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>` },
    { nombre: '_rels/.rels', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },
    { nombre: 'xl/workbook.xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<bookViews><workbookView/></bookViews>
<sheets>${hojas.map((h, i) => `<sheet name="${escaparXML(h.nombre)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>
<definedNames>${hojas.map((h, i) => `<definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${escaparXML(h.nombre)}'!${h.rango}</definedName>`).join('')}</definedNames>
</workbook>` },
    { nombre: 'xl/_rels/workbook.xml.rels', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${hojas.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('\n')}
<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId${hojas.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>` },
    { nombre: 'xl/styles.xml', contenido: xmlEstilos() },
    ...hojas.map((h, i) => ({ nombre: `xl/worksheets/sheet${i + 1}.xml`, contenido: h.xml })),
    { nombre: 'xl/sharedStrings.xml', contenido: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${textosCompartidos.lista.length}" uniqueCount="${textosCompartidos.lista.length}">${textosCompartidos.lista.map((t) => `<si><t xml:space="preserve">${escaparXML(t)}</t></si>`).join('')}</sst>` },
  ];

  fs.writeFileSync(ARCHIVO_EXCEL, armarZip(archivos));
  return ARCHIVO_EXCEL;
}

module.exports = { generarExcel };

if (require.main === module) {
  console.log(`Listo: ${generarExcel()}`);
}
