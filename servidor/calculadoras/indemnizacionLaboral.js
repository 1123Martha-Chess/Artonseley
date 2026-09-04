// indemnizacionLaboral.js
// -------------------------------------------------------------------
// Calculadora Jurídica Financiera — Fase 1: indemnización / liquidación
// laboral conforme a la Ley Federal del Trabajo (LFT).
//
// TODO el cálculo vive aquí, en el servidor: el cliente solo manda los
// datos que el usuario capturó y pinta el desglose que regresa esta
// función. Mismo principio que el buscador de leyes.
//
// El resultado NO es solo un número: es un desglose renglón por renglón,
// cada uno citando el artículo de la LFT que lo sustenta, más los
// supuestos usados, los avisos, y un descargo de responsabilidad. Es una
// ESTIMACIÓN informativa, no un cálculo oficial.
//
// Puntos discutibles resueltos con una decisión explícita:
//   - Tope de 2× salario mínimo (Arts. 485-486 LFT): es un interruptor
//     ('tope2xSM'). Por defecto 'solo-prima', que sigue el criterio de la
//     SCJN (el tope no aplica a la indemnización constitucional, solo a la
//     prima de antigüedad).
//   - Salarios vencidos (Art. 48, reforma 2012): dependen de la duración
//     real del juicio, que no se conoce de antemano. Solo se calculan si
//     el usuario da 'mesesJuicio' > 0, y siempre con un aviso fuerte.
// -------------------------------------------------------------------

const CAUSAS = ['despido-injustificado', 'despido-justificado', 'renuncia', 'rescision-trabajador'];
const RESOLUCIONES = ['indemnizacion', 'reinstalacion'];
const OPCIONES_TOPE = ['solo-prima', 'todo', 'ninguno'];

const MS_DIA = 86_400_000;
const DIAS_ANIO = 365.25;

const PATRON_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function esFecha(valor) {
  return typeof valor === 'string' && PATRON_FECHA.test(valor) && !Number.isNaN(Date.parse(valor + 'T00:00:00'));
}

