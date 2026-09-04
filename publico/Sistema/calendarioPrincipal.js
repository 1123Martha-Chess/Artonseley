// calendarioPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de calendario.html. Un calendario a pantalla
// completa: un mes a la vez, con navegación < > (mes) y << >> (año).
//
// Al hacer clic en un día se abre un panel donde el usuario puede:
//   - Ponerle un color al día (paleta fija), para marcarlo a su gusto.
//   - Agregar / editar / borrar "notas" del día. Cada nota tiene
//     Título (obligatorio), Situación (texto libre + una etiqueta
//     preestablecida) e Información.
//
// TODO se guarda cifrado en la bóveda del calendario (ver
// bovedaCalendario.js + almacenamientoCalendario.js) — una bóveda
// aparte de la de "Mis cuadernos", con su propia frase de 12 palabras.
// Nada se manda al servidor: las notas solo se ven en este navegador,
// por este usuario.
//
// Borrado automático (opcional, se activa en Configuración → Calendario):
// al abrir el calendario, si la casilla está encendida, se borran las
// notas cuya fecha ya quedó a más de un mes en el pasado. Los colores de
// los días NO se borran con esto.
// -------------------------------------------------------------------

import {
  inicializarBovedaCalendario,
  cifrarObjetoCalendario,
  descifrarObjetoCalendario
} from './bovedaCalendario.js';
import {
  listarEventosCifrados,
  guardarEventoCifrado,
  eliminarEventoCifrado,
  listarDiasCifrados,
  guardarDiaCifrado,
  eliminarDiaCifrado
} from './almacenamientoCalendario.js';
import { aplicarModoGuardado } from './manejaPersonalizacion.js';

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];
const DIAS_SEMANA_CORTO = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_SEMANA_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Paleta fija de colores para marcar días (claros, para que el número y
// las notas se sigan leyendo encima).
const COLORES_DIA = [
  { id: 'rojo', valor: '#f8c9c9' },
  { id: 'naranja', valor: '#fadcb9' },
  { id: 'amarillo', valor: '#fcefbf' },
  { id: 'verde', valor: '#c9e6cf' },
  { id: 'azul', valor: '#c9dcf5' },
  { id: 'morado', valor: '#ddccf0' },
  { id: 'rosa', valor: '#f6cfe6' },
  { id: 'gris', valor: '#d9dee3' }
];

const SITUACIONES_PREESTABLECIDAS = ['', 'Pendiente', 'En curso', 'Hecho', 'Cancelada'];

let usuarioEmail = null;

// Datos en memoria (ya descifrados) mientras la pestaña está abierta.
const eventos = new Map(); // id -> { id, fecha, titulo, situacion, situacionPreset, informacion, creadoEn, actualizadoEn }
const coloresPorFecha = new Map(); // 'YYYY-MM-DD' -> { id, fecha, color }

const hoy = new Date();
let anioVisible = hoy.getFullYear();
let mesVisible = hoy.getMonth(); // 0-11

const contenedor = document.getElementById('calendario');
const pantallaBoveda = document.getElementById('pantallaBoveda');

aplicarModoGuardado();
iniciar();

async function iniciar() {
  try {
    const respuesta = await fetch('/api/sesion');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    const sesion = await respuesta.json();
    usuarioEmail = sesion.email;
  } catch (error) {
    console.error('calendarioPrincipal.js: no se pudo confirmar la sesión:', error);
    return;
  }

  // Si el usuario activó los "Recordatorios del calendario" (ver
  // Configuración), esto mantiene viva su suscripción push y actualiza su
  // huso horario cada vez que entra al calendario. Import dinámico: si
  // nunca los activó, ni se descarga el módulo.
  import('./recordatoriosCalendario.js')
    .then((m) => m.sincronizar(usuarioEmail))
    .catch(() => {});

  await inicializarBovedaCalendario(
    usuarioEmail,
    'pantallaBoveda',
    {
      cargando: 'vistaBovedaCargando',
      incognito: 'vistaBovedaIncognito',
      configuracion: 'vistaBovedaConfiguracion',
      verificacion: 'vistaBovedaVerificacion',
      desbloqueo: 'vistaBovedaDesbloqueo'
    },
    alDesbloquear
  );
}

async function alDesbloquear() {
  await cargarDatos();
  await borrarNotasViejasSiAplica();
  await sembrarNotaEjemploSiAplica();
  render();
}

// ===================== Nota de ejemplo (primera vez) =====================
//
// La primera vez que alguien abre el Calendario (bóveda recién creada, sin
// notas), se le siembra una nota de ejemplo para que vea de un vistazo qué
// puede escribir en cada campo. Se guarda cifrada como cualquier otra nota,
// solo en este navegador. Una bandera en localStorage evita volver a crearla:
// si el usuario la borra, no reaparece.

function claveEjemploSembrado() {
  return `calendario::ejemploSembrado::${usuarioEmail}`;
}

function ejemploYaSembrado() {
  try {
    return localStorage.getItem(claveEjemploSembrado()) === '1';
  } catch {
    return false;
  }
}

function marcarEjemploSembrado() {
  try {
    localStorage.setItem(claveEjemploSembrado(), '1');
  } catch {
    /* Sin localStorage: se volverá a intentar la próxima vez, sin romper nada. */
  }
}

async function sembrarNotaEjemploSiAplica() {
  if (ejemploYaSembrado()) return;

  // Si el usuario ya tiene notas propias, no le ensuciamos el calendario:
  // solo dejamos la bandera para no volver a revisar.
  if (eventos.size > 0) {
    marcarEjemploSembrado();
    return;
  }

  const ahora = new Date().toISOString();
  const nota = {
    id: crypto.randomUUID(),
    fecha: claveFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
    titulo: 'Ejemplo de nota!',
    situacionPreset: 'Pendiente',
    situacion: 'Aquí va un detalle corto — por ejemplo "llamar al cliente" o "reunión 10:00".',
    informacion:
      'Así se ve una nota. El Título es lo único obligatorio y es lo que aparece en ' +
      'el cuadro del día. En "Situación" eliges una etiqueta (Pendiente, En curso, ' +
      'Hecho o Cancelada) y, si quieres, agregas un detalle libre al lado. Este campo, ' +
      '"Información", es para lo más largo: contexto, números de expediente, enlaces, ' +
      'lo que necesites recordar. Puedes poner varias notas en un mismo día y también ' +
      'pintar el día de un color desde el panel. Todo se guarda cifrado y solo en este ' +
      'dispositivo. Puedes editar o borrar esta nota cuando quieras.',
    creadoEn: ahora,
    actualizadoEn: ahora
  };

  try {
    await guardarEvento(nota);
  } catch (error) {
    console.error('calendarioPrincipal.js: no se pudo sembrar la nota de ejemplo:', error);
    return;
  }
  marcarEjemploSembrado();
}

// ===================== Carga / persistencia =====================

async function cargarDatos() {
  const [registrosEventos, registrosDias] = await Promise.all([
    listarEventosCifrados(),
    listarDiasCifrados()
  ]);

  for (const registro of registrosEventos) {
    try {
      const evento = await descifrarObjetoCalendario(registro);
      eventos.set(evento.id, evento);
    } catch (error) {
      console.error('calendarioPrincipal.js: no se pudo descifrar un evento:', error);
    }
  }

  for (const registro of registrosDias) {
    try {
      const dia = await descifrarObjetoCalendario(registro);
      coloresPorFecha.set(dia.fecha, dia);
    } catch (error) {
      console.error('calendarioPrincipal.js: no se pudo descifrar un día:', error);
    }
  }
}

async function guardarEvento(evento) {
  const registro = { id: evento.id, ...(await cifrarObjetoCalendario(evento)) };
  await guardarEventoCifrado(registro);
  eventos.set(evento.id, evento);
}

async function borrarEvento(id) {
  await eliminarEventoCifrado(id);
  eventos.delete(id);
}

async function fijarColorDeDia(fecha, color) {
  if (!color) {
    const existente = coloresPorFecha.get(fecha);
    if (existente) {
      await eliminarDiaCifrado(existente.id);
      coloresPorFecha.delete(fecha);
    }
    return;
  }
  const existente = coloresPorFecha.get(fecha);
  const dia = { id: existente?.id || crypto.randomUUID(), fecha, color };
  const registro = { id: dia.id, ...(await cifrarObjetoCalendario(dia)) };
  await guardarDiaCifrado(registro);
  coloresPorFecha.set(fecha, dia);
}

// ===================== Borrado automático =====================

function claveBorradoAutomatico() {
  return `calendario::borradoAutomatico::${usuarioEmail}`;
}

function borradoAutomaticoEncendido() {
  try {
    return localStorage.getItem(claveBorradoAutomatico()) === '1';
  } catch {
    return false;
  }
}

async function borrarNotasViejasSiAplica() {
  if (!borradoAutomaticoEncendido()) return;

  const hoyMedianoche = new Date();
  hoyMedianoche.setHours(0, 0, 0, 0);

  for (const evento of [...eventos.values()]) {
    const [a, m, d] = evento.fecha.split('-').map(Number);
    const limite = new Date(a, m - 1, d);
    limite.setMonth(limite.getMonth() + 1); // un mes después de la fecha de la nota
    if (hoyMedianoche.getTime() > limite.getTime()) {
      try {
        await borrarEvento(evento.id);
      } catch (error) {
        console.error('calendarioPrincipal.js: no se pudo borrar una nota vieja:', error);
      }
    }
  }
}

// ===================== Utilidades de fecha =====================

function dosDigitos(n) {
  return String(n).padStart(2, '0');
}

function claveFecha(anio, mes, dia) {
  return `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;
}

function eventosDeFecha(fecha) {
  return [...eventos.values()]
    .filter((e) => e.fecha === fecha)
    .sort((a, b) => (a.creadoEn || '').localeCompare(b.creadoEn || ''));
}

// ===================== Render del calendario =====================

function render() {
  contenedor.innerHTML = '';

  contenedor.appendChild(crearEncabezado());
  contenedor.appendChild(crearNombresDeDias());
  contenedor.appendChild(crearRejillaDelMes());
}

function crearEncabezado() {
  const encabezado = document.createElement('div');
  encabezado.className = 'cal-encabezado';

  const boton = (texto, titulo, alClic) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal-nav';
    b.textContent = texto;
    b.title = titulo;
    b.addEventListener('click', alClic);
    return b;
  };

  encabezado.appendChild(boton('<<', 'Año anterior', () => cambiarAnio(-1)));
  encabezado.appendChild(boton('<', 'Mes anterior', () => cambiarMes(-1)));

  const titulo = document.createElement('div');
  titulo.className = 'cal-titulo';
  titulo.textContent = `${MESES[mesVisible]} ${anioVisible}`;
  encabezado.appendChild(titulo);

  encabezado.appendChild(boton('>', 'Mes siguiente', () => cambiarMes(1)));
  encabezado.appendChild(boton('>>', 'Año siguiente', () => cambiarAnio(1)));

  const hoyBoton = document.createElement('button');
  hoyBoton.type = 'button';
  hoyBoton.className = 'cal-hoy';
  hoyBoton.textContent = 'Hoy';
  hoyBoton.addEventListener('click', () => {
    anioVisible = hoy.getFullYear();
    mesVisible = hoy.getMonth();
    render();
  });
  encabezado.appendChild(hoyBoton);

  return encabezado;
}

function cambiarMes(delta) {
  mesVisible += delta;
  if (mesVisible < 0) { mesVisible = 11; anioVisible--; }
  if (mesVisible > 11) { mesVisible = 0; anioVisible++; }
  render();
}

function cambiarAnio(delta) {
  anioVisible += delta;
  render();
}

function crearNombresDeDias() {
  const fila = document.createElement('div');
  fila.className = 'cal-dias-semana';
  DIAS_SEMANA_CORTO.forEach((nombre) => {
    const celda = document.createElement('div');
    celda.textContent = nombre;
    fila.appendChild(celda);
  });
  return fila;
}

function crearRejillaDelMes() {
  const rejilla = document.createElement('div');
  rejilla.className = 'cal-rejilla';

  const primerDia = new Date(anioVisible, mesVisible, 1).getDay(); // 0=Dom
  const diasEnMes = new Date(anioVisible, mesVisible + 1, 0).getDate();

  // Huecos antes del día 1.
  for (let i = 0; i < primerDia; i++) {
    const vacia = document.createElement('div');
    vacia.className = 'cal-celda cal-celda-vacia';
    rejilla.appendChild(vacia);
  }

  const claveHoy = claveFecha(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  for (let dia = 1; dia <= diasEnMes; dia++) {
    const fecha = claveFecha(anioVisible, mesVisible, dia);
    const celda = document.createElement('div');
    celda.className = 'cal-celda';
    if (fecha === claveHoy) celda.classList.add('cal-celda-hoy');

    const color = coloresPorFecha.get(fecha)?.color;
    if (color) celda.style.background = color;

    const numero = document.createElement('div');
    numero.className = 'cal-numero';
    numero.textContent = String(dia);
    celda.appendChild(numero);

    const listaNotas = document.createElement('div');
    listaNotas.className = 'cal-notas-celda';
    const notasDelDia = eventosDeFecha(fecha);
    notasDelDia.slice(0, 3).forEach((evento) => {
      const chip = document.createElement('div');
      chip.className = 'cal-chip-nota';
      chip.textContent = evento.titulo;
      listaNotas.appendChild(chip);
    });
    if (notasDelDia.length > 3) {
      const mas = document.createElement('div');
      mas.className = 'cal-chip-mas';
      mas.textContent = `+${notasDelDia.length - 3} más`;
      listaNotas.appendChild(mas);
    }
    celda.appendChild(listaNotas);

    celda.addEventListener('click', () => abrirPanelDia(fecha));
    rejilla.appendChild(celda);
  }

  return rejilla;
}

// ===================== Panel de un día =====================

let panelDia = null;

function abrirPanelDia(fecha) {
  cerrarPanelDia();

  const [a, m, d] = fecha.split('-').map(Number);
  const fechaObj = new Date(a, m - 1, d);

  const fondo = document.createElement('div');
  fondo.className = 'cal-panel-fondo';
  fondo.addEventListener('click', (evento) => {
    if (evento.target === fondo) cerrarPanelDia();
  });

  const panel = document.createElement('div');
  panel.className = 'cal-panel-dia';

  const titulo = document.createElement('h2');
  const nombreDia = DIAS_SEMANA_LARGO[fechaObj.getDay()];
  titulo.textContent = `${nombreDia.charAt(0).toUpperCase()}${nombreDia.slice(1)} ${d} de ${MESES[m - 1].toLowerCase()} de ${a}`;
  panel.appendChild(titulo);

  const botonCerrar = document.createElement('button');
  botonCerrar.type = 'button';
  botonCerrar.className = 'cal-panel-cerrar';
  botonCerrar.textContent = '✕';
  botonCerrar.addEventListener('click', cerrarPanelDia);
  panel.appendChild(botonCerrar);

  panel.appendChild(crearSelectorColor(fecha));
  panel.appendChild(crearListaNotas(fecha));
  panel.appendChild(crearFormularioNota(fecha, null));

  fondo.appendChild(panel);
  document.body.appendChild(fondo);
  panelDia = fondo;
}

function cerrarPanelDia() {
  if (panelDia) {
    panelDia.remove();
    panelDia = null;
  }
}

function refrescarPanelDia(fecha) {
  cerrarPanelDia();
  abrirPanelDia(fecha);
}

function crearSelectorColor(fecha) {
  const bloque = document.createElement('div');
  bloque.className = 'cal-bloque';

  const etiqueta = document.createElement('h3');
  etiqueta.textContent = 'Color del día';
  bloque.appendChild(etiqueta);

  const fila = document.createElement('div');
  fila.className = 'cal-colores';

  const actual = coloresPorFecha.get(fecha)?.color || '';

  const swatch = (valor, titulo) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cal-swatch';
    b.title = titulo;
    if (valor) {
      b.style.background = valor;
    } else {
      b.classList.add('cal-swatch-ninguno');
      b.textContent = '∅';
    }
    if ((valor || '') === actual) b.classList.add('activo');
    b.addEventListener('click', async () => {
      try {
        await fijarColorDeDia(fecha, valor);
        render();
        refrescarPanelDia(fecha);
      } catch (error) {
        console.error('calendarioPrincipal.js: no se pudo guardar el color:', error);
      }
    });
    return b;
  };

  fila.appendChild(swatch('', 'Sin color'));
  COLORES_DIA.forEach((c) => fila.appendChild(swatch(c.valor, c.id)));
  bloque.appendChild(fila);

  return bloque;
}

function crearListaNotas(fecha) {
  const bloque = document.createElement('div');
  bloque.className = 'cal-bloque';

  const etiqueta = document.createElement('h3');
  etiqueta.textContent = 'Notas de este día';
  bloque.appendChild(etiqueta);

  const notas = eventosDeFecha(fecha);
  if (notas.length === 0) {
    const vacio = document.createElement('p');
    vacio.className = 'cal-vacio';
    vacio.textContent = 'Todavía no hay notas. Agrega una abajo.';
    bloque.appendChild(vacio);
    return bloque;
  }

  notas.forEach((evento) => {
    const tarjeta = document.createElement('div');
    tarjeta.className = 'cal-nota';

    const tituloNota = document.createElement('div');
    tituloNota.className = 'cal-nota-titulo';
    tituloNota.textContent = evento.titulo;
    tarjeta.appendChild(tituloNota);

    if (evento.situacionPreset || evento.situacion) {
      const situ = document.createElement('div');
      situ.className = 'cal-nota-situacion';
      if (evento.situacionPreset) {
        const badge = document.createElement('span');
        badge.className = 'cal-badge cal-badge-' + normalizarClase(evento.situacionPreset);
        badge.textContent = evento.situacionPreset;
        situ.appendChild(badge);
      }
      if (evento.situacion) situ.append(' ' + evento.situacion);
      tarjeta.appendChild(situ);
    }

    if (evento.informacion) {
      const info = document.createElement('div');
      info.className = 'cal-nota-info';
      info.textContent = evento.informacion;
      tarjeta.appendChild(info);
    }

    const acciones = document.createElement('div');
    acciones.className = 'cal-nota-acciones';

    const botonEditar = document.createElement('button');
    botonEditar.type = 'button';
    botonEditar.textContent = 'Editar';
    botonEditar.addEventListener('click', () => {
      const form = crearFormularioNota(fecha, evento);
      tarjeta.replaceWith(form);
    });

    const botonBorrar = document.createElement('button');
    botonBorrar.type = 'button';
    botonBorrar.className = 'cal-borrar';
    botonBorrar.textContent = 'Borrar';
    botonBorrar.addEventListener('click', async () => {
      if (!window.confirm(`¿Borrar la nota "${evento.titulo}"?`)) return;
      try {
        await borrarEvento(evento.id);
        render();
        refrescarPanelDia(fecha);
      } catch (error) {
        console.error('calendarioPrincipal.js: no se pudo borrar la nota:', error);
      }
    });

    acciones.append(botonEditar, botonBorrar);
    tarjeta.appendChild(acciones);
    bloque.appendChild(tarjeta);
  });

  return bloque;
}

function normalizarClase(texto) {
  return String(texto)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
}

// evento = null -> formulario para AGREGAR; evento con datos -> EDITAR.
function crearFormularioNota(fecha, evento) {
  const form = document.createElement('div');
  form.className = 'cal-form';

  const titulo = document.createElement('h3');
  titulo.textContent = evento ? 'Editar nota' : 'Agregar nota';
  form.appendChild(titulo);

  const campoTitulo = crearCampo('Título *', 'text', evento?.titulo || '');
  form.appendChild(campoTitulo.contenedor);

  // Situación: etiqueta preestablecida + texto libre al lado.
  const filaSituacion = document.createElement('div');
  filaSituacion.className = 'cal-fila-situacion';

  const etiquetaSitu = document.createElement('label');
  etiquetaSitu.className = 'cal-etiqueta';
  etiquetaSitu.textContent = 'Situación';
  form.appendChild(etiquetaSitu);

  const select = document.createElement('select');
  select.className = 'cal-select';
  SITUACIONES_PREESTABLECIDAS.forEach((opcion) => {
    const op = document.createElement('option');
    op.value = opcion;
    op.textContent = opcion || '—';
    if ((evento?.situacionPreset || '') === opcion) op.selected = true;
    select.appendChild(op);
  });

  const textoSituacion = document.createElement('input');
  textoSituacion.type = 'text';
  textoSituacion.className = 'cal-input';
  textoSituacion.placeholder = 'Detalle (opcional)';
  textoSituacion.value = evento?.situacion || '';

  filaSituacion.append(select, textoSituacion);
  form.appendChild(filaSituacion);

  const campoInfo = crearCampo('Información', 'textarea', evento?.informacion || '');
  form.appendChild(campoInfo.contenedor);

  const error = document.createElement('p');
  error.className = 'mensaje-error';
  form.appendChild(error);

  const acciones = document.createElement('div');
  acciones.className = 'cal-form-acciones';

  const botonGuardar = document.createElement('button');
  botonGuardar.type = 'button';
  botonGuardar.className = 'cal-boton-principal';
  botonGuardar.textContent = evento ? 'Guardar cambios' : 'Guardar nota';
  botonGuardar.addEventListener('click', async () => {
    const tituloValor = campoTitulo.entrada.value.trim();
    if (!tituloValor) {
      error.textContent = 'El título es obligatorio.';
      return;
    }
    botonGuardar.disabled = true;
    const ahora = new Date().toISOString();
    const datos = evento
      ? { ...evento }
      : { id: crypto.randomUUID(), fecha, creadoEn: ahora };
    datos.titulo = tituloValor;
    datos.situacionPreset = select.value;
    datos.situacion = textoSituacion.value.trim();
    datos.informacion = campoInfo.entrada.value.trim();
    datos.actualizadoEn = ahora;

    try {
      await guardarEvento(datos);
      render();
      refrescarPanelDia(fecha);
    } catch (err) {
      console.error('calendarioPrincipal.js: no se pudo guardar la nota:', err);
      error.textContent = 'No se pudo guardar. Intenta de nuevo.';
      botonGuardar.disabled = false;
    }
  });

  acciones.appendChild(botonGuardar);

  if (evento) {
    const botonCancelar = document.createElement('button');
    botonCancelar.type = 'button';
    botonCancelar.className = 'cal-boton-secundario';
    botonCancelar.textContent = 'Cancelar';
    botonCancelar.addEventListener('click', () => refrescarPanelDia(fecha));
    acciones.appendChild(botonCancelar);
  }

  form.appendChild(acciones);
  return form;
}

function crearCampo(etiquetaTexto, tipo, valor) {
  const contenedor = document.createElement('div');
  contenedor.className = 'cal-campo';

  const etiqueta = document.createElement('label');
  etiqueta.className = 'cal-etiqueta';
  etiqueta.textContent = etiquetaTexto;
  contenedor.appendChild(etiqueta);

  const entrada = tipo === 'textarea' ? document.createElement('textarea') : document.createElement('input');
  if (tipo !== 'textarea') entrada.type = tipo;
  entrada.className = 'cal-input';
  entrada.value = valor;
  contenedor.appendChild(entrada);

  return { contenedor, entrada };
}
