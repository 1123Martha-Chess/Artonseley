// despachos.js
// -------------------------------------------------------------------
// Plan y modalidad de cada cuenta, y los "Despachos" (planes de 5
// usuarios). Ver la Cláusula 2.2 (modalidades del Despacho), 3.3 Bis
// (nombres "Plan - Modalidad") y 6.1 (beneficio por contestar encuestas)
// de los Términos.
//
// - Una cuenta SIN despacho_id es "Abogad@": su plan vive en
//   usuarios.plan.
// - Una cuenta CON despacho_id es parte de ese Despacho: su plan es el
//   del Despacho, y despacho_puesto es su número (#1 a #5).
//
// Beneficio de encuestas (Cláusula 6.1): la meta se cumple DENTRO de un
// mes del calendario (hora del centro de México) y cada mes empieza en 0:
//   - Abogad@: 10 encuestas en el mes = 1 mes del Plan Mensual a $39.
//   - Despacho, Cuenta única compartida: 10 encuestas en el mes = $179.
//   - Despacho, Cuentas independientes: 20 encuestas en el mes, SUMANDO
//     las de todas sus cuentas = $179.
// Solo cuentan las encuestas contestadas por primera vez en el mes en
// curso (primera_respuesta_en), así que lo que no se completó en un mes se
// pierde al empezar el siguiente. Una vez reclamado el descuento en un mes,
// las demás encuestas de ESE mes ya no cuentan para nada: la siguiente meta
// se junta con las del mes siguiente. Si la cuenta cambia de modalidad a
// media mes, solo cuentan las que conteste desde ese momento
// (usuarios.modalidad_desde).
//
// Las columnas encuestas_canjeadas (usuarios y despachos) son de una
// versión anterior de esta regla y ya no se usan; se conservan por la
// convención del proyecto de no borrar columnas.
// -------------------------------------------------------------------

import { db } from './conexion.js';

export const PLANES = {
  fundadores: 'Fundadores',
  cofundadores: 'Co-Fundadores',
  mensual: 'Mensual',
  prueba: 'Prueba gratuita'
};

export const TIPOS_DESPACHO = {
  compartida: 'Cuenta única compartida',
  independientes: 'Cuentas independientes'
};

export const MAXIMO_CUENTAS_POR_TIPO = { compartida: 1, independientes: 5 };
export const SESIONES_CUENTA_COMPARTIDA = 10;

export const ENCUESTAS_POR_BENEFICIO = { abogado: 10, compartida: 10, independientes: 20 };
export const PRECIO_BENEFICIO = { abogado: 39, despacho: 179 };

export function planValido(plan) {
  return plan === null || Object.hasOwn(PLANES, plan);
}

// -------------------------------------------------------------------
// Mes del calendario en hora del centro de México (UTC-6, sin horario de
// verano desde 2022). Las fechas de SQLite se guardan en UTC con el
// formato 'AAAA-MM-DD HH:MM:SS', así que el inicio del mes se devuelve en
// ese mismo formato para poder compararlo directo en SQL.
// -------------------------------------------------------------------

const DESFASE_MEXICO_MS = 6 * 60 * 60 * 1000;
const NOMBRES_MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function aFechaSQLite(fecha) {
  return fecha.toISOString().slice(0, 19).replace('T', ' ');
}

export function mesActualMexico(ahora = new Date()) {
  const enMexico = new Date(ahora.getTime() - DESFASE_MEXICO_MS);
  const anio = enMexico.getUTCFullYear();
  const mes = enMexico.getUTCMonth();
  return {
    inicio: aFechaSQLite(new Date(Date.UTC(anio, mes, 1) + DESFASE_MEXICO_MS)),
    nombre: `${NOMBRES_MESES[mes]} de ${anio}`,
    nombreCorto: NOMBRES_MESES[mes],
    nombreSiguiente: NOMBRES_MESES[(mes + 1) % 12]
  };
}

