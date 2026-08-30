// manejaBovedaCifrada.js
// -------------------------------------------------------------------
// Orquesta la seguridad de "Mis cuadernos": detecta modo incógnito,
// crea o desbloquea la bóveda cifrada (frase de recuperación BIP-39 +
// AES-256 vía criptografiaCuadernos.js), y expone
// cifrarObjeto()/descifrarObjeto() para que manejaCuadernos.js y
// manejaNotas.js guarden todo cifrado sin tener que saber nada de
// criptografía ellos mismos.
//
// La llave de la bóveda vive en memoria mientras dura esta pestaña. La
// SEMILLA de la que sale (ver criptografiaCuadernos.js) además se
// guarda en localStorage — así, la frase de recuperación solo se pide
// UNA VEZ, la primera vez que se usa "Mis cuadernos" en cada
// dispositivo: cerrar la pestaña, cerrar el navegador por completo, o
// hasta reiniciar la compu no la vuelve a pedir. Cada vez que se entra,
// esa semilla guardada se verifica de nuevo contra el "verificador"
// cifrado (AES-256-GCM) antes de confiar en ella — si alguien la
// alterara a mano, el desbloqueo automático simplemente fallaría y
// pediría la frase real.
//
// Esto sigue siendo "cero-conocimiento" en el sentido de que ni
// Artonseley ni nadie con acceso solo al SERVIDOR puede leer un
// cuaderno (la semilla nunca se manda a ningún lado, ni vive en una
// cookie). El trato que sí cambia: quien tenga acceso a ESTE
// NAVEGADOR/dispositivo (otra persona con la misma cuenta de Windows,
// por ejemplo) podría abrir los cuadernos sin escribir la frase,
// mientras esa semilla siga guardada aquí. Para una computadora
// compartida o pública, está el botón "Olvidar en este dispositivo"
// (ver editor.html, junto a "Importar documento" — llama a
// olvidarEnEsteDispositivo() más abajo): borra la semilla guardada y
// vuelve a pedir la frase completa la próxima vez.
// -------------------------------------------------------------------

import { estaEnNavegacionPrivada } from './deteccionIncognito.js';
import { inicializarAlmacenamiento, obtenerConfiguracionVault, guardarConfiguracionVault } from './almacenamientoCifradoIndexedDB.js';
import {
  generarFraseDeRecuperacion,
  fraseEsValida,
  elegirPosicionesParaVerificar,
  derivarSemillaDesdeFrase,
  derivarClaveDesdeSemilla,
  generarSalAleatoria,
  cifrarTexto,
  descifrarTexto,
  arrayBufferABase64,
  base64AArrayBuffer
} from './criptografiaCuadernos.js';

// Texto fijo que se cifra al crear la bóveda: si al desbloquear se
// descifra y da EXACTAMENTE esto, la frase es la correcta — así se
// puede avisar "frase incorrecta" de inmediato, sin tener que intentar
// descifrar un cuaderno de verdad primero.
const TEXTO_VERIFICADOR = 'ARTONSELEY_BOVEDA_OK';
const VERSION_ARCHIVO_ARTON = 1;

let claveVaultEnMemoria = null;
let semillaEnMemoria = null;
let elementos = null;
let usuarioEmailActual = null;
let configuracionVaultActual = null;
let alDesbloquearActual = null;

// idPantalla: el contenedor que tapa todo hasta que la bóveda queda
// lista. idsVistas: { incognito, cargando, configuracion, verificacion,
// desbloqueo } — el id de cada sub-vista dentro de esa pantalla.
// alDesbloquear: función que se llama una vez que la bóveda queda
// desbloqueada (para que editorPrincipal.js siga con lo suyo).
export async function inicializarBoveda(usuarioEmail, idPantalla, idsVistas, alDesbloquear) {
  usuarioEmailActual = usuarioEmail;
  alDesbloquearActual = alDesbloquear;
  elementos = {
    pantalla: document.getElementById(idPantalla),
    vistas: Object.fromEntries(Object.entries(idsVistas).map(([clave, id]) => [clave, document.getElementById(id)]))
  };

  if (!elementos.pantalla || Object.values(elementos.vistas).some((v) => !v)) {
    console.error('manejaBovedaCifrada.js: faltan elementos en el HTML — revisa los ids pasados a inicializarBoveda().');
    return;
  }

  mostrarVista('cargando');

  if (await estaEnNavegacionPrivada()) {
    mostrarVista('incognito');
    return;
  }

  await inicializarAlmacenamiento(usuarioEmail);
  configuracionVaultActual = await obtenerConfiguracionVault();

  if (configuracionVaultActual) {
    // Si ya se desbloqueó antes en este dispositivo (la semilla quedó
    // guardada en localStorage, ver guardarSemillaEnDispositivo), se
    // desbloquea solo, sin volver a pedir la frase — ni siquiera hace
    // falta que sea la misma pestaña: sigue funcionando aunque se haya
    // cerrado el navegador por completo y se vuelva a entrar después.
    const semillaGuardada = obtenerSemillaDelDispositivo();
    if (semillaGuardada && (await intentarDesbloquearConSemilla(semillaGuardada, configuracionVaultActual))) {
      ocultarPantallaBoveda();
      alDesbloquear?.();
      return;
    }
    if (semillaGuardada) borrarSemillaDelDispositivo(); // ya no sirve (ej. se restableció la bóveda) — no seguir intentando en vano

    mostrarPantallaDesbloqueo(configuracionVaultActual, alDesbloquear);
  } else {
    await mostrarPantallaConfiguracionInicial(alDesbloquear);
  }
}