function esNumero(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

// ===================== Validación =====================

export function validar(e) {
  const errores = [];
  e = e || {};

  if (!esFecha(e.fechaIngreso)) errores.push('La fecha de ingreso no es válida (usa el formato AAAA-MM-DD).');
  if (!esFecha(e.fechaBaja)) errores.push('La fecha de baja no es válida (usa el formato AAAA-MM-DD).');
  if (esFecha(e.fechaIngreso) && esFecha(e.fechaBaja) && new Date(e.fechaBaja) < new Date(e.fechaIngreso)) {
    errores.push('La fecha de baja no puede ser anterior a la de ingreso.');
  }

  if (!esNumero(e.salarioDiario) || e.salarioDiario <= 0) {
    errores.push('El salario diario debe ser un número mayor a 0.');
  }

  if (e.zona !== 'general' && e.zona !== 'fronteraNorte') {
    errores.push('Elige la zona: general o Frontera Norte.');
  }

  if (!CAUSAS.includes(e.causa)) {
    errores.push('Elige la causa de la separación.');
  }
  if (e.causa === 'despido-injustificado' && !RESOLUCIONES.includes(e.resolucion)) {
    errores.push('Para un despido injustificado, indica si el resultado es indemnización o reinstalación.');
  }

  if (e.mesesJuicio != null && (!esNumero(e.mesesJuicio) || e.mesesJuicio < 0 || !Number.isInteger(e.mesesJuicio))) {
    errores.push('Los meses de juicio deben ser un número entero de 0 o más.');
  }

  const sdi = e.sdi;
  if (!sdi || (sdi.modo !== 'directo' && sdi.modo !== 'calcular')) {
    errores.push('Indica cómo se obtiene el salario diario integrado.');
  } else if (sdi.modo === 'directo') {
    if (!esNumero(sdi.valor) || sdi.valor <= 0) {
      errores.push('El salario diario integrado debe ser un número mayor a 0.');
    }
  } else {
    if (!esNumero(sdi.diasAguinaldo) || sdi.diasAguinaldo < 15) {
      errores.push('Los días de aguinaldo deben ser 15 o más (mínimo de ley, Art. 87 LFT).');
    }
    if (!esNumero(sdi.primaVacacionalPct) || sdi.primaVacacionalPct < 25) {
      errores.push('La prima vacacional debe ser 25% o más (mínimo de ley, Art. 80 LFT).');
    }
  }

  if (e.diasSalarioPendiente != null && (!esNumero(e.diasSalarioPendiente) || e.diasSalarioPendiente < 0)) {
    errores.push('Los días de salario pendiente deben ser 0 o más.');
  }

  if (e.tope2xSM != null && !OPCIONES_TOPE.includes(e.tope2xSM)) {
    errores.push('La opción del tope de 2× salario mínimo no es válida.');
  }

  return errores;
}

// ===================== Utilidades =====================

// Días de vacaciones que corresponden a un año de servicio dado, según el
// Art. 76 LFT reformado en 2023 ("vacaciones dignas"):
//   año 1 = 12; +2 por año hasta el 5º (año 5 = 20);
//   del 6º en adelante, +2 por cada 5 años de servicio (6-10 = 22; 11-15 = 24; ...).
function diasVacacionesAnuales(anioDeServicio) {
  const a = Math.max(1, Math.floor(anioDeServicio));
  if (a <= 5) return 10 + a * 2;
  return 20 + Math.floor((a - 1) / 5) * 2;
}

function pesos(n) {
  return `$${n.toFixed(2)}`;
}

// ===================== Cálculo =====================

export function calcular(e, indices) {
  const ingreso = new Date(e.fechaIngreso + 'T00:00:00');
  const baja = new Date(e.fechaBaja + 'T00:00:00');

  const diasAntiguedad = Math.round((baja - ingreso) / MS_DIA);
  const antiguedadAnios = diasAntiguedad / DIAS_ANIO;
  const anioEnCurso = Math.floor(antiguedadAnios) + 1;
  const diasVac = diasVacacionesAnuales(anioEnCurso);

  const diasAguinaldo = e.sdi.modo === 'calcular' ? e.sdi.diasAguinaldo : 15;
  const primaVacPct = e.sdi.modo === 'calcular' ? e.sdi.primaVacacionalPct : 25;
  const factorIntegracion = 1 + diasAguinaldo / 365 + (diasVac * (primaVacPct / 100)) / 365;
  const sdi = e.sdi.modo === 'directo' ? e.sdi.valor : e.salarioDiario * factorIntegracion;

  const smZona = e.zona === 'fronteraNorte' ? indices.salarioMinimoFronteraNorte : indices.salarioMinimoGeneral;
  const topeDiario = 2 * smZona;
  const tope = e.tope2xSM || 'solo-prima';

  const salarioParaIndem = tope === 'todo' ? Math.min(sdi, topeDiario) : sdi;
  const salarioParaPrima = tope === 'ninguno' ? e.salarioDiario : Math.min(e.salarioDiario, topeDiario);

  const causa = e.causa;
  const hayIndemnizacion =
    (causa === 'despido-injustificado' && e.resolucion === 'indemnizacion') || causa === 'rescision-trabajador';
  const esReinstalacion = causa === 'despido-injustificado' && e.resolucion === 'reinstalacion';
  const haySalariosVencidos =
    (causa === 'despido-injustificado' || causa === 'rescision-trabajador') && (e.mesesJuicio || 0) > 0;
  // Prima de antigüedad: solo procede al SEPARARSE del empleo. En la
  // reinstalación el trabajador conserva su puesto, así que no aplica.
  const pagaPrima =
    !esReinstalacion &&
    (causa === 'despido-injustificado' ||
      causa === 'despido-justificado' ||
      causa === 'rescision-trabajador' ||
      (causa === 'renuncia' && antiguedadAnios >= 15));
  const pagaDevengadas = !esReinstalacion;

  const desglose = [];
  const add = (grupo, concepto, detalle, monto, fundamento) => {
    if (monto > 0.005) desglose.push({ grupo, concepto, detalle, monto, fundamento });
  };

  // ---- Indemnizaciones ----
  if (hayIndemnizacion) {
    add(
      'indemnizacion',
      'Indemnización constitucional (3 meses de salario)',
      `90 días × ${pesos(salarioParaIndem)}`,
      90 * salarioParaIndem,
      'Art. 48 LFT'
    );

    if (antiguedadAnios >= 1) {
      add(
        'indemnizacion',
        'Indemnización por años de servicio (20 días por año)',
        `20 días × ${antiguedadAnios.toFixed(2)} años × ${pesos(salarioParaIndem)}`,
        20 * antiguedadAnios * salarioParaIndem,
        'Art. 50 fr. II y III LFT'
      );
    } else {
      const diasMitad = diasAntiguedad / 2;
      add(
        'indemnizacion',
        'Indemnización por tiempo de servicio (menos de un año)',
        `${diasMitad.toFixed(1)} días (mitad del tiempo servido) × ${pesos(salarioParaIndem)}`,
        diasMitad * salarioParaIndem,
        'Art. 50 fr. I LFT'
      );
    }
  }

  if (pagaPrima) {
    add(
      'indemnizacion',
      'Prima de antigüedad',
      `12 días × ${antiguedadAnios.toFixed(2)} años × ${pesos(salarioParaPrima)}`,
      12 * antiguedadAnios * salarioParaPrima,
      'Art. 162 LFT'
    );
  }

  if (haySalariosVencidos) {
    const meses = e.mesesJuicio;
    const mesesTope = Math.min(meses, 12);
    let monto = mesesTope * 30 * e.salarioDiario;
    let detalle = `${mesesTope} meses × 30 días × ${pesos(e.salarioDiario)}`;
    if (meses > 12) {
      const interes = (meses - 12) * 0.02 * (15 * 30 * e.salarioDiario);
      monto += interes;
      detalle += ` + ${meses - 12} meses de interés (2% mensual sobre 15 meses de salario)`;
    }
    add('indemnizacion', 'Salarios vencidos (caídos)', detalle, monto, 'Art. 48 LFT');
  }

  // ---- Prestaciones devengadas ----
  let vacProp = 0;
  if (pagaDevengadas) {
    if (e.incluirAguinaldoProp !== false) {
      const inicioAnio = new Date(baja.getFullYear(), 0, 1);
      const desde = ingreso > inicioAnio ? ingreso : inicioAnio;
      const diasEnAnio = Math.round((baja - desde) / MS_DIA);
      add(
        'prestacion',
        'Aguinaldo proporcional',
        `${diasAguinaldo} días × ${diasEnAnio}/365 × ${pesos(e.salarioDiario)}`,
        diasAguinaldo * (diasEnAnio / 365) * e.salarioDiario,
        'Art. 87 LFT'
      );
    }

    if (e.incluirVacacionesProp !== false) {
      const aniversario = new Date(ingreso);
      aniversario.setFullYear(ingreso.getFullYear() + Math.floor(antiguedadAnios));
      const diasDesdeAniversario = Math.max(0, Math.round((baja - aniversario) / MS_DIA));
      vacProp = diasVac * (diasDesdeAniversario / 365) * e.salarioDiario;
      add(
        'prestacion',
        'Vacaciones proporcionales',
        `${diasVac} días × ${diasDesdeAniversario}/365 × ${pesos(e.salarioDiario)}`,
        vacProp,
        'Art. 76 LFT'
      );
      add(
        'prestacion',
        'Prima vacacional (sobre las vacaciones proporcionales)',
        `${primaVacPct}% × ${pesos(vacProp)}`,
        vacProp * (primaVacPct / 100),
        'Art. 80 LFT'
      );
    }

    if ((e.diasSalarioPendiente || 0) > 0) {
      add(
        'prestacion',
        'Salario por días trabajados no pagados',
        `${e.diasSalarioPendiente} días × ${pesos(e.salarioDiario)}`,
        e.diasSalarioPendiente * e.salarioDiario,
        'Art. 87 LFT / contrato individual'
      );
    }
  }

  // ---- Totales ----
  const sumaGrupo = (grupo) => desglose.filter((d) => d.grupo === grupo).reduce((s, d) => s + d.monto, 0);
  const totalIndem = sumaGrupo('indemnizacion');
  const totalPrest = sumaGrupo('prestacion');
  const total = totalIndem + totalPrest;

  // ---- Supuestos ----
  const supuestos = [
    `Antigüedad: ${antiguedadAnios.toFixed(2)} años (${diasAntiguedad} días, del ${e.fechaIngreso} al ${e.fechaBaja}).`
  ];
  if (e.sdi.modo === 'calcular') {
    supuestos.push(
      `Salario diario integrado: ${pesos(sdi)} — factor ${factorIntegracion.toFixed(4)} ` +
      `(1 + ${diasAguinaldo} días de aguinaldo ÷ 365 + ${diasVac} días de vacaciones × ${primaVacPct}% ÷ 365), ` +
      `sobre un salario diario de ${pesos(e.salarioDiario)}.`
    );
  } else {
    supuestos.push(`Salario diario integrado (proporcionado por ti): ${pesos(sdi)}.`);
  }
  supuestos.push(
    `Salario mínimo de la zona ${e.zona === 'fronteraNorte' ? 'de la Frontera Norte' : 'general'}: ` +
    `${pesos(smZona)}/día. Tope de 2× = ${pesos(topeDiario)}/día.`
  );
  supuestos.push(
    'Tope de 2× salario mínimo: ' +
    (tope === 'todo'
      ? 'aplicado a TODAS las indemnizaciones y a la prima de antigüedad (lectura conservadora del Art. 486 LFT).'
      : tope === 'ninguno'
        ? 'NO aplicado a ningún concepto.'
        : 'aplicado SOLO a la prima de antigüedad (criterio de la SCJN; no limita la indemnización constitucional).')
  );

  // ---- Avisos ----
  const avisos = [];
  if (haySalariosVencidos) {
    avisos.push(
      'Los salarios vencidos son una estimación: dependen de cuánto dure realmente el juicio, dato que aún no se conoce. El monto real puede ser muy distinto.'
    );
  }
  avisos.push(
    'El tope de 2× salario mínimo (Arts. 485 y 486 LFT) es un tema discutido. La Suprema Corte ha resuelto que ese tope NO aplica a la indemnización constitucional (3 meses + 20 días por año), solo a la prima de antigüedad. Ajusta el interruptor según el criterio que sigas.'
  );
  if (esReinstalacion) {
    avisos.push(
      'En la reinstalación el trabajador conserva su empleo: no hay indemnización ni finiquito. Lo que procede son los salarios vencidos hasta que se cumpla la reinstalación.'
    );
  }
  if (causa === 'renuncia' && antiguedadAnios < 15) {
    avisos.push(
      'En una renuncia voluntaria, la prima de antigüedad solo procede con 15 años o más de servicio (Art. 162 fr. III LFT). Con la antigüedad capturada no se incluyó.'
    );
  }

  const descargo =
    'Este cálculo es una ESTIMACIÓN informativa basada en los datos que capturaste y en fórmulas generales de la Ley Federal del Trabajo. NO constituye asesoría jurídica ni sustituye el cálculo de un abogado, de un juez o de la autoridad laboral. Las cifras reales pueden variar según las prestaciones del contrato, convenios aplicables, los criterios del tribunal y las particularidades del caso.';

  return {
    tipo: 'resultado',
    supuestos,
    desglose: desglose.map((d) => ({ ...d, monto: Number(d.monto.toFixed(2)) })),
    totales: {
      indemnizaciones: Number(totalIndem.toFixed(2)),
      prestaciones: Number(totalPrest.toFixed(2)),
      total: Number(total.toFixed(2))
    },
    avisos,
    descargo
  };
}
