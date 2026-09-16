// calculadoraPrincipal.js
// -------------------------------------------------------------------
// Punto de entrada de calculadora.html. El cálculo YA NO se manda al
// servidor: corre íntegramente aquí, en el navegador, con la lógica
// pura de Sistema/calculadoraLogica.js — así ningún dato del caso
// (salario, fechas, causa de despido) viaja por la red, ni siquiera
// cifrado, eliminando cualquier riesgo de interceptación. Lo único que
// se le pide al servidor es GET /api/calculadora/indices: los valores
// económicos vigentes (salario mínimo, UMA) que fija el administrador,
// que no son un dato del Usuario.
// -------------------------------------------------------------------

import { aplicarModoGuardado } from './manejaPersonalizacion.js';
import { validar, calcular, indicesEconomicosListos } from './calculadoraLogica.js';

aplicarModoGuardado();

const form = document.getElementById('formularioCalculo');
const botonCalcular = document.getElementById('botonCalcular');
const contenedorResultado = document.getElementById('resultadoCalculo');

const causa = document.getElementById('causa');
const campoResolucion = document.getElementById('campoResolucion');
const campoMesesJuicio = document.getElementById('campoMesesJuicio');
const bloqueSdiCalcular = document.getElementById('bloqueSdiCalcular');
const bloqueSdiDirecto = document.getElementById('bloqueSdiDirecto');

let indices = null;

iniciar();

async function iniciar() {
  try {
    const respuesta = await fetch('/api/calculadora/indices');
    if (respuesta.status === 401) {
      window.location.href = 'login.html';
      return;
    }
    if (respuesta.status === 403) {
      const datos = await respuesta.json().catch(() => ({}));
      contenedorResultado.innerHTML = `<div class="bloque"><p class="mensaje-error">${escapar(datos.error || 'No tienes acceso a la calculadora.')}</p></div>`;
      botonCalcular.disabled = true;
      return;
    }
    if (!respuesta.ok) throw new Error('respuesta ' + respuesta.status);
    ({ indices } = await respuesta.json());
  } catch (error) {
    console.error('calculadoraPrincipal.js: no se pudieron obtener los índices económicos:', error);
    contenedorResultado.innerHTML = '<div class="bloque"><p class="mensaje-error">No se pudo conectar con el servidor.</p></div>';
    botonCalcular.disabled = true;
    return;
  }

  actualizarCamposCondicionales();
  causa.addEventListener('change', actualizarCamposCondicionales);
  for (const radio of document.querySelectorAll('input[name="modoSdi"]')) {
    radio.addEventListener('change', actualizarCamposCondicionales);
  }
  form.addEventListener('submit', enviar);
}

// Muestra u oculta campos según la causa y el modo de SDI elegidos.
function actualizarCamposCondicionales() {
  campoResolucion.hidden = causa.value !== 'despido-injustificado';

  const causaConJuicio = causa.value === 'despido-injustificado' || causa.value === 'rescision-trabajador';
  campoMesesJuicio.hidden = !causaConJuicio;

  const modoSdi = document.querySelector('input[name="modoSdi"]:checked')?.value;
  bloqueSdiCalcular.hidden = modoSdi !== 'calcular';
  bloqueSdiDirecto.hidden = modoSdi !== 'directo';
}

function numero(id) {
  const valor = document.getElementById(id).value.trim();
  return valor === '' ? null : Number(valor);
}

function construirCuerpo() {
  const modoSdi = document.querySelector('input[name="modoSdi"]:checked')?.value;
  const cuerpo = {
    fechaIngreso: document.getElementById('fechaIngreso').value,
    fechaBaja: document.getElementById('fechaBaja').value,
    salarioDiario: numero('salarioDiario'),
    zona: document.getElementById('zona').value,
    causa: causa.value,
    mesesJuicio: campoMesesJuicio.hidden ? 0 : (numero('mesesJuicio') ?? 0),
    diasSalarioPendiente: numero('diasSalarioPendiente') ?? 0,
    incluirAguinaldoProp: document.getElementById('incluirAguinaldoProp').checked,
    incluirVacacionesProp: document.getElementById('incluirVacacionesProp').checked,
    tope2xSM: document.getElementById('tope2xSM').value
  };

  if (causa.value === 'despido-injustificado') {
    cuerpo.resolucion = document.getElementById('resolucion').value;
  }

  if (modoSdi === 'directo') {
    cuerpo.sdi = { modo: 'directo', valor: numero('sdiValor') };
  } else {
    cuerpo.sdi = {
      modo: 'calcular',
      diasAguinaldo: numero('diasAguinaldo'),
      primaVacacionalPct: numero('primaVacacionalPct')
    };
  }

  return cuerpo;
}