// Encuestas que una cuenta contestó (por primera vez) este mes, desde que
// está en su modalidad actual.
function contarEncuestasDelMes(usuario, inicioMes) {
  const desde = usuario.modalidad_desde && usuario.modalidad_desde > inicioMes
    ? usuario.modalidad_desde
    : inicioMes;
  return db.prepare(
    'SELECT COUNT(*) AS total FROM encuestas_respuestas WHERE usuario_id = ? AND primera_respuesta_en >= ?'
  ).get(usuario.id, desde).total;
}

// Descuento ya reclamado ESTE mes (por la cuenta Abogad@ o por cualquier
// cuenta del Despacho).
function reclamoDelMes({ usuarioId, despachoId }, inicioMes) {
  return despachoId
    ? db.prepare('SELECT * FROM reclamos_descuento WHERE despacho_id = ? AND creado_en >= ? ORDER BY creado_en DESC').get(despachoId, inicioMes)
    : db.prepare('SELECT * FROM reclamos_descuento WHERE usuario_id = ? AND despacho_id IS NULL AND creado_en >= ? ORDER BY creado_en DESC').get(usuarioId, inicioMes);
}

// Resumen para pintar (admin y usuario): cuántas lleva este mes, cuál es
// la meta y si ya la reclamó.
function resumenEncuestas(contestadas, porBeneficio, reclamo) {
  return {
    contestadas,
    porBeneficio,
    completado: contestadas >= porBeneficio,
    reclamadoEsteMes: !!reclamo,
    // Solo se puede reclamar una vez por mes, y solo con la meta cumplida.
    beneficiosDisponibles: !reclamo && contestadas >= porBeneficio ? 1 : 0
  };
}

export function buscarDespacho(id) {
  return db.prepare('SELECT * FROM despachos WHERE id = ?').get(id);
}

function miembrosDe(despachoId) {
  return db.prepare(`
    SELECT id, email, despacho_puesto, modalidad_desde FROM usuarios
    WHERE despacho_id = ? AND eliminado_en IS NULL
    ORDER BY despacho_puesto
  `).all(despachoId);
}

// Al cambiar de modalidad (entrar a un Despacho, salir de él o pasar a
// otro), las encuestas de este mes contestadas antes del cambio se quedan
// en la modalidad anterior: en la nueva solo cuentan las de ahora en
// adelante.
function marcarCambioDeModalidad(usuarioId) {
  db.prepare("UPDATE usuarios SET modalidad_desde = datetime('now') WHERE id = ?").run(usuarioId);
}

function encuestasDelDespachoEsteMes(despacho, inicioMes) {
  const contestadas = miembrosDe(despacho.id).reduce((total, m) => total + contarEncuestasDelMes(m, inicioMes), 0);
  return resumenEncuestas(contestadas, ENCUESTAS_POR_BENEFICIO[despacho.tipo], reclamoDelMes({ despachoId: despacho.id }, inicioMes));
}

function despachoAJSON(despacho) {
  const miembros = miembrosDe(despacho.id);
  const mes = mesActualMexico();
  return {
    id: despacho.id,
    nombre: despacho.nombre,
    tipo: despacho.tipo,
    tipoTexto: TIPOS_DESPACHO[despacho.tipo],
    plan: despacho.plan,
    planTexto: despacho.plan ? PLANES[despacho.plan] : null,
    maximoCuentas: MAXIMO_CUENTAS_POR_TIPO[despacho.tipo],
    miembros: miembros.map(m => ({ id: m.id, email: m.email, puesto: m.despacho_puesto })),
    encuestas: encuestasDelDespachoEsteMes(despacho, mes.inicio),
    mesActual: mes.nombreCorto,
    precioBeneficio: PRECIO_BENEFICIO.despacho,
    creadoEn: despacho.creado_en
  };
}

export function listarDespachos() {
  return db.prepare('SELECT * FROM despachos ORDER BY creado_en DESC').all().map(despachoAJSON);
}

export function crearDespacho({ nombre, tipo, plan }) {
  const info = db.prepare('INSERT INTO despachos (nombre, tipo, plan) VALUES (?, ?, ?)').run(nombre, tipo, plan);
  return despachoAJSON(buscarDespacho(info.lastInsertRowid));
}

