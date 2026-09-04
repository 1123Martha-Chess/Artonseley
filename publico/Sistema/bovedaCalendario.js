// bovedaCalendario.js
// -------------------------------------------------------------------
// La bóveda cifrada del Calendario. Es la misma tecnología que la de
// "Mis cuadernos" (frase de recuperación BIP-39 de 12 palabras +
// AES-256-GCM, ver criptografiaCuadernos.js, que aquí se reutiliza tal
// cual), pero es una bóveda TOTALMENTE INDEPENDIENTE:
//
//   - Su propia frase de recuperación de 12 palabras (distinta de la de
//     los cuadernos).
//   - Su propia base de datos IndexedDB (ver almacenamientoCalendario.js).
//   - Su propia "semilla recordada en este dispositivo" en localStorage.
//
// Consecuencia: borrar o restablecer la bóveda de los cuadernos no toca
// el calendario, y al revés. El costo es que el usuario tiene que
// guardar dos frases distintas.
//
// La llave vive en memoria mientras dura la pestaña. La SEMILLA se
// guarda en localStorage (namespacing por correo) para no volver a pedir
// la frase en cada visita a este dispositivo. Sigue siendo
// cero-conocimiento: la frase y la semilla nunca salen del navegador.
// -------------------------------------------------------------------

import { estaEnNavegacionPrivada } from './deteccionIncognito.js';
import {
  inicializarAlmacenamientoCalendario,
  obtenerConfiguracionVaultCalendario,
  guardarConfiguracionVaultCalendario,
  borrarContenidoVaultCalendario
} from './almacenamientoCalendario.js';
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

const TEXTO_VERIFICADOR = 'ARTONSELEY_CALENDARIO_OK';

let claveVaultEnMemoria = null;
let elementos = null;
let usuarioEmailActual = null;
let configuracionVaultActual = null;
let alDesbloquearActual = null;

// idsVistas: { cargando, incognito, configuracion, verificacion, desbloqueo }
export async function inicializarBovedaCalendario(usuarioEmail, idPantalla, idsVistas, alDesbloquear) {
  usuarioEmailActual = usuarioEmail;
  alDesbloquearActual = alDesbloquear;
  elementos = {
    pantalla: document.getElementById(idPantalla),
    vistas: Object.fromEntries(Object.entries(idsVistas).map(([clave, id]) => [clave, document.getElementById(id)]))
  };

  if (!elementos.pantalla || Object.values(elementos.vistas).some((v) => !v)) {
    console.error('bovedaCalendario.js: faltan elementos en el HTML — revisa los ids pasados a inicializarBovedaCalendario().');
    return;
  }

  mostrarVista('cargando');

  if (await estaEnNavegacionPrivada()) {
    mostrarVista('incognito');
    return;
  }

  await inicializarAlmacenamientoCalendario(usuarioEmail);
  configuracionVaultActual = await obtenerConfiguracionVaultCalendario();

  if (configuracionVaultActual) {
    const semillaGuardada = obtenerSemillaDelDispositivo();
    if (semillaGuardada && (await intentarDesbloquearConSemilla(semillaGuardada, configuracionVaultActual))) {
      ocultarPantallaBoveda();
      alDesbloquear?.();
      return;
    }
    if (semillaGuardada) borrarSemillaDelDispositivo();
    mostrarPantallaDesbloqueo(configuracionVaultActual, alDesbloquear);
  } else {
    await mostrarPantallaConfiguracionInicial(alDesbloquear);
  }
}

// ========================= Recordar el desbloqueo en este dispositivo =========================

function claveDispositivo() {
  return `artonseley::calendario_semilla_dispositivo::${usuarioEmailActual}`;
}