// ========================= Recordar el desbloqueo en este dispositivo =========================
// Se guarda en localStorage (no sessionStorage): sobrevive a cerrar la
// pestaña Y el navegador — solo se pide la frase la primera vez que se
// usa "Mis cuadernos" en cada dispositivo, tal como se pidió. El
// "costo" de esto: quien tenga acceso a los archivos de ESTE navegador
// (ej. otra persona usando la misma cuenta de Windows, o malware en
// esta compu) podría abrir los cuadernos sin la frase, mientras no se
// use "Olvidar en este dispositivo" — por eso ese botón existe (ver
// editor.html, junto a "Importar documento"), pensado para computadoras
// compartidas o públicas. Namespacing por correo, igual que el resto
// del almacenamiento, para que dos cuentas en el mismo navegador no se
// mezclen.

function claveDispositivo() {
  return `artonseley::boveda_semilla_dispositivo::${usuarioEmailActual}`;
}

function guardarSemillaEnDispositivo(semilla) {
  try {
    localStorage.setItem(claveDispositivo(), arrayBufferABase64(semilla));
  } catch {
    // Si localStorage no está disponible, simplemente se volverá a
    // pedir la frase la próxima vez — no es motivo para interrumpir el
    // desbloqueo actual.
  }
}

function obtenerSemillaDelDispositivo() {
  try {
    const guardada = localStorage.getItem(claveDispositivo());
    return guardada ? base64AArrayBuffer(guardada) : null;
  } catch {
    return null;
  }
}

function borrarSemillaDelDispositivo() {
  try {
    localStorage.removeItem(claveDispositivo());
  } catch {
    // nada que hacer
  }
}

// Botón "Olvidar en este dispositivo" (ver editor.html): borra la
// semilla guardada y vuelve a tapar la pantalla pidiendo la frase de
// nuevo — para cuando se usó "Mis cuadernos" en una computadora
// compartida/pública y no se quiere dejar rastro.
export function olvidarEnEsteDispositivo() {
  borrarSemillaDelDispositivo();
  semillaEnMemoria = null;
  claveVaultEnMemoria = null;
  if (elementos && configuracionVaultActual) {
    elementos.pantalla.hidden = false;
    mostrarPantallaDesbloqueo(configuracionVaultActual, alDesbloquearActual);
  }
}

// Intenta desbloquear con una semilla ya derivada (de localStorage, o
// recién calculada de una frase escrita a mano) contra la configuración
// guardada de la bóveda. Si el verificador no cuadra, deja
// claveVaultEnMemoria/semillaEnMemoria tal como estaban (sin
// desbloquear) y regresa false.
async function intentarDesbloquearConSemilla(semilla, configuracion) {
  try {
    const salVault = base64AArrayBuffer(configuracion.salVault);
    const claveVault = await derivarClaveDesdeSemilla(semilla, salVault);
    const textoVerificado = await descifrarTexto(claveVault, configuracion.verificadorIv, configuracion.verificadorCiphertext);
    if (textoVerificado !== TEXTO_VERIFICADOR) return false;

    semillaEnMemoria = semilla;
    claveVaultEnMemoria = claveVault;
    return true;
  } catch {
    return false;
  }
}

function mostrarVista(nombre) {
  Object.entries(elementos.vistas).forEach(([clave, elemento]) => {
    elemento.hidden = clave !== nombre;
  });
}