// El tipo NO se puede cambiar (Cláusula 2.2: no pueden alternarse las
// modalidades después de contratar), por eso aquí solo nombre y plan.
export function actualizarDespacho(id, { nombre, plan }) {
  db.prepare('UPDATE despachos SET nombre = ?, plan = ? WHERE id = ?').run(nombre, plan, id);
  return despachoAJSON(buscarDespacho(id));
}

// Las cuentas que tenía pasan a Abogad@ conservando el plan del
// Despacho, para no dejarlas "sin plan" por accidente.
export function eliminarDespacho(id) {
  const despacho = buscarDespacho(id);
  if (!despacho) return;
  miembrosDe(id).forEach(m => marcarCambioDeModalidad(m.id));
  db.prepare(`
    UPDATE usuarios SET plan = ?, despacho_id = NULL, despacho_puesto = NULL,
      limite_sesiones = CASE WHEN limite_sesiones = ? THEN NULL ELSE limite_sesiones END
    WHERE despacho_id = ?
  `).run(despacho.plan, SESIONES_CUENTA_COMPARTIDA, id);
  db.prepare('DELETE FROM despachos WHERE id = ?').run(id);
}

// Texto de error si el Despacho ya no tiene lugar (o no existe), null si
// sí cabe otra cuenta. Se revisa ANTES de crear una cuenta nueva para el
// Despacho, para no dejar una cuenta creada que luego no se pudo meter.
export function errorSiDespachoLleno(despachoId) {
  const despacho = buscarDespacho(despachoId);
  if (!despacho) return 'Ese Despacho no existe.';
  if (miembrosDe(despacho.id).length < MAXIMO_CUENTAS_POR_TIPO[despacho.tipo]) return null;
  return despacho.tipo === 'compartida'
    ? `"${despacho.nombre}" es de Cuenta única compartida y ya tiene su cuenta.`
    : `"${despacho.nombre}" ya tiene sus 5 cuentas.`;
}

// Asigna el plan de una cuenta. Con despachoId la mete a ese Despacho en
// el primer número libre (#1 a #5); sin él, la deja como Abogad@ con
// `plan`. Devuelve un texto de error si no se puede (Despacho lleno).
export function asignarPlanAUsuario(usuario, { plan, despachoId }) {
  if (!despachoId) {
    const veniaDeCompartida = usuario.despacho_id
      && buscarDespacho(usuario.despacho_id)?.tipo === 'compartida';
    if (usuario.despacho_id) marcarCambioDeModalidad(usuario.id);
    db.prepare(`
      UPDATE usuarios SET plan = ?, despacho_id = NULL, despacho_puesto = NULL,
        limite_sesiones = CASE WHEN ? AND limite_sesiones = ? THEN NULL ELSE limite_sesiones END
      WHERE id = ?
    `).run(plan, veniaDeCompartida ? 1 : 0, SESIONES_CUENTA_COMPARTIDA, usuario.id);
    return null;
  }

  const despacho = buscarDespacho(despachoId);
  if (!despacho) return 'Ese Despacho no existe.';
  if (usuario.despacho_id === despacho.id) return null;

  const ocupados = new Set(miembrosDe(despacho.id).map(m => m.despacho_puesto));
  const maximo = MAXIMO_CUENTAS_POR_TIPO[despacho.tipo];
  let puesto = null;
  for (let n = 1; n <= maximo; n++) {
    if (!ocupados.has(n)) { puesto = n; break; }
  }
  if (puesto === null) {
    return despacho.tipo === 'compartida'
      ? `"${despacho.nombre}" es de Cuenta única compartida y ya tiene su cuenta.`
      : `"${despacho.nombre}" ya tiene sus 5 cuentas.`;
  }

  // La Cuenta única compartida tiene hasta 10 sesiones simultáneas
  // (Cláusulas 2.2 y 2.7). Subir el límite no cierra sesiones.
  const limite = despacho.tipo === 'compartida' ? SESIONES_CUENTA_COMPARTIDA : usuario.limite_sesiones;
  marcarCambioDeModalidad(usuario.id);
  db.prepare(`
    UPDATE usuarios SET plan = NULL, despacho_id = ?, despacho_puesto = ?, limite_sesiones = ? WHERE id = ?
  `).run(despacho.id, puesto, limite, usuario.id);
  return null;
}