function guardarSemillaEnDispositivo(semilla) {
  try {
    localStorage.setItem(claveDispositivo(), arrayBufferABase64(semilla));
  } catch {
    // Sin localStorage, se volverá a pedir la frase la próxima vez.
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

export function olvidarCalendarioEnEsteDispositivo() {
  borrarSemillaDelDispositivo();
  claveVaultEnMemoria = null;
  if (elementos && configuracionVaultActual) {
    elementos.pantalla.hidden = false;
    mostrarPantallaDesbloqueo(configuracionVaultActual, alDesbloquearActual);
  }
}

// ========================= Salida cuando se perdió la frase =========================

async function restablecerBovedaYCrearFraseNueva() {
  await borrarContenidoVaultCalendario();
  borrarSemillaDelDispositivo();
  claveVaultEnMemoria = null;
  configuracionVaultActual = null;
  elementos.pantalla.hidden = false;
  await mostrarPantallaConfiguracionInicial(alDesbloquearActual);
}

function agregarSalidaFrasePerdida(vista, contexto) {
  const bloque = document.createElement('details');
  bloque.classList.add('salida-frase-perdida');

  const resumen = document.createElement('summary');
  resumen.textContent = '¿Perdiste tus 12 palabras?';
  bloque.appendChild(resumen);

  const aviso = document.createElement('p');
  aviso.textContent =
    contexto === 'desbloqueo'
      ? 'Si ya no tienes tus 12 palabras del calendario, las notas guardadas en este navegador quedaron cifradas con una clave que nadie puede reconstruir — ni tú ni Artonseley. Lo que sí puedes hacer es borrar esa bóveda del calendario en este navegador y empezar de nuevo con una clave nueva.'
      : 'Si ya no tienes a la mano las palabras que te mostramos, puedes descartar esa frase y generar una nueva desde cero. Todavía no has guardado ninguna nota, así que no se pierde nada.';
  bloque.appendChild(aviso);

  const etiquetaEntiendo = document.createElement('label');
  etiquetaEntiendo.classList.add('confirmacion-anotado');
  const checkEntiendo = document.createElement('input');
  checkEntiendo.type = 'checkbox';
  etiquetaEntiendo.appendChild(checkEntiendo);
  etiquetaEntiendo.append(
    contexto === 'desbloqueo'
      ? ' Entiendo que las notas del calendario guardadas en este navegador se borrarán y no se pueden recuperar.'
      : ' Entiendo que la frase que me mostraron dejará de servir y se generará una nueva.'
  );
  bloque.appendChild(etiquetaEntiendo);

  const mensajeError = document.createElement('p');
  mensajeError.classList.add('mensaje-error-boveda');
  bloque.appendChild(mensajeError);

  const fila = document.createElement('div');
  fila.classList.add('fila-botones-boveda');

  const botonOlvidar = document.createElement('button');
  botonOlvidar.type = 'button';
  botonOlvidar.classList.add('boton-boveda-secundario');
  botonOlvidar.textContent = 'Olvidar para siempre las notas y la clave, y generar una clave nueva';
  botonOlvidar.disabled = true;

  checkEntiendo.addEventListener('change', () => {
    botonOlvidar.disabled = !checkEntiendo.checked;
  });

  botonOlvidar.addEventListener('click', async () => {
    botonOlvidar.disabled = true;
    checkEntiendo.disabled = true;
    mensajeError.textContent = '';
    try {
      await restablecerBovedaYCrearFraseNueva();
    } catch (error) {
      console.error('bovedaCalendario.js: error al restablecer la bóveda:', error);
      mensajeError.textContent = 'No se pudo restablecer la bóveda. Recarga la página e inténtalo de nuevo.';
      checkEntiendo.disabled = false;
      botonOlvidar.disabled = false;
    }
  });

  fila.appendChild(botonOlvidar);
  bloque.appendChild(fila);
  vista.appendChild(bloque);
}

// ========================= Desbloqueo con una semilla ya derivada =========================

async function intentarDesbloquearConSemilla(semilla, configuracion) {
  try {
    const salVault = base64AArrayBuffer(configuracion.salVault);
    const claveVault = await derivarClaveDesdeSemilla(semilla, salVault);
    const textoVerificado = await descifrarTexto(claveVault, configuracion.verificadorIv, configuracion.verificadorCiphertext);
    if (textoVerificado !== TEXTO_VERIFICADOR) return false;
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
  titulo.textContent = 'Crea la frase de recuperación de tu calendario';
  vista.appendChild(titulo);

  const explicacion = document.createElement('p');
  explicacion.textContent =
    'Estas 12 palabras son la ÚNICA forma de abrir tus notas del calendario si cambias de computadora o si se borran los datos de este navegador. Es una frase DISTINTA de la de "Mis cuadernos". Apúntala en papel, EN ESTE ORDEN, y guárdala en un lugar seguro. Nadie más la tiene — ni Artonseley puede recuperarla si la pierdes.';
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
  etiquetaConfirmar.append(' Ya anoté mis 12 palabras del calendario en un lugar seguro.');
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

  const posiciones = elegirPosicionesParaVerificar(12, 3);

  const titulo = document.createElement('h2');
  titulo.textContent = 'Confirma que la anotaste bien';
  vista.appendChild(titulo);

  const explicacion = document.createElement('p');
  explicacion.textContent = 'Escribe las palabras que van en estas posiciones de tu frase del calendario:';
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
  botonConfirmar.textContent = 'Confirmar y activar mi calendario';
  botonConfirmar.addEventListener('click', async () => {
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
      console.error('bovedaCalendario.js: error al activar la bóveda:', error);
      mensajeError.textContent = 'No se pudo activar la bóveda. Intenta de nuevo.';
      botonConfirmar.disabled = false;
    }
  });
  filaBotones.appendChild(botonConfirmar);

  vista.appendChild(filaBotones);
  agregarSalidaFrasePerdida(vista, 'verificacion');
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
  await guardarConfiguracionVaultCalendario(configuracion);
  configuracionVaultActual = configuracion;

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
  titulo.textContent = 'Desbloquea tu calendario';
  vista.appendChild(titulo);

  const explicacion = document.createElement('p');
  explicacion.textContent = 'Escribe las 12 palabras de recuperación de tu calendario, separadas por espacios.';
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

  agregarSalidaFrasePerdida(vista, 'desbloqueo');
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

    guardarSemillaEnDispositivo(semilla);
    ocultarPantallaBoveda();
    alDesbloquear?.();
  } finally {
    botonDesbloquear.disabled = false;
  }
}

// ========================= Cifrar/descifrar para calendarioPrincipal.js =========================

export function bovedaCalendarioEstaDesbloqueada() {
  return !!claveVaultEnMemoria;
}

export async function cifrarObjetoCalendario(objeto) {
  if (!claveVaultEnMemoria) throw new Error('bovedaCalendario.js: la bóveda no está desbloqueada.');
  return cifrarTexto(claveVaultEnMemoria, JSON.stringify(objeto));
}

export async function descifrarObjetoCalendario(registro) {
  if (!claveVaultEnMemoria) throw new Error('bovedaCalendario.js: la bóveda no está desbloqueada.');
  const texto = await descifrarTexto(claveVaultEnMemoria, registro.iv, registro.ciphertext);
  return JSON.parse(texto);
}