function ocultarPantallaBoveda() {
  elementos.pantalla.hidden = true;
}

// ========================= Configuración inicial (primera vez) =========================

async function mostrarPantallaConfiguracionInicial(alDesbloquear) {
  mostrarVista('configuracion');
  const vista = elementos.vistas.configuracion;
  vista.innerHTML = '';

  const frase = await generarFraseDeRecuperacion();

  const titulo = document.createElement('h2');
  titulo.textContent = 'Crea tu frase de recuperación';
  vista.appendChild(titulo);

  const explicacion = document.createElement('p');
  explicacion.textContent =
    'Estas 12 palabras son la ÚNICA forma de abrir tus cuadernos si cambias de computadora, o si se borran los datos de este navegador. Apúntalas en papel, EN ESTE ORDEN, y guárdalas en un lugar seguro. Nadie más las tiene — ni siquiera Artonseley puede recuperarlas por ti si las pierdes.';
  vista.appendChild(explicacion);

  const cuadricula = document.createElement('div');
  cuadricula.classList.add('cuadricula-palabras');
  frase.forEach((palabra, indice) => {
    const chip = document.createElement('div');
    chip.classList.add('chip-palabra');
    const numero = document.createElement('span');
    numero.classList.add('numero-palabra');
    numero.textContent = String(indice + 1);
    chip.appendChild(numero);
    chip.append(palabra);
    cuadricula.appendChild(chip);
  });
  vista.appendChild(cuadricula);

  const etiquetaConfirmar = document.createElement('label');
  etiquetaConfirmar.classList.add('confirmacion-anotado');
  const checkConfirmar = document.createElement('input');
  checkConfirmar.type = 'checkbox';
  etiquetaConfirmar.appendChild(checkConfirmar);
  etiquetaConfirmar.append(' Ya anoté mis 12 palabras en un lugar seguro.');
  vista.appendChild(etiquetaConfirmar);

  const botonContinuar = document.createElement('button');
  botonContinuar.type = 'button';
  botonContinuar.classList.add('boton-boveda-principal');
  botonContinuar.textContent = 'Continuar';
  botonContinuar.disabled = true;
  checkConfirmar.addEventListener('change', () => {
    botonContinuar.disabled = !checkConfirmar.checked;
  });
  botonContinuar.addEventListener('click', () => mostrarPantallaVerificacion(frase, alDesbloquear));
  vista.appendChild(botonContinuar);
}

// ========================= Verificación por muestreo (3 palabras) =========================

function mostrarPantallaVerificacion(frase, alDesbloquear) {
  mostrarVista('verificacion');
  const vista = elementos.vistas.verificacion;
  vista.innerHTML = '';

  // 3 posiciones al azar cada vez que se entra aquí — si el usuario se
  // equivoca y vuelve a intentar, no memoriza cuáles preguntan.
  const posiciones = elegirPosicionesParaVerificar(12, 3);

  const titulo = document.createElement('h2');
  titulo.textContent = 'Confirma que la anotaste bien';
  vista.appendChild(titulo);

  const explicacion = document.createElement('p');
  explicacion.textContent = 'Escribe las palabras que van en estas posiciones de tu frase:';
  vista.appendChild(explicacion);

  const filaCampos = document.createElement('div');
  filaCampos.classList.add('fila-campos-verificacion');

  const camposEntrada = posiciones.map((posicion) => {
    const contenedor = document.createElement('div');
    contenedor.classList.add('campo-verificacion');

    const etiqueta = document.createElement('label');
    etiqueta.textContent = `Palabra #${posicion}`;
    contenedor.appendChild(etiqueta);

    const entrada = document.createElement('input');
    entrada.type = 'text';
    entrada.autocomplete = 'off';
    entrada.autocapitalize = 'off';
    entrada.spellcheck = false;
    contenedor.appendChild(entrada);

    filaCampos.appendChild(contenedor);
    return { posicion, entrada };
  });
  vista.appendChild(filaCampos);

  const mensajeError = document.createElement('p');
  mensajeError.classList.add('mensaje-error-boveda');
  vista.appendChild(mensajeError);

  const filaBotones = document.createElement('div');
  filaBotones.classList.add('fila-botones-boveda');

  const botonVolver = document.createElement('button');
  botonVolver.type = 'button';
  botonVolver.classList.add('boton-boveda-secundario');
  botonVolver.textContent = '← Ver las palabras otra vez';
  botonVolver.addEventListener('click', () => mostrarPantallaConfiguracionInicial(alDesbloquear));
  filaBotones.appendChild(botonVolver);

  const botonConfirmar = document.createElement('button');
  botonConfirmar.type = 'button';
  botonConfirmar.classList.add('boton-boveda-principal');
  botonConfirmar.textContent = 'Confirmar y activar mis cuadernos';
  botonConfirmar.addEventListener('click', async () => {
    // "normalize('NFKD')" en los dos lados es obligatorio, no cosmético:
    // la lista oficial de palabras en español guarda las tildes en
    // Unicode "descompuesto", pero teclear una tilde a mano casi
    // siempre produce la forma "compuesta" — se ven idénticas pero son
    // cadenas de texto distintas en JavaScript sin esto (ver el
    // comentario grande en criptografiaCuadernos.js).
    const todasCorrectas = camposEntrada.every(
      ({ posicion, entrada }) =>
        entrada.value.trim().normalize('NFKD').toLowerCase() === frase[posicion - 1].normalize('NFKD').toLowerCase()
    );
    if (!todasCorrectas) {
      mensajeError.textContent = 'Una o más palabras no coinciden. Revisa tu anotación e inténtalo de nuevo.';
      return;
    }
    botonConfirmar.disabled = true;
    try {
      await activarBovedaNueva(frase, alDesbloquear);
    } catch (error) {
      console.error('manejaBovedaCifrada.js: error al activar la bóveda:', error);
      mensajeError.textContent = 'No se pudo activar la bóveda. Intenta de nuevo.';
      botonConfirmar.disabled = false;
    }
  });
  filaBotones.appendChild(botonConfirmar);

  vista.appendChild(filaBotones);
}

