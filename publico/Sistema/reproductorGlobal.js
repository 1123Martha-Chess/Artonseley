// reproductorGlobal.js
// -------------------------------------------------------------------
// El "cerebro" del apartado de Música. Se incluye en TODAS las páginas
// con sesión (index, buscador, cuadernos, notificaciones, sugerencias,
// configuración, calendario, escritorio y música) para que, una vez que
// el usuario arranca una canción o una playlist, la música siga sonando
// al navegar de una página a otra de artonseley.site.
//
// Cómo "continúa" entre páginas: no hay forma de que un sitio de varias
// páginas reproduzca audio sin cortes al recargar. Lo que se hace es
// guardar el estado (qué suena, en qué segundo, volumen, pausa...) en
// localStorage y, al cargar cada página nueva, retomar la canción en el
// punto que corresponde con un fundido de entrada de 1 s que disimula el
// micro-corte.
//
// NO suena dentro de un <iframe> (el Escritorio embebe las otras páginas):
// ahí este módulo reenvía las llamadas al motor de la página de arriba,
// así el audio nunca se duplica.
//
// La página de Música (musicaPrincipal.js) solo le pone interfaz encima
// usando la API que se exporta al final.
// -------------------------------------------------------------------

const CLAVE_ESTADO = 'artonseley::reproductor';

const FADE_BUCLE = 1;       // s de fundido al reiniciar una canción en bucle
const FADE_ENTRE_CANCIONES = 5; // s de fundido al pasar de una entrada de playlist a la siguiente
const FADE_FINAL = 10;      // s de fundido al final de toda la playlist
const MARGEN_FINAL_MS = FADE_FINAL * 1000;

const enIframe = window.top !== window.self;

// ===================== Estado persistido =====================

function estadoPorDefecto() {
  return {
    modo: null,            // null | 'cancion' | 'playlist'
    cancionId: null,
    playlist: [],          // [{ cancionId, minutos }]
    indice: 0,
    iniciadoEn: 0,         // epoch ms — arranque de toda la reproducción
    entradaIniciadaEn: 0,  // epoch ms — arranque de la entrada actual (playlist)
    posicion: 0,           // s dentro de la pista actual (última medición)
    guardadoEn: 0,         // epoch ms de esa medición
    volumen: 0.8,          // 0..1
    silenciado: false,
    pausado: false
  };
}

function leerEstado() {
  try {
    const crudo = localStorage.getItem(CLAVE_ESTADO);
    if (!crudo) return estadoPorDefecto();
    return { ...estadoPorDefecto(), ...JSON.parse(crudo) };
  } catch {
    return estadoPorDefecto();
  }
}

function escribirEstado(estado) {
  try {
    localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
  } catch {
    /* modo incógnito o storage lleno: la música sigue sonando en esta
       página, solo que no "viajará" a la siguiente. */
  }
}

// ===================== Motor real (solo fuera de iframe) =====================

