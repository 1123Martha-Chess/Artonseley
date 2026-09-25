// checarLeyes.js — Revisión diaria de las leyes vigentes (Cámara de Diputados + DOF).
//
// Uso:  node checarLeyes.js
//
// Qué hace en cada corrida:
//  1. Cámara de Diputados (LeyesBiblio):
//     - Lee la lista de Leyes Federales Vigentes y compara contra la foto anterior
//       (leyes nuevas, leyes que salieron de la lista, fechas de reforma que cambiaron, avisos).
//     - Lee "Actualizaciones <año>" y registra toda entrada nueva.
//     - Actualiza "Última reforma" y "Pendiente de actualizar" en leyes_artonseley.csv (el ORIGINAL).
//  2. DOF (dof.gob.mx):
//     - Lee el índice de cada día desde la última revisión hasta hoy (todas las ediciones).
//     - Registra TODAS las publicaciones nuevas en la bitácora.
//     - Si un decreto reforma/adiciona/deroga una de nuestras leyes, actualiza "Última reforma"
//       en leyes_artonseley_DOF.csv (la COPIA), nunca en el original.
//  3. Todo cambio de fecha va a historial_cambios.csv; todo lo nuevo (y la fecha/hora de la
//     revisión, aunque no haya nada nuevo) va a bitacora_DOF_y_Camara.md.
//
// Sin dependencias: solo Node 18+ (usa fetch nativo).

'use strict';

const fs = require('fs');
const path = require('path');

const CARPETA = __dirname;
const CSV_ORIGINAL = path.join(CARPETA, 'leyes_artonseley.csv');
const CSV_COPIA_DOF = path.join(CARPETA, 'leyes_artonseley_DOF.csv');
const CSV_HISTORIAL = path.join(CARPETA, 'historial_cambios.csv');
const BITACORA = path.join(CARPETA, 'bitacora_DOF_y_Camara.md');
const CARPETA_ESTADO = path.join(CARPETA, 'estado');
const ARCHIVO_ESTADO = path.join(CARPETA_ESTADO, 'estado.json');

const URL_CAMARA = 'https://www.diputados.gob.mx/LeyesBiblio/';
const URL_DOF = 'https://dof.gob.mx/';
const ZONA_HORARIA = 'America/Mexico_City';

const COL_NOMBRE_OFICIAL = 'Nombre oficial';
const COL_ULTIMA_REFORMA = 'Última reforma';
const COL_ACTUALIZADO = 'Actualizado en Artonseley';
const COL_PENDIENTE = 'Pendiente de actualizar';

const ENCABEZADO_HISTORIAL = ['Fecha de revisión', 'Fuente', '#', 'Ley', 'Reforma anterior', 'Reforma nueva', 'Archivo modificado', 'Detalle', 'Enlace'];

// Días de DOF a revisar como máximo en una sola corrida (por si la computadora estuvo apagada mucho tiempo).
const MAX_DIAS_DOF_POR_CORRIDA = 60;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Quita acentos y espacios repetidos, pero conserva mayúsculas (misma longitud que normalizar()).
function sinAcentos(texto) {
  return String(texto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizar(texto) {
  return sinAcentos(texto).toLowerCase();
}

const ENTIDADES = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', laquo: '«', raquo: '»',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', uuml: 'ü',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú', Ntilde: 'Ñ', Uuml: 'Ü',
  ordm: 'º', ordf: 'ª', deg: '°', iexcl: '¡', iquest: '¿', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', sect: '§',
};

function decodificarEntidades(texto) {
  return texto
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENTIDADES ? ENTIDADES[n] : m));
}

function textoPlano(html) {
  return decodificarEntidades(
    html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ')
  ).replace(/\s+/g, ' ').trim();
}

// Fecha y hora actuales en la Ciudad de México.
function ahoraMexico() {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-MX', {
      timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  return {
    iso: `${partes.year}-${partes.month}-${partes.day}`,
    legible: `${partes.day}/${partes.month}/${partes.year} a las ${partes.hour}:${partes.minute}:${partes.second} (hora del centro de México)`,
    marca: `${partes.year}-${partes.month}-${partes.day} ${partes.hour}:${partes.minute}`,
  };
}