async function activarBovedaNueva(frase, alDesbloquear) {
  const semilla = await derivarSemillaDesdeFrase(frase);
  const salVault = generarSalAleatoria();
  const claveVault = await derivarClaveDesdeSemilla(semilla, salVault);
  const verificador = await cifrarTexto(claveVault, TEXTO_VERIFICADOR);

  const configuracion = {
    salVault: arrayBufferABase64(salVault),
    verificadorIv: verificador.iv,
    verificadorCiphertext: verificador.ciphertext,
    creadoEn: new Date().toISOString()
  };
  await guardarConfiguracionVault(configuracion);
  configuracionVaultActual = configuracion;

  semillaEnMemoria = semilla;
  claveVaultEnMemoria = claveVault;
  guardarSemillaEnDispositivo(semilla);
  ocultarPantallaBoveda();
  alDesbloquear?.();
}

// ========================= Desbloqueo (ya existe una bóveda) =========================

function mostrarPantallaDesbloqueo(configuracion, alDesbloquear) {
  mostrarVista('desbloqueo');
  const vista = elementos.vistas.desbloqueo;
  vista.innerHTML = '';

  const titulo = document.createElement('h2');
  titulo.textContent = 'Desbloquea tus cuadernos';
  vista.appendChild(titulo);

  const explicacion = document.createElement('p');
  explicacion.textContent = 'Escribe tus 12 palabras de recuperación, separadas por espacios.';
  vista.appendChild(explicacion);

  const areaTexto = document.createElement('textarea');
  areaTexto.rows = 3;
  areaTexto.classList.add('area-frase-desbloqueo');
  areaTexto.placeholder = 'palabra1 palabra2 palabra3 ... palabra12';
  areaTexto.autocomplete = 'off';
  areaTexto.spellcheck = false;
  vista.appendChild(areaTexto);

  const mensajeError = document.createElement('p');
  mensajeError.classList.add('mensaje-error-boveda');
  vista.appendChild(mensajeError);

  const botonDesbloquear = document.createElement('button');
  botonDesbloquear.type = 'button';
  botonDesbloquear.classList.add('boton-boveda-principal');
  botonDesbloquear.textContent = 'Desbloquear';
  botonDesbloquear.addEventListener('click', () => intentarDesbloquear(areaTexto, mensajeError, botonDesbloquear, configuracion, alDesbloquear));
  areaTexto.addEventListener('keydown', (evento) => {
    if (evento.key === 'Enter' && (evento.ctrlKey || evento.metaKey)) {
      intentarDesbloquear(areaTexto, mensajeError, botonDesbloquear, configuracion, alDesbloquear);
    }
  });
  vista.appendChild(botonDesbloquear);
}