function enviar(evento) {
  evento.preventDefault();

  if (!indicesEconomicosListos(indices)) {
    contenedorResultado.innerHTML =
      '<div class="bloque"><p class="mensaje-error">La calculadora todavía no tiene cargados los valores económicos vigentes (salario mínimo, UMA). Contacta al administrador.</p></div>';
    return;
  }

  const entradas = construirCuerpo();
  const errores = validar(entradas);
  if (errores.length > 0) {
    pintarErrores(errores);
    return;
  }

  try {
    pintarResultado(calcular(entradas, indices));
  } catch (error) {
    console.error('calculadoraPrincipal.js: error al calcular:', error);
    pintarErrores(['No se pudo calcular con esos datos. Revísalos e intenta de nuevo.']);
  }
}

function escapar(texto) {
  const div = document.createElement('div');
  div.textContent = String(texto ?? '');
  return div.innerHTML;
}

function pesos(n) {
  return Number(n).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

function pintarErrores(errores) {
  const items = errores.map((e) => `<li>${escapar(e)}</li>`).join('');
  contenedorResultado.innerHTML = `
    <div class="bloque">
      <p class="mensaje-error">Revisa estos datos:</p>
      <ul class="calc-lista calc-avisos">${items}</ul>
    </div>`;
}

function pintarResultado(datos) {
  const { supuestos = [], desglose = [], totales = {}, avisos = [], descargo = '' } = datos;

  const filas = [];
  let grupoActual = null;
  const etiquetaGrupo = { indemnizacion: 'Indemnización', prestacion: 'Prestaciones devengadas' };
  for (const linea of desglose) {
    if (linea.grupo !== grupoActual) {
      grupoActual = linea.grupo;
      filas.push(`<tr class="grupo-titulo"><td colspan="3">${escapar(etiquetaGrupo[grupoActual] || grupoActual)}</td></tr>`);
    }
    filas.push(`
      <tr>
        <td>
          ${escapar(linea.concepto)}
          <div class="detalle">${escapar(linea.detalle)}</div>
        </td>
        <td class="fundamento">${escapar(linea.fundamento)}</td>
        <td class="monto">${pesos(linea.monto)}</td>
      </tr>`);
  }

  const supuestosHTML = supuestos.length
    ? `<h3>Supuestos usados</h3><ul class="calc-lista">${supuestos.map((s) => `<li>${escapar(s)}</li>`).join('')}</ul>`
    : '';
  const avisosHTML = avisos.length
    ? `<h3>Avisos</h3><ul class="calc-lista calc-avisos">${avisos.map((s) => `<li>${escapar(s)}</li>`).join('')}</ul>`
    : '';

  contenedorResultado.innerHTML = `
    <div class="bloque">
      <div class="calc-total">
        <div class="etiqueta">Total estimado</div>
        <div class="monto">${pesos(totales.total || 0)}</div>
        <div class="sub">Indemnización: ${pesos(totales.indemnizaciones || 0)} · Prestaciones devengadas: ${pesos(totales.prestaciones || 0)}</div>
      </div>

      <div class="tabla-scroll">
        <table class="calc-tabla">
          <thead><tr><th>Concepto</th><th>Fundamento</th><th>Monto</th></tr></thead>
          <tbody>${filas.join('')}</tbody>
        </table>
      </div>

      ${supuestosHTML}
      ${avisosHTML}

      <div class="calc-descargo" style="margin-top:8px;margin-bottom:0;">${escapar(descargo)}</div>
    </div>`;

  contenedorResultado.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
