// almacenamientoCifradoIndexedDB.js
// -------------------------------------------------------------------
// Capa de persistencia de "Mis cuadernos": IndexedDB, guardando SOLO
// blobs cifrados — nunca texto plano (ver manejaBovedaCifrada.js, que
// es quien de verdad cifra/descifra antes de llamar a este archivo).
// Este módulo no sabe qué hay adentro de "iv"/"ciphertext"; solo los
// guarda y los regresa tal cual. Así, aunque alguien abra las
// herramientas de desarrollador y mire la base de datos directamente,
// no ve nada legible — ni siquiera los nombres de los cuadernos.
//
// Hay 3 almacenes (object stores), todos dentro de una base de datos
// por cuenta (para que, si dos personas usan la misma computadora, no
// compartan bóveda):
//   - "configuracion": un solo registro con la sal de la bóveda y un
//     "verificador" (un texto conocido cifrado con la llave de la
//     bóveda) — sirve para avisar rápido "esa frase está mal" sin
//     tener que intentar descifrar un cuaderno de verdad.
//   - "cuadernos" y "notas": un registro cifrado por cada uno.
// -------------------------------------------------------------------

const VERSION_BASE_DE_DATOS = 1;
const ALMACEN_CONFIGURACION = 'configuracion';
const ALMACEN_CUADERNOS = 'cuadernos';
const ALMACEN_NOTAS = 'notas';

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
      if (!bd.objectStoreNames.contains(ALMACEN_CUADERNOS)) {
        bd.createObjectStore(ALMACEN_CUADERNOS, { keyPath: 'id' });
      }
      if (!bd.objectStoreNames.contains(ALMACEN_NOTAS)) {
        bd.createObjectStore(ALMACEN_NOTAS, { keyPath: 'id' });
      }
    };

    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

// usuarioEmail: cada cuenta tiene su propia base de datos (mismo
// namespacing por correo que ya se usaba con localStorage en el diseño
// anterior), para que dos personas en la misma computadora no
// compartan bóveda.
export async function inicializarAlmacenamiento(usuarioEmail) {
  const nombreBaseDeDatos = `artonseley_boveda::${usuarioEmail}`;
  if (bdAbierta && nombreBdActual === nombreBaseDeDatos) return;
  bdAbierta = await abrirConexion(nombreBaseDeDatos);
  nombreBdActual = nombreBaseDeDatos;
}

function transaccion(almacen, modo) {
  if (!bdAbierta) {
    throw new Error('almacenamientoCifradoIndexedDB.js: llama primero a inicializarAlmacenamiento().');
  }
  return bdAbierta.transaction(almacen, modo).objectStore(almacen);
}

function promesaDeSolicitud(solicitud) {
  return new Promise((resolve, reject) => {
    solicitud.onsuccess = () => resolve(solicitud.result);
    solicitud.onerror = () => reject(solicitud.error);
  });
}

export function obtenerConfiguracionVault() {
  return promesaDeSolicitud(transaccion(ALMACEN_CONFIGURACION, 'readonly').get('vault'));
}

export function guardarConfiguracionVault(configuracion) {
  return promesaDeSolicitud(
    transaccion(ALMACEN_CONFIGURACION, 'readwrite').put({ clave: 'vault', ...configuracion })
  );
}

export function listarCuadernosCifrados() {
  return promesaDeSolicitud(transaccion(ALMACEN_CUADERNOS, 'readonly').getAll());
}

export function guardarCuadernoCifrado(registro) {
  return promesaDeSolicitud(transaccion(ALMACEN_CUADERNOS, 'readwrite').put(registro));
}

export function eliminarCuadernoCifrado(id) {
  return promesaDeSolicitud(transaccion(ALMACEN_CUADERNOS, 'readwrite').delete(id));
}

export function contarCuadernos() {
  return promesaDeSolicitud(transaccion(ALMACEN_CUADERNOS, 'readonly').count());
}

export function listarNotasCifradas() {
  return promesaDeSolicitud(transaccion(ALMACEN_NOTAS, 'readonly').getAll());
}

export function guardarNotaCifrada(registro) {
  return promesaDeSolicitud(transaccion(ALMACEN_NOTAS, 'readwrite').put(registro));
}

export function eliminarNotaCifrada(id) {
  return promesaDeSolicitud(transaccion(ALMACEN_NOTAS, 'readwrite').delete(id));
}