async function intentarDesbloquear(areaTexto, mensajeError, botonDesbloquear, configuracion, alDesbloquear) {
  mensajeError.textContent = '';
  botonDesbloquear.disabled = true;
  try {
    const frase = areaTexto.value.trim().toLowerCase().split(/\s+/).filter(Boolean);

    if (!(await fraseEsValida(frase))) {
      mensajeError.textContent = 'Esa frase no es válida: revisa que sean 12 palabras, bien escritas y en orden.';
      return;
    }

    const semilla = await derivarSemillaDesdeFrase(frase);
    if (!(await intentarDesbloquearConSemilla(semilla, configuracion))) {
      mensajeError.textContent = 'Frase incorrecta. Revisa las 12 palabras e inténtalo de nuevo.';
      return;
    }

    // Para no volver a pedirla nunca más en este dispositivo (salvo que
    // se use "Olvidar en este dispositivo") — ver el comentario grande
    // junto a guardarSemillaEnDispositivo más arriba.
    guardarSemillaEnDispositivo(semilla);
    ocultarPantallaBoveda();
    alDesbloquear?.();
  } finally {
    botonDesbloquear.disabled = false;
  }
}

// ========================= Cifrar/descifrar para manejaCuadernos.js y manejaNotas.js =========================

export function bovedaEstaDesbloqueada() {
  return !!claveVaultEnMemoria;
}

export async function cifrarObjeto(objeto) {
  if (!claveVaultEnMemoria) throw new Error('manejaBovedaCifrada.js: la bóveda no está desbloqueada.');
  return cifrarTexto(claveVaultEnMemoria, JSON.stringify(objeto));
}

export async function descifrarObjeto(registro) {
  if (!claveVaultEnMemoria) throw new Error('manejaBovedaCifrada.js: la bóveda no está desbloqueada.');
  const texto = await descifrarTexto(claveVaultEnMemoria, registro.iv, registro.ciphertext);
  return JSON.parse(texto);
}

// ========================= Respaldo completo cifrado (.arton) =========================
// Distinto del "Exportar (.txt)" de un cuaderno individual (ver
// formatoTextoPlano.js): esto es una copia de seguridad de TODOS los
// cuadernos y notas de una sola vez, cifrada de nuevo con una sal
// propia — solo se puede volver a abrir con la frase de recuperación.

// datosCompletos: { cuadernos: [...], notas: [...] } ya descifrados en
// memoria (ver manejaCuadernos.js/manejaNotas.js). Reutiliza la semilla
// que ya quedó en memoria al desbloquear (no hace falta volver a pedir
// la frase: la pestaña ya está desbloqueada y es de confianza), pero
// con una SAL NUEVA — así cada respaldo exportado usa una llave propia,
// aunque salga de la misma frase.
export async function exportarRespaldoArton(datosCompletos) {
  if (!semillaEnMemoria) throw new Error('manejaBovedaCifrada.js: la bóveda no está desbloqueada.');

  const sal = generarSalAleatoria();
  const clave = await derivarClaveDesdeSemilla(semillaEnMemoria, sal);
  const { iv, ciphertext } = await cifrarTexto(clave, JSON.stringify(datosCompletos));

  const archivo = {
    version: VERSION_ARCHIVO_ARTON,
    app: 'artonseley',
    tipo: 'respaldo-cuadernos',
    salt: arrayBufferABase64(sal),
    iv,
    ciphertext,
    creadoEn: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(archivo, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `artonseley-respaldo-${new Date().toISOString().slice(0, 10)}.arton`;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

// Regresa { cuadernos, notas } ya descifrados — quien llama (ver
// editorPrincipal.js) decide cómo mezclarlos con lo que ya hay.
export async function importarRespaldoArton(archivoTexto, frase) {
  let archivo;
  try {
    archivo = JSON.parse(archivoTexto);
  } catch {
    throw new Error('Ese archivo no es un respaldo .arton válido (no es JSON legible).');
  }

  if (archivo.tipo !== 'respaldo-cuadernos' || !archivo.salt || !archivo.iv || !archivo.ciphertext) {
    throw new Error('Ese archivo no es un respaldo .arton de Artonseley.');
  }
  if (!(await fraseEsValida(frase))) {
    throw new Error('Esa frase no es válida: revisa que sean 12 palabras, bien escritas y en orden.');
  }

  const semilla = await derivarSemillaDesdeFrase(frase);
  const sal = base64AArrayBuffer(archivo.salt);
  const clave = await derivarClaveDesdeSemilla(semilla, sal);
  const textoPlano = await descifrarTexto(clave, archivo.iv, archivo.ciphertext);
  return JSON.parse(textoPlano);
}