function crearMotor() {
  let estado = leerEstado();

  const audio = new Audio();
  audio.preload = 'auto';
  audio.volume = 0; // arranca en silencio; los fundidos lo suben

  // Volumen y fundidos se hacen sobre audio.volume directamente (no sobre un
  // GainNode de Web Audio): así el audio SIEMPRE suena, aunque no exista un
  // AudioContext o esté suspendido. El AudioContext + AnalyserNode se arman
  // aparte y SOLO para el espectrómetro de la página de Música (ver
  // armarAnalizador / obtenerAnalizador), y solo después de un gesto del
  // usuario, para no dejar la reproducción muda.
  let nivelFade = 0;         // 0..1 — multiplicador de fundido actual
  let animacionFade = null;  // id del setInterval del fundido en curso

  let ctx = null;
  let analizador = null;
  let analizadorFallo = false;

  let enTransicion = false;  // true durante un crossfade o el fundido final
  let finalizando = false;
  const suscriptores = new Set();

  function avisar() {
    for (const cb of suscriptores) {
      try { cb(); } catch (e) { console.error('reproductorGlobal: suscriptor falló', e); }
    }
  }

  // Arma el AudioContext + AnalyserNode. OJO: createMediaElementSource hace
  // que a partir de ese momento el audio del elemento pase SOLO por el grafo,
  // así que solo se llama tras un gesto del usuario (cuando ctx.resume() sí
  // funciona). Si algo falla, se marca analizadorFallo y se sigue sin
  // espectrómetro — la reproducción por audio.volume no se ve afectada.
  function armarAnalizador() {
    if (ctx || analizadorFallo) return;
    try {
      const CtxClase = window.AudioContext || window.webkitAudioContext;
      if (!CtxClase) { analizadorFallo = true; return; }
      ctx = new CtxClase();
      const fuente = ctx.createMediaElementSource(audio);
      analizador = ctx.createAnalyser();
      analizador.fftSize = 256;
      fuente.connect(analizador);
      analizador.connect(ctx.destination);
    } catch (e) {
      console.warn('reproductorGlobal: sin espectrómetro (AudioContext no disponible):', e);
      analizadorFallo = true;
      ctx = null;
      analizador = null;
    }
  }

  function aplicarVolumen() {
    const base = estado.silenciado ? 0 : estado.volumen;
    try { audio.volume = Math.max(0, Math.min(1, base * nivelFade)); } catch { /* rango inválido */ }
  }

  // Fundido lineal de nivelFade hasta "objetivo" en "segundos", moviendo
  // audio.volume ~30 veces por segundo.
  function rampaFade(objetivo, segundos) {
    if (animacionFade) { clearInterval(animacionFade); animacionFade = null; }
    objetivo = Math.max(0, Math.min(1, objetivo));
    const inicio = nivelFade;
    aplicarVolumen(); // fija el punto de partida ya (evita un golpe a volumen full)
    const pasos = Math.max(1, Math.round(segundos * 30));
    if (pasos <= 1) { nivelFade = objetivo; aplicarVolumen(); return; }
    let n = 0;
    animacionFade = setInterval(() => {
      n++;
      nivelFade = inicio + (objetivo - inicio) * (n / pasos);
      aplicarVolumen();
      if (n >= pasos) {
        clearInterval(animacionFade);
        animacionFade = null;
        nivelFade = objetivo;
        aplicarVolumen();
      }
    }, (segundos * 1000) / pasos);
  }

  function urlAudio(id) {
    return `/api/musica/audio/${id}`;
  }

  // Entrada de playlist (o canción suelta) que debería estar sonando y
  // cuánto tiempo lleva, calculado desde iniciadoEn (para retomar bien al
  // cambiar de página, aunque la playlist haya avanzado mientras tanto).
  function ubicacionEnPlaylist() {
    const transcurrido = Date.now() - estado.iniciadoEn;
    let acumulado = 0;
    for (let i = 0; i < estado.playlist.length; i++) {
      const duracion = (estado.playlist[i].minutos || 0) * 60000;
      if (transcurrido < acumulado + duracion || i === estado.playlist.length - 1) {
        return { indice: i, dentro: transcurrido - acumulado, transcurridoTotal: transcurrido };
      }
      acumulado += duracion;
    }
    return { indice: 0, dentro: 0, transcurridoTotal: transcurrido };
  }

  function duracionTotalPlaylistMs() {
    return estado.playlist.reduce((s, e) => s + (e.minutos || 0) * 60000, 0);
  }

  function cancionActualId() {
    if (estado.modo === 'cancion') return estado.cancionId;
    if (estado.modo === 'playlist') return estado.playlist[estado.indice]?.cancionId ?? null;
    return null;
  }

  function cargarYReproducir(id, segundo, { fadeIn = true } = {}) {
    if (id == null) return Promise.resolve();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});

    const nuevaUrl = urlAudio(id);
    if (!audio.src.endsWith(nuevaUrl)) audio.src = nuevaUrl;

    const arrancar = () => {
      try {
        if (Number.isFinite(segundo) && segundo > 0 && audio.duration) {
          audio.currentTime = segundo % audio.duration;
        } else {
          audio.currentTime = 0;
        }
      } catch { /* la pista aún no admite seek */ }

      // El fundido se aplica siempre, sin esperar a que play() resuelva
      // (en algunos navegadores su promesa tarda mucho o nunca resuelve).
      rampaFade(1, fadeIn ? FADE_BUCLE : 0.01);

      const promesa = audio.play();
      if (promesa && promesa.then) {
        promesa.then(
          () => mostrarChipReanudar(false),
          () => mostrarChipReanudar(true)
        );
      }
    };

    if (audio.readyState >= 1) {
      arrancar();
    } else {
      audio.addEventListener('loadedmetadata', arrancar, { once: true });
      audio.addEventListener('error', () => mostrarChipReanudar(false), { once: true });
    }
    return Promise.resolve();
  }

  // --------- bucle interno: fundidos, cambios de entrada, fin de playlist ---------

  audio.addEventListener('timeupdate', () => {
    if (estado.pausado || estado.modo == null) return;
    if (!enTransicion && audio.duration && audio.duration - audio.currentTime <= FADE_BUCLE + 0.05 && audio.duration > 3) {
      rampaFade(0, FADE_BUCLE); // fundido de salida antes de reiniciar
    }
  });

  audio.addEventListener('ended', () => {
    if (estado.pausado || estado.modo == null) return;
    // La pista terminó: si estamos en transición, la siguiente lógica ya se
    // encarga; si no, la reiniciamos (bucle) con fundido de entrada.
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
    if (!enTransicion) rampaFade(1, FADE_BUCLE);
  });

  let tick = null;
  function arrancarTick() {
    if (tick) return;
    tick = setInterval(pulso, 250);
  }
  function pararTick() {
    if (tick) { clearInterval(tick); tick = null; }
  }

  async function pulso() {
    if (estado.pausado || estado.modo !== 'playlist') return;
    const total = duracionTotalPlaylistMs();
    const transcurrido = Date.now() - estado.iniciadoEn;

    if (transcurrido >= total) {
      detener();
      return;
    }
    if (!finalizando && transcurrido >= total - MARGEN_FINAL_MS) {
      finalizando = true;
      enTransicion = true;
      rampaFade(0, (total - transcurrido) / 1000);
      return;
    }
    if (finalizando) return;

    const dentro = Date.now() - estado.entradaIniciadaEn;
    const duracionEntrada = (estado.playlist[estado.indice]?.minutos || 0) * 60000;
    const esUltima = estado.indice >= estado.playlist.length - 1;

    if (!esUltima && !enTransicion && dentro >= duracionEntrada - FADE_ENTRE_CANCIONES * 1000) {
      enTransicion = true;
      rampaFade(0, FADE_ENTRE_CANCIONES);
      setTimeout(() => {
        if (estado.modo !== 'playlist' || estado.pausado) { enTransicion = false; return; }
        estado.indice += 1;
        estado.entradaIniciadaEn = Date.now();
        guardar();
        cargarYReproducir(cancionActualId(), 0, { fadeIn: true }).then(() => {
          enTransicion = false;
          avisar();
        });
      }, FADE_ENTRE_CANCIONES * 1000);
    }
  }

  // ===================== Guardado del estado =====================

  // ¿El <audio> está avanzando DE VERDAD en esta página? Al cargar una
  // página nueva el audio todavía no se reanudó (o el navegador bloqueó el
  // autoplay hasta que haya un gesto), y currentTime es 0. En ese caso NO
  // hay que tocar la posición guardada: si se pisara con 0, al cambiar de
  // página la canción volvería a empezar desde el inicio.
  function audioEstaSonando() {
    return !audio.paused && !audio.ended && audio.readyState >= 2 && audio.currentTime > 0;
  }

  function muestrearPosicion() {
    if (Number.isFinite(audio.currentTime) && audio.currentTime > 0) {
      estado.posicion = audio.currentTime;
      estado.guardadoEn = Date.now();
    }
  }

  function guardar() {
    if (estado.modo != null && !estado.pausado && audioEstaSonando()) {
      muestrearPosicion();
    }
    escribirEstado(estado);
  }

  setInterval(guardar, 2000);
  window.addEventListener('pagehide', guardar);
  document.addEventListener('visibilitychange', () => { if (document.hidden) guardar(); });

  // ===================== Reanudar al cargar la página =====================

  async function reanudar() {
    if (estado.modo == null || estado.pausado) return;

    if (estado.modo === 'playlist') {
      const total = duracionTotalPlaylistMs();
      const { indice, dentro, transcurridoTotal } = ubicacionEnPlaylist();
      if (transcurridoTotal >= total) { detener(); return; }
      estado.indice = indice;
      estado.entradaIniciadaEn = Date.now() - dentro;
      const segundo = dentro / 1000;
      await cargarYReproducir(cancionActualId(), segundo, { fadeIn: true });
      if (transcurridoTotal >= total - MARGEN_FINAL_MS) {
        finalizando = true;
        enTransicion = true;
        rampaFade(0, (total - transcurridoTotal) / 1000);
      }
      arrancarTick();
    } else {
      const estimado = estado.posicion + (Date.now() - estado.guardadoEn) / 1000;
      await cargarYReproducir(estado.cancionId, Math.max(0, estimado), { fadeIn: true });
    }
    avisar();
  }

  // ===================== Chip "Reanudar música" =====================
  // Si el navegador bloquea el autoplay (hace falta un gesto del usuario),
  // se ofrece un botón discreto para reanudar a mano — una sola vez.

  let chip = null;
  function mostrarChipReanudar(mostrar) {
    if (!mostrar) { if (chip) { chip.remove(); chip = null; } return; }
    if (chip) return;
    chip = document.createElement('button');
    chip.type = 'button';
    chip.textContent = '▶ Reanudar música';
    chip.setAttribute('style', [
      'position:fixed', 'right:16px', 'bottom:16px', 'z-index:9999',
      'padding:9px 14px', 'border-radius:20px', 'border:none', 'cursor:pointer',
      'font:13px Arial, sans-serif', 'color:#fff', 'background:#2A6BAF',
      'box-shadow:0 3px 12px rgba(0,0,0,.25)'
    ].join(';'));
    chip.addEventListener('click', async () => {
      if (ctx && ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }
      try { await audio.play(); rampaFade(1, FADE_BUCLE); mostrarChipReanudar(false); } catch {}
    });
    document.body.appendChild(chip);
  }

  // ===================== API pública =====================

  function instantanea() {
    return {
      modo: estado.modo,
      cancionId: estado.modo === 'cancion' ? estado.cancionId : cancionActualId(),
      playlist: estado.playlist.slice(),
      indice: estado.indice,
      pausado: estado.pausado,
      silenciado: estado.silenciado,
      volumen: estado.volumen,
      reproduciendo: estado.modo != null && !estado.pausado && !audio.paused
    };
  }

  async function reproducirCancion(id) {
    estado = { ...estado, modo: 'cancion', cancionId: Number(id), playlist: [], indice: 0,
      iniciadoEn: Date.now(), entradaIniciadaEn: Date.now(), pausado: false, posicion: 0, guardadoEn: Date.now() };
    enTransicion = false;
    finalizando = false;
    pararTick();
    guardar();
    await cargarYReproducir(estado.cancionId, 0, { fadeIn: true });
    avisar();
  }

  async function iniciarPlaylist(entradas) {
    const limpias = (entradas || [])
      .map((e) => ({ cancionId: Number(e.cancionId), minutos: Math.max(1, Math.round(Number(e.minutos) || 0)) }))
      .filter((e) => e.cancionId && e.minutos > 0);
    if (limpias.length === 0) return;
    const ahora = Date.now();
    estado = { ...estado, modo: 'playlist', cancionId: null, playlist: limpias, indice: 0,
      iniciadoEn: ahora, entradaIniciadaEn: ahora, pausado: false, posicion: 0, guardadoEn: ahora };
    enTransicion = false;
    finalizando = false;
    guardar();
    await cargarYReproducir(cancionActualId(), 0, { fadeIn: true });
    arrancarTick();
    avisar();
  }

  function detener() {
    estado = { ...estadoPorDefecto(), volumen: estado.volumen, silenciado: estado.silenciado };
    enTransicion = false;
    finalizando = false;
    pararTick();
    try { audio.pause(); audio.removeAttribute('src'); audio.load(); } catch {}
    rampaFade(0, 0.2);
    guardar();
    avisar();
  }

  function alternarPausa() {
    if (estado.modo == null) return;
    if (!estado.pausado) {
      // Anota dónde va la canción ANTES de parar, para retomar ahí.
      if (audioEstaSonando()) muestrearPosicion();
      estado.pausado = true;
      escribirEstado(estado);
      rampaFade(0, 0.3);
      setTimeout(() => { try { audio.pause(); } catch {} }, 320);
    } else {
      estado.pausado = false;
      estado.guardadoEn = Date.now(); // reanuda exactamente donde se quedó
      escribirEstado(estado);
      reanudar();
    }
    avisar();
  }

  function alternarSilencio() {
    estado.silenciado = !estado.silenciado;
    aplicarVolumen();
    guardar();
    avisar();
  }

  function fijarVolumen(v) {
    estado.volumen = Math.min(1, Math.max(0, Number(v) || 0));
    if (estado.volumen > 0 && estado.silenciado) estado.silenciado = false;
    aplicarVolumen();
    guardar();
    avisar();
  }

  // El espectrómetro de la página de Música pide esto cada frame. Se arma
  // el AnalyserNode solo cuando ya hubo un gesto del usuario en la página
  // (si no, createMediaElementSource dejaría el audio mudo hasta el gesto).
  function obtenerAnalizador() {
    if (!analizador && !analizadorFallo) {
      const huboGesto = !navigator.userActivation || navigator.userActivation.hasBeenActive;
      if (huboGesto) armarAnalizador();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    return analizador;
  }

  function suscribir(cb) { suscriptores.add(cb); return () => suscriptores.delete(cb); }

  // Reanuda en cuanto el DOM esté listo (necesitamos <body> para el chip).
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', reanudar, { once: true });
  } else {
    reanudar();
  }

  return {
    obtenerEstado: instantanea,
    reproducirCancion,
    iniciarPlaylist,
    detener,
    alternarPausa,
    alternarSilencio,
    fijarVolumen,
    obtenerAnalizador,
    suscribir
  };
}