// "dd/mm/aaaa" → "aaaa-mm-dd"
function ddmmaaaaAIso(texto) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(texto || '');
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

function sumarDias(iso, dias) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

async function descargar(url, codificacion = 'utf-8') {
  let ultimoError;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(url, {
        // User-Agent genérico de navegador: no se envía nada que identifique al usuario ni al proyecto.
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36' },
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const bytes = await r.arrayBuffer();
      return new TextDecoder(codificacion).decode(bytes);
    } catch (e) {
      ultimoError = e;
      await esperar(2000 * intento);
    }
  }
  throw new Error(`No se pudo descargar ${url}: ${ultimoError && (ultimoError.cause?.code || ultimoError.message)}`);
}

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function leerCSV(ruta) {
  const contenido = fs.readFileSync(ruta, 'utf8').replace(/^﻿/, '');
  const filas = [];
  let fila = [], campo = '', entreComillas = false;
  for (let i = 0; i < contenido.length; i++) {
    const c = contenido[i];
    if (entreComillas) {
      if (c === '"' && contenido[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') entreComillas = false;
      else campo += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') { fila.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && contenido[i + 1] === '\n') i++;
      fila.push(campo); campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  if (campo !== '' || fila.length) { fila.push(campo); if (fila.some((x) => x !== '')) filas.push(fila); }
  const [encabezado, ...resto] = filas;
  return { encabezado, registros: resto.map((f) => Object.fromEntries(encabezado.map((h, i) => [h, f[i] ?? '']))) };
}

function campoCSV(valor) {
  const s = String(valor ?? '');
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escribirCSV(ruta, encabezado, registros) {
  const lineas = [encabezado.map(campoCSV).join(',')]
    .concat(registros.map((r) => encabezado.map((h) => campoCSV(r[h])).join(',')));
  fs.writeFileSync(ruta, '﻿' + lineas.join('\r\n') + '\r\n', 'utf8');
}

function agregarAlHistorial(filas) {
  if (!filas.length) return;
  if (!fs.existsSync(CSV_HISTORIAL)) {
    fs.writeFileSync(CSV_HISTORIAL, '﻿' + ENCABEZADO_HISTORIAL.map(campoCSV).join(',') + '\r\n', 'utf8');
  }
  const lineas = filas.map((f) => ENCABEZADO_HISTORIAL.map((h) => campoCSV(f[h])).join(',')).join('\r\n');
  fs.appendFileSync(CSV_HISTORIAL, lineas + '\r\n', 'utf8');
}

// ---------------------------------------------------------------------------
// Estado entre corridas
// ---------------------------------------------------------------------------

function leerEstado() {
  if (!fs.existsSync(ARCHIVO_ESTADO)) return null;
  return JSON.parse(fs.readFileSync(ARCHIVO_ESTADO, 'utf8'));
}

function guardarEstado(estado) {
  fs.mkdirSync(CARPETA_ESTADO, { recursive: true });
  fs.writeFileSync(ARCHIVO_ESTADO, JSON.stringify(estado, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Cámara de Diputados
// ---------------------------------------------------------------------------

// Devuelve [{ numero, nombre, publicacion, ultimaReforma (iso o ''), ultimaReformaTexto, avisos, enlace }]
async function leerLeyesVigentesCamara() {
  const html = await descargar(URL_CAMARA + 'index.htm', 'windows-1252');
  const leyes = [];
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celdas = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (celdas.length < 3) continue;
    const numero = textoPlano(celdas[0]);
    if (!/^\d{1,4}$/.test(numero)) continue;
    const enlace = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i.exec(celdas[1]);
    if (!enlace) continue;
    const nombre = textoPlano(enlace[2]);
    const textoCelda = textoPlano(celdas[1]);
    const publicacion = ddmmaaaaAIso(textoCelda);
    const avisos = textoCelda.replace(nombre, '').replace(/DOF \d{2}\/\d{2}\/\d{4}/, '').replace(/\s+/g, ' ').trim();
    const ultimaReformaTexto = textoPlano(celdas[2]);
    const fechas = [...ultimaReformaTexto.matchAll(/\d{2}\/\d{2}\/\d{4}/g)].map((m) => ddmmaaaaAIso(m[0]));
    leyes.push({
      numero, nombre, publicacion,
      ultimaReforma: fechas.length ? fechas.sort().at(-1) : '',
      ultimaReformaTexto, avisos,
      enlace: new URL(enlace[1], URL_CAMARA).href,
    });
  }
  if (leyes.length < 100) throw new Error(`La lista de la Cámara trajo solo ${leyes.length} leyes; la página pudo cambiar de formato.`);
  return leyes;
}

// Busca por nombre oficial. La Cámara a veces agrega el complemento del nombre
// ("LEY de Amparo, Reglamentaria de los artículos 103 y 107 ..."), así que también acepta "<nombre>, ...".
function buscarLeyCamara(porNombre, nombreOficial) {
  const n = normalizar(nombreOficial);
  if (porNombre.has(n)) return porNombre.get(n);
  for (const [k, l] of porNombre) if (k.startsWith(n + ',')) return l;
  return null;
}

// "Actualizaciones <año>": [{ fecha, texto, clave }]
async function leerActualizacionesCamara() {
  const html = await descargar(URL_CAMARA + 'actual/ultima.htm', 'windows-1252');
  const entradas = [];
  let fechaActual = '';
  for (const [, tr] of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celdas = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => textoPlano(m[1]));
    if (celdas.length !== 2) continue;
    const fecha = celdas[0].replace(/\s+/g, '');
    if (/^\d{2}\/[A-Za-z]{3}\/\d{4}$/.test(fecha)) fechaActual = fecha;
    else if (fecha) continue;
    if (!fechaActual || !celdas[1]) continue;
    const texto = celdas[1].replace(/\s+([,.;])/g, '$1');
    entradas.push({ fecha: fechaActual, texto, clave: normalizar(`${fechaActual}|${texto}`) });
  }
  return entradas;
}

const MESES = { ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', oct: '10', nov: '11', dic: '12' };
function fechaCamaraAIso(texto) {
  const m = /^(\d{2})\/([A-Za-z]{3})\/(\d{4})$/.exec(texto);
  return m && MESES[m[2].toLowerCase()] ? `${m[3]}-${MESES[m[2].toLowerCase()]}-${m[1]}` : '';
}

// ---------------------------------------------------------------------------
// DOF
// ---------------------------------------------------------------------------

// Publicaciones de un día (todas las ediciones que el índice enlace): [{ codigo, fecha, edicion, seccion, organismo, titulo, enlace }]
async function leerDOFDelDia(iso) {
  const [a, m, d] = iso.split('-');
  const base = `${URL_DOF}index.php?year=${a}&month=${m}&day=${d}`;
  const principal = await descargar(base);
  const paginas = [{ html: principal, edicion: 'Matutina' }];

  const otras = new Set([...principal.matchAll(/index\.php\?year=\d+&(?:amp;)?month=\d+&(?:amp;)?day=\d+&(?:amp;)?edicion=([A-Z]+)/g)].map((x) => x[1]));
  for (const ed of otras) {
    if (ed === 'MAT') continue;
    await esperar(700);
    paginas.push({ html: await descargar(`${base}&edicion=${ed}`), edicion: ed === 'VES' ? 'Vespertina' : ed === 'EXT' ? 'Extraordinaria' : ed });
  }

  const vistas = new Set();
  const notas = [];
  for (const { html, edicion } of paginas) {
    const nombreEdicion = (/Edici&oacute;n ([A-Za-z]+)/.exec(html) || [])[1] || edicion;
    let seccion = '', organismo = '';
    const patron = /class="txt_blanco2?"[^>]*>([\s\S]*?)<\/td>|class="subtitle_azul"[^>]*>([\s\S]*?)<\/td>|<a href="\/?nota_detalle\.php\?codigo=(\d+)&(?:amp;)?fecha=([\d/]+)"[^>]*>([\s\S]*?)<\/a>/g;
    for (const x of html.matchAll(patron)) {
      if (x[1] !== undefined) { const s = textoPlano(x[1]); if (s) { seccion = s; organismo = ''; } }
      else if (x[2] !== undefined) organismo = textoPlano(x[2]);
      else {
        if (vistas.has(x[3])) continue;
        vistas.add(x[3]);
        notas.push({
          codigo: x[3], fecha: iso, edicion: nombreEdicion, seccion, organismo,
          titulo: textoPlano(x[5]),
          enlace: `${URL_DOF}nota_detalle.php?codigo=${x[3]}&fecha=${x[4]}`,
        });
      }
    }
  }
  return notas;
}

const VERBOS_DE_REFORMA = /\b(reforma[n]?|adiciona[n]?|deroga[n]?|abroga[n]?|expide)\b/;

// ¿Esta publicación del DOF modifica la ley con este nombre oficial?
function decretoModificaLey(titulo, nombreNormalizado) {
  const tituloConMayusculas = sinAcentos(titulo);
  const tituloNormalizado = tituloConMayusculas.toLowerCase();
  if (!/^decreto\b/.test(tituloNormalizado)) return false;
  if (!VERBOS_DE_REFORMA.test(tituloNormalizado)) return false;
  let desde = 0;
  while (true) {
    const i = tituloNormalizado.indexOf(nombreNormalizado, desde);
    if (i < 0) return false;
    const antes = tituloNormalizado.slice(Math.max(0, i - 20), i);
    const despues = tituloNormalizado.charAt(i + nombreNormalizado.length);
    // Evita "Reglamento de la Ley ..." y que el nombre sea solo el principio de otro más largo.
    const esReglamento = /reglamento (de la |del |de )?$/.test(antes);
    const resto = tituloConMayusculas.slice(i + nombreNormalizado.length);
    // "Ley Federal del Trabajo Digital": si sigue otra palabra con mayúscula, es otra ley.
    const siguePalabra = /[a-z0-9]/.test(despues) || /^ [A-Z]/.test(resto);
    if (!esReglamento && !siguePalabra) return true;
    desde = i + 1;
  }
}

// ---------------------------------------------------------------------------
// Principal
// ---------------------------------------------------------------------------

async function main() {
  const ahora = ahoraMexico();
  const hoy = ahora.iso;
  console.log(`Revisión iniciada el ${ahora.legible}`);

  // La copia para el DOF se crea UNA sola vez, como copia exacta de la tabla original.
  if (!fs.existsSync(CSV_COPIA_DOF)) fs.copyFileSync(CSV_ORIGINAL, CSV_COPIA_DOF);

  const original = leerCSV(CSV_ORIGINAL);
  const copia = leerCSV(CSV_COPIA_DOF);
  if (!original.encabezado.includes(COL_PENDIENTE)) original.encabezado.push(COL_PENDIENTE);

  const estadoPrevio = leerEstado();
  const primeraVez = !estadoPrevio;
  const estado = estadoPrevio || { camaraLeyes: null, camaraActualizacionesVistas: [], dofUltimoDia: null, dofCodigosVistos: [] };

  // En la primera corrida se revisa el DOF desde la fecha más antigua en que se actualizó una ley en Artonseley.
  const fechaInicio = original.registros.map((r) => r[COL_ACTUALIZADO]).filter(Boolean).sort()[0] || hoy;

  const bitacora = [];
  const historial = [];
  const marca = ahora.marca;
  bitacora.push(`\n---\n\n## Revisión del ${ahora.legible}\n`);
  if (primeraVez) bitacora.push(`> Primera revisión: se guardó la foto inicial de la Cámara y se revisó el DOF desde el ${fechaInicio}.\n`);
  const posicionResumen = bitacora.length; // aquí se inserta el resumen ⭐ al final de la revisión

  // ---------------- Cámara: lista de leyes vigentes ----------------
  const cambiosArtonseley = [];
  let leyesCamara = null;
  try {
    leyesCamara = await leerLeyesVigentesCamara();
    const porNombre = new Map();
    for (const l of leyesCamara) if (!porNombre.has(normalizar(l.nombre))) porNombre.set(normalizar(l.nombre), l);

    bitacora.push(`### Cámara de Diputados — Leyes Federales Vigentes (${leyesCamara.length} leyes en la lista)\n`);
    const lineas = [];
    if (estado.camaraLeyes) {
      const antes = new Map(estado.camaraLeyes.map((l) => [normalizar(l.nombre), l]));
      const ahoraMapa = new Map(leyesCamara.map((l) => [normalizar(l.nombre), l]));
      for (const [k, l] of ahoraMapa) {
        const p = antes.get(k);
        if (!p) lineas.push(`- **Nueva en la lista:** ${l.nombre} (publicada DOF ${l.publicacion || '¿?'}; última reforma: ${l.ultimaReformaTexto}) — ${l.enlace}`);
        else {
          if (p.ultimaReforma !== l.ultimaReforma || p.ultimaReformaTexto !== l.ultimaReformaTexto) lineas.push(`- **Reforma:** ${l.nombre}: "${p.ultimaReformaTexto}" → "${l.ultimaReformaTexto}" — ${l.enlace}`);
          if (p.avisos !== l.avisos) lineas.push(`- **Aviso cambiado:** ${l.nombre}: "${p.avisos || '(sin aviso)'}" → "${l.avisos || '(sin aviso)'}"`);
        }
      }
      for (const [k, p] of antes) if (!ahoraMapa.has(k)) lineas.push(`- **Salió de la lista de vigentes (posible abrogación):** ${p.nombre}`);
    } else {
      for (const l of leyesCamara) {
        if (l.ultimaReforma && l.ultimaReforma >= fechaInicio) lineas.push(`- Reforma desde el ${fechaInicio}: ${l.nombre} — última reforma ${l.ultimaReformaTexto}${l.avisos ? ` (${l.avisos})` : ''} — ${l.enlace}`);
        else if (l.publicacion && l.publicacion >= fechaInicio) lineas.push(`- Ley nueva desde el ${fechaInicio}: ${l.nombre} (DOF ${l.publicacion}) — ${l.enlace}`);
      }
    }
    const sinNovedad = estado.camaraLeyes ? '- Sin cambios en la lista.\n' : `- Ninguna reforma ni ley nueva desde el ${fechaInicio}.\n`;
    bitacora.push(lineas.length ? lineas.join('\n') + '\n' : sinNovedad);

    // Actualiza el ORIGINAL con lo que dice la Cámara.
    for (const r of original.registros) {
      const l = buscarLeyCamara(porNombre, r[COL_NOMBRE_OFICIAL]);
      if (!l) {
        cambiosArtonseley.push(`- ⚠️ **${r[COL_NOMBRE_OFICIAL]}** no aparece en la lista de vigentes de la Cámara (¿abrogada o cambió de nombre?).`);
        continue;
      }
      if (l.ultimaReforma && l.ultimaReforma !== r[COL_ULTIMA_REFORMA]) {
        historial.push({
          'Fecha de revisión': marca, Fuente: 'Cámara de Diputados', '#': r['#'], Ley: r[COL_NOMBRE_OFICIAL],
          'Reforma anterior': r[COL_ULTIMA_REFORMA] || '(vacío)', 'Reforma nueva': l.ultimaReforma,
          'Archivo modificado': 'leyes_artonseley.csv',
          Detalle: (r[COL_ULTIMA_REFORMA] ? 'Cambió la fecha de última reforma' : 'Registro inicial de la fecha de última reforma') + (l.avisos ? ` — ${l.avisos}` : ''),
          Enlace: l.enlace,
        });
        if (r[COL_ULTIMA_REFORMA]) cambiosArtonseley.push(`- 🔴 **${r[COL_NOMBRE_OFICIAL]}** (Cámara): última reforma ${r[COL_ULTIMA_REFORMA]} → **${l.ultimaReforma}** — ${l.enlace}`);
        r[COL_ULTIMA_REFORMA] = l.ultimaReforma;
      }
    }
    estado.camaraLeyes = leyesCamara.map(({ nombre, publicacion, ultimaReforma, ultimaReformaTexto, avisos }) => ({ nombre, publicacion, ultimaReforma, ultimaReformaTexto, avisos }));
  } catch (e) {
    bitacora.push(`### Cámara de Diputados — Leyes Federales Vigentes\n\n- ❌ No se pudo revisar: ${e.message}\n`);
  }

  // ---------------- Cámara: Actualizaciones del año ----------------
  try {
    const entradas = await leerActualizacionesCamara();
    const vistas = new Set(estado.camaraActualizacionesVistas);
    const nuevas = entradas.filter((x) => !vistas.has(x.clave) && (!primeraVez || fechaCamaraAIso(x.fecha) >= fechaInicio));
    bitacora.push(`### Cámara de Diputados — Actualizaciones recientes\n`);
    bitacora.push(nuevas.length ? nuevas.map((x) => `- ${x.fecha}: ${x.texto}`).join('\n') + '\n' : '- Nada nuevo.\n');
    for (const x of entradas) vistas.add(x.clave);
    estado.camaraActualizacionesVistas = [...vistas];
  } catch (e) {
    bitacora.push(`### Cámara de Diputados — Actualizaciones recientes\n\n- ❌ No se pudo revisar: ${e.message}\n`);
  }

  // ---------------- DOF ----------------
  // Siempre se vuelve a revisar el último día ya revisado (pudo salir una edición vespertina o extraordinaria después).
  let dia = estado.dofUltimoDia || fechaInicio;
  const primerDia = dia;
  const codigosVistos = new Set(estado.dofCodigosVistos);
  const nombresCopia = copia.registros.map((r) => ({ r, n: normalizar(r[COL_NOMBRE_OFICIAL]) }));
  bitacora.push(`### Diario Oficial de la Federación (del ${primerDia} al ${hoy})\n`);
  let diasRevisados = 0;
  let totalNuevas = 0;
  while (dia <= hoy && diasRevisados < MAX_DIAS_DOF_POR_CORRIDA) {
    try {
      const notas = await leerDOFDelDia(dia);
      const nuevas = notas.filter((n) => !codigosVistos.has(n.codigo));
      if (nuevas.length) {
        bitacora.push(`#### DOF ${dia} — ${nuevas.length} publicación(es) nueva(s)\n`);
        let grupo = '';
        for (const n of nuevas) {
          const g = `${n.edicion} · ${n.seccion}${n.organismo ? ' · ' + n.organismo : ''}`;
          if (g !== grupo) { bitacora.push(`\n*${g}*\n`); grupo = g; }
          bitacora.push(`- ${n.titulo} — ${n.enlace}`);

          for (const { r, n: nombre } of nombresCopia) {
            if (!decretoModificaLey(n.titulo, nombre)) continue;
            cambiosArtonseley.push(`- 🟠 **${r[COL_NOMBRE_OFICIAL]}** (DOF ${dia}): ${n.titulo} — ${n.enlace}`);
            if (!r[COL_ULTIMA_REFORMA] || dia > r[COL_ULTIMA_REFORMA]) {
              historial.push({
                'Fecha de revisión': marca, Fuente: 'DOF', '#': r['#'], Ley: r[COL_NOMBRE_OFICIAL],
                'Reforma anterior': r[COL_ULTIMA_REFORMA] || '(vacío)', 'Reforma nueva': dia,
                'Archivo modificado': 'leyes_artonseley_DOF.csv', Detalle: n.titulo, Enlace: n.enlace,
              });
              r[COL_ULTIMA_REFORMA] = dia;
            }
          }
        }
        bitacora.push('');
      }
      for (const n of notas) codigosVistos.add(n.codigo);
      totalNuevas += nuevas.length;
      estado.dofUltimoDia = dia;
    } catch (e) {
      bitacora.push(`- ❌ DOF ${dia}: no se pudo revisar (${e.message}). Se reintentará en la próxima revisión.\n`);
      break;
    }
    diasRevisados++;
    dia = sumarDias(dia, 1);
    await esperar(700);
  }
  if (!totalNuevas) bitacora.push('- Sin publicaciones nuevas.\n');
  if (dia <= hoy && diasRevisados >= MAX_DIAS_DOF_POR_CORRIDA) bitacora.push(`- Quedaron días pendientes (a partir del ${dia}); se revisarán en la próxima corrida.\n`);
  // Solo se guardan los códigos de los últimos ~90 días para que el estado no crezca sin fin (los códigos del DOF son crecientes).
  estado.dofCodigosVistos = [...codigosVistos].map(Number).sort((a, b) => a - b).slice(-6000).map(String);

  // ---------------- "Pendiente de actualizar" (solo en el original) ----------------
  const pendientes = [];
  for (const r of original.registros) {
    const pendiente = r[COL_ULTIMA_REFORMA] && r[COL_ACTUALIZADO] && r[COL_ULTIMA_REFORMA] > r[COL_ACTUALIZADO];
    r[COL_PENDIENTE] = pendiente ? 'Sí' : 'No';
    if (pendiente) pendientes.push(`- ${r[COL_NOMBRE_OFICIAL]}: reformada el ${r[COL_ULTIMA_REFORMA]}, actualizada en Artonseley el ${r[COL_ACTUALIZADO]}`);
  }

  // ---------------- Resumen de nuestras leyes (va primero en la bitácora de esta revisión) ----------------
  const resumen = [`### ⭐ Leyes de Artonseley\n`];
  resumen.push(cambiosArtonseley.length ? cambiosArtonseley.join('\n') + '\n' : '- Ningún cambio detectado en las 32 leyes de Artonseley.\n');
  resumen.push(`**Pendientes de actualizar en Artonseley:** ${pendientes.length ? '\n' + pendientes.join('\n') : 'ninguna.'}\n`);
  bitacora.splice(posicionResumen, 0, ...resumen);

  // ---------------- Guardar ----------------
  escribirCSV(CSV_ORIGINAL, original.encabezado, original.registros);
  escribirCSV(CSV_COPIA_DOF, copia.encabezado, copia.registros);
  agregarAlHistorial(historial);
  if (!fs.existsSync(BITACORA)) {
    fs.writeFileSync(BITACORA, '# Bitácora del DOF y de la Cámara de Diputados\n\nCada revisión se agrega al final con su fecha y hora. Primero van los cambios que tocan a las leyes de Artonseley (⭐); después, todo lo nuevo publicado en la Cámara y en el DOF.\n\n🔴 = detectado por la Cámara (actualiza leyes_artonseley.csv) · 🟠 = detectado en el DOF (actualiza leyes_artonseley_DOF.csv)\n', 'utf8');
  }
  fs.appendFileSync(BITACORA, bitacora.join('\n') + '\n', 'utf8');
  guardarEstado(estado);

  // El .xlsx es solo una vista con formato de los CSV: si falla (p. ej. el archivo está abierto), la revisión sigue valiendo.
  try {
    require('./generarExcel.js').generarExcel();
  } catch (e) {
    console.error(`No se pudo generar leyes_artonseley.xlsx: ${e.message}`);
  }

  console.log(`Revisión terminada el ${ahoraMexico().legible}`);
  console.log(`Cambios en leyes de Artonseley: ${cambiosArtonseley.length} · Filas nuevas en historial: ${historial.length} · Publicaciones nuevas del DOF: ${totalNuevas} · Pendientes de actualizar: ${pendientes.length}`);
}

// Se exporta siempre (lo usan las pruebas y generarExcel.js); la revisión solo corre con `node checarLeyes.js`.
module.exports = { decretoModificaLey, normalizar, leerCSV };
if (require.main === module) main().catch((e) => {
  const ahora = ahoraMexico();
  try {
    fs.appendFileSync(BITACORA, `\n---\n\n## Revisión del ${ahora.legible}\n\n- ❌ La revisión falló: ${e.stack || e.message}\n`, 'utf8');
  } catch { /* nada */ }
  console.error(e);
  process.exit(1);
});