// Lo que el panel necesita para pintar el plan de una cuenta, ej.
// "Mensual - Despacho" + "García y Asociados · cuenta #2 de 5".
export function planDeUsuarioAJSON(usuario) {
  if (usuario.despacho_id) {
    const despacho = buscarDespacho(usuario.despacho_id);
    if (despacho) {
      const planTexto = despacho.plan ? PLANES[despacho.plan] : 'Sin plan';
      const detalle = despacho.tipo === 'compartida'
        ? `${despacho.nombre} · cuenta única compartida`
        : `${despacho.nombre} · cuenta #${usuario.despacho_puesto} de 5`;
      return {
        modalidad: 'despacho',
        plan: despacho.plan,
        despachoId: despacho.id,
        puesto: usuario.despacho_puesto,
        nombreCompleto: `${planTexto} - Despacho`,
        detalle,
        encuestas: null
      };
    }
  }
  const mes = mesActualMexico();
  return {
    modalidad: 'abogado',
    plan: usuario.plan,
    despachoId: null,
    puesto: null,
    nombreCompleto: usuario.plan ? `${PLANES[usuario.plan]} - Abogad@` : 'Sin plan asignado',
    detalle: null,
    mesActual: mes.nombreCorto,
    encuestas: resumenEncuestas(
      contarEncuestasDelMes(usuario, mes.inicio),
      ENCUESTAS_POR_BENEFICIO.abogado,
      reclamoDelMes({ usuarioId: usuario.id }, mes.inicio)
    )
  };
}

// -------------------------------------------------------------------
// Lado del USUARIO (encuestas.html): barra de avance del mes hacia el
// descuento y botón "Reclamar descuento". Solo aplica a cuentas con Plan
// Mensual (Abogad@ o Despacho), porque el descuento es sobre su siguiente
// mes. Reclamar deja un registro en reclamos_descuento, que el admin ve
// como notificación en la burbuja "Descuentos reclamados" hasta marcarlo
// como aplicado; y hace que el resto de ese mes ya no cuente.
//
// El botón se bloquea en los últimos DIAS_BLOQUEO_RECLAMO días del
// periodo de acceso de la cuenta (o si ya venció): así el admin tiene al
// menos una semana para aplicarlo antes de cobrar la renovación.
// -------------------------------------------------------------------

export const DIAS_BLOQUEO_RECLAMO = 7;
export const PRECIO_NORMAL_MENSUAL = { abogado: 49, despacho: 199 };

function reclamoPendienteDe({ usuarioId, despachoId }) {
  const fila = despachoId
    ? db.prepare("SELECT * FROM reclamos_descuento WHERE despacho_id = ? AND estado = 'pendiente' ORDER BY creado_en DESC").get(despachoId)
    : db.prepare("SELECT * FROM reclamos_descuento WHERE usuario_id = ? AND despacho_id IS NULL AND estado = 'pendiente' ORDER BY creado_en DESC").get(usuarioId);
  return fila ? { precio: fila.precio, creadoEn: fila.creado_en } : null;
}

