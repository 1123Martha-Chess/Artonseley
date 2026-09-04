// almacenamientoCalendario.js
// -------------------------------------------------------------------
// Capa de persistencia del Calendario: IndexedDB, guardando SOLO blobs
// cifrados — nunca texto plano (ver bovedaCalendario.js, que cifra y
// descifra antes de llamar aquí). Misma idea que
// almacenamientoCifradoIndexedDB.js (el de "Mis cuadernos"), pero en una
// BASE DE DATOS APARTE: `artonseley_calendario::<correo>`. Así, borrar o
// restablecer la bóveda de los cuadernos no toca nada del calendario, y
// al revés.
//
// Tres object stores, todos dentro de la base por cuenta:
//   - "configuracion": un solo registro con la sal de la bóveda del
//     calendario y su "verificador" (texto conocido cifrado) — sirve
//     para avisar rápido "esa frase está mal".
//   - "eventos": un registro cifrado por cada nota del calendario.
//   - "dias": un registro cifrado por cada día al que el usuario le puso
//     un color.
// -------------------------------------------------------------------

const VERSION_BASE_DE_DATOS = 1;
const ALMACEN_CONFIGURACION = 'configuracion';
const ALMACEN_EVENTOS = 'eventos';
const ALMACEN_DIAS = 'dias';

let bdAbierta = null;
let nombreBdActual = null;

function abrirConexion(nombreBaseDeDatos) {
  return new Promise((resolve, reject) => {
    const solicitud = indexedDB.open(nombreBaseDeDatos, VERSION_BASE_DE_DATOS);

    solicitud.onupgradeneeded = () => {
      const bd = solicitud.result;
      if (!bd.objectStoreNames.contains(ALMACEN_CONFIGURACION)) {
        bd.createObjectStore(ALMACEN_CONFIGURACION, { keyPath: 'clave' });
      }
      if (!bd.objectStoreNames.contains(ALMACEN_EVENTOS)) {
        bd.createObjectStore(ALMACEN_EVENTOS, { keyPath: 'id' });
      }
      if (!bd.objectStoreNames.contains(ALMACEN_DIAS)) {
        bd.createObjectStore(ALMACEN_DIAS, { keyPath: 'id' });
      }
    };

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

export async function inicializarAlmacenamientoCalendario(usuarioEmail) {
  const nombreBaseDeDatos = `artonseley_calendario::${usuarioEmail}`;
  if (bdAbierta && nombreBdActual === nombreBaseDeDatos) return;
  bdAbierta = await abrirConexion(nombreBaseDeDatos);
  nombreBdActual = nombreBaseDeDatos;
}

function transaccion(almacen, modo) {
  if (!bdAbierta) {
    throw new Error('almacenamientoCalendario.js: llama primero a inicializarAlmacenamientoCalendario().');
  }
  return bdAbierta.transaction(almacen, modo).objectStore(almacen);
}

function promesaDeSolicitud(solicitud) {
  return new Promise((resolve, reject) => {
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// ---- Configuración de la bóveda (sal + verificador) ----

export function obtenerConfiguracionVaultCalendario() {
  return promesaDeSolicitud(transaccion(ALMACEN_CONFIGURACION, 'readonly').get('vault'));
}

export function guardarConfiguracionVaultCalendario(configuracion) {
  return promesaDeSolicitud(
    transaccion(ALMACEN_CONFIGURACION, 'readwrite').put({ clave: 'vault', ...configuracion })
  );
}

// Borra TODO el contenido de la bóveda del calendario de ESTE navegador
// (configuración + eventos + días), en una sola transacción. Se usa
// cuando el usuario perdió su frase y elige empezar de cero.
export function borrarContenidoVaultCalendario() {
  if (!bdAbierta) {
    return Promise.reject(new Error('almacenamientoCalendario.js: llama primero a inicializarAlmacenamientoCalendario().'));
  }
  return new Promise((resolve, reject) => {
    const tx = bdAbierta.transaction([ALMACEN_CONFIGURACION, ALMACEN_EVENTOS, ALMACEN_DIAS], 'readwrite');
    tx.objectStore(ALMACEN_CONFIGURACION).clear();
    tx.objectStore(ALMACEN_EVENTOS).clear();
    tx.objectStore(ALMACEN_DIAS).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// ---- Eventos (notas del calendario) ----

export function listarEventosCifrados() {
  return promesaDeSolicitud(transaccion(ALMACEN_EVENTOS, 'readonly').getAll());
}

export function guardarEventoCifrado(registro) {
  return promesaDeSolicitud(transaccion(ALMACEN_EVENTOS, 'readwrite').put(registro));
}

export function eliminarEventoCifrado(id) {
  return promesaDeSolicitud(transaccion(ALMACEN_EVENTOS, 'readwrite').delete(id));
}

// ---- Días con color ----

export function listarDiasCifrados() {
  return promesaDeSolicitud(transaccion(ALMACEN_DIAS, 'readonly').getAll());
}

export function guardarDiaCifrado(registro) {
  return promesaDeSolicitud(transaccion(ALMACEN_DIAS, 'readwrite').put(registro));
}

export function eliminarDiaCifrado(id) {
  return promesaDeSolicitud(transaccion(ALMACEN_DIAS, 'readwrite').delete(id));
}