// ===================== Selección motor real / proxy a la página de arriba =====================

const apiInerte = {
  obtenerEstado: () => ({ modo: null, cancionId: null, playlist: [], indice: 0, pausado: false, silenciado: false, volumen: 0.8, reproduciendo: false }),
  reproducirCancion: () => {},
  iniciarPlaylist: () => {},
  detener: () => {},
  alternarPausa: () => {},
  alternarSilencio: () => {},
  fijarVolumen: () => {},
  obtenerAnalizador: () => null,
  suscribir: () => () => {}
};

let motorLocal = null;
if (!enIframe) {
  motorLocal = crearMotor();
  window.__reproductorArtonseley = motorLocal;
}

// Dentro de un iframe del Escritorio (mismo origen): reusar el motor de la
// página de arriba, que es la que de verdad reproduce.
function motor() {
  if (!enIframe) return motorLocal;
  try {
    return window.top.__reproductorArtonseley || apiInerte;
  } catch {
    return apiInerte;
  }
}

export const obtenerEstado = () => motor().obtenerEstado();
export const reproducirCancion = (id) => motor().reproducirCancion(id);
export const iniciarPlaylist = (entradas) => motor().iniciarPlaylist(entradas);
export const detener = () => motor().detener();
export const alternarPausa = () => motor().alternarPausa();
export const alternarSilencio = () => motor().alternarSilencio();
export const fijarVolumen = (v) => motor().fijarVolumen(v);
export const obtenerAnalizador = () => motor().obtenerAnalizador();
export const suscribir = (cb) => motor().suscribir(cb);
export const estaEnIframe = () => enIframe;