export function progresoDescuentoDeUsuario(usuario) {
  const plan = planDeUsuarioAJSON(usuario);
  if (plan.plan !== 'mensual') return { aplica: false };

  const mes = mesActualMexico();
  let encuestas, despachoId = null, textoGrupo = null;
  if (plan.modalidad === 'despacho') {
    const despacho = buscarDespacho(plan.despachoId);
    encuestas = encuestasDelDespachoEsteMes(despacho, mes.inicio);
    despachoId = despacho.id;
    textoGrupo = despacho.tipo === 'independientes'
      ? 'sumando las de todas las cuentas de tu Despacho'
      : 'contestadas desde la cuenta de tu Despacho';
  } else {
    encuestas = plan.encuestas;
  }

  const diasRestantes = (new Date(usuario.licencia_vence_en) - new Date()) / (24 * 60 * 60 * 1000);
  let motivoBloqueo = null;
  if (diasRestantes <= 0) {
    motivoBloqueo = 'Tu periodo de acceso ya terminó: podrás reclamar tu descuento en cuanto renueves, siempre que sea dentro de este mismo mes.';
  } else if (diasRestantes < DIAS_BLOQUEO_RECLAMO) {
    motivoBloqueo = `Faltan menos de ${DIAS_BLOQUEO_RECLAMO} días para que termine tu periodo de acceso: podrás reclamar tu descuento en cuanto renueves, siempre que sea dentro de este mismo mes.`;
  }

  return {
    aplica: true,
    modalidad: plan.modalidad,
    textoGrupo,
    mesActual: mes.nombreCorto,
    mesSiguiente: mes.nombreSiguiente,
    contestadas: Math.min(encuestas.contestadas, encuestas.porBeneficio),
    minimo: encuestas.porBeneficio,
    precio: PRECIO_BENEFICIO[plan.modalidad],
    precioNormal: PRECIO_NORMAL_MENSUAL[plan.modalidad],
    completado: encuestas.completado && !encuestas.reclamadoEsteMes,
    reclamadoEsteMes: encuestas.reclamadoEsteMes,
    puedeReclamar: encuestas.beneficiosDisponibles > 0 && !motivoBloqueo,
    motivoBloqueo: encuestas.beneficiosDisponibles > 0 ? motivoBloqueo : null,
    reclamoPendiente: reclamoPendienteDe({ usuarioId: usuario.id, despachoId })
  };
}

export function reclamarDescuento(usuario) {
  const progreso = progresoDescuentoDeUsuario(usuario);
  if (!progreso.aplica) return { error: 'El descuento por encuestas aplica al Plan Mensual.' };
  if (progreso.reclamadoEsteMes) return { error: `Ya se reclamó el descuento de ${progreso.mesActual}.` };
  if (!progreso.completado) {
    return { error: `Todavía no llegas: llevas ${progreso.contestadas} de ${progreso.minimo} encuestas este mes.` };
  }
  if (progreso.motivoBloqueo) return { error: progreso.motivoBloqueo };

  db.prepare(`
    INSERT INTO reclamos_descuento (usuario_id, despacho_id, modalidad, precio, encuestas_usadas)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    usuario.id,
    progreso.modalidad === 'despacho' ? usuario.despacho_id : null,
    progreso.modalidad,
    progreso.precio,
    progreso.contestadas
  );
  return { error: null };
}

// Lado del ADMIN: la "notificación interna" de cada descuento reclamado.
export function listarReclamosDescuento() {
  return db.prepare(`
    SELECT r.*, u.email, u.licencia_vence_en, d.nombre AS despacho_nombre
    FROM reclamos_descuento r
    JOIN usuarios u ON u.id = r.usuario_id
    LEFT JOIN despachos d ON d.id = r.despacho_id
    ORDER BY (r.estado = 'pendiente') DESC, r.creado_en DESC
  `).all().map(r => ({
    id: r.id,
    email: r.email,
    modalidad: r.modalidad,
    despachoNombre: r.despacho_nombre,
    precio: r.precio,
    encuestasUsadas: r.encuestas_usadas,
    estado: r.estado,
    creadoEn: r.creado_en,
    aplicadoEn: r.aplicado_en,
    licenciaVenceEn: r.licencia_vence_en
  }));
}

export function marcarReclamoAplicado(id) {
  db.prepare("UPDATE reclamos_descuento SET estado = 'aplicado', aplicado_en = datetime('now') WHERE id = ?").run(id);
}

// Ojo: borrar un aviso de ESTE mes "libera" el mes, y esa cuenta podría
// volver a reclamarlo. Por eso el panel lo advierte antes de borrar.
export function eliminarReclamoDescuento(id) {
  db.prepare('DELETE FROM reclamos_descuento WHERE id = ?').run(id);
}
