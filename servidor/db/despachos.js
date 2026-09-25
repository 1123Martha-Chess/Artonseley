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
// Beneficio de encuestas (Cláusula 6.1): solo cuentan las respuestas
// DEFINITIVAS (ya pasaron sus 3 días de corrección). Al juntar el mínimo
// se gana UN mes con descuento:
//   - Abogad@: 10 encuestas = 1 mes del Plan Mensual a $39.
//   - Despacho, Cuenta única compartida: 10 encuestas = 1 mes a $179.
//   - Despacho, Cuentas independientes: 20 encuestas, SUMANDO las de
//     todas sus cuentas = 1 mes a $179.
// Al registrar el beneficio se "queman" TODAS las respuestas que la
// cuenta/Despacho tenga en ese momento (encuestas_canjeadas = total),
// incluidas las que sobrepasaron el mínimo y las que todavía estaban en
// su plazo de corrección: nada de eso cuenta para otro descuento. Para el
// siguiente hay que juntar otro lote completo de respuestas NUEVAS.
// -------------------------------------------------------------------

import { db } from './conexion.js';
import { DIAS_PLAZO_EDICION_ENCUESTA } from './respuestasEncuestas.js';

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

// Respuestas definitivas de un grupo de cuentas: archivadas por el
// barrido, o cuyo plazo de corrección ya pasó aunque el barrido todavía
// no haya corrido.
export function contarEncuestasDefinitivas(usuarioIds) {
  if (usuarioIds.length === 0) return 0;
  const marcas = usuarioIds.map(() => '?').join(', ');
  return db.prepare(`
    SELECT COUNT(*) AS total FROM encuestas_respuestas
    WHERE usuario_id IN (${marcas})
      AND (migrada_en IS NOT NULL OR primera_respuesta_en <= datetime('now', ?))
  `).get(...usuarioIds, `-${DIAS_PLAZO_EDICION_ENCUESTA} days`).total;
}

// TODAS las respuestas (definitivas o no) de una cuenta: lo que se
// "quema" al registrar un beneficio o al cambiar de modalidad. Las que
// todavía estaban en su plazo de corrección también cuentan como usadas,
// para que al volverse definitivas no aparezcan como un lote nuevo.
function contarTodasLasEncuestas(usuarioId) {
  return db.prepare('SELECT COUNT(*) AS total FROM encuestas_respuestas WHERE usuario_id = ?').get(usuarioId).total;
}

function resumenEncuestas(contestadas, canjeadas, porBeneficio) {
  const disponibles = Math.max(0, contestadas - canjeadas);
  return {
    contestadas,
    canjeadas,
    disponibles,
    porBeneficio,
    // Nunca más de 1: lo que sobrepase el mínimo no da otro descuento.
    beneficiosDisponibles: disponibles >= porBeneficio ? 1 : 0
  };
}

export function buscarDespacho(id) {
  return db.prepare('SELECT * FROM despachos WHERE id = ?').get(id);
}

function miembrosDe(despachoId) {
  return db.prepare(`
    SELECT id, email, despacho_puesto, encuestas_canjeadas FROM usuarios
    WHERE despacho_id = ? AND eliminado_en IS NULL
    ORDER BY despacho_puesto
  `).all(despachoId);
}

// Cuando una cuenta cambia de modalidad (entra a un Despacho, sale de él
// o pasa a otro), todas sus encuestas hasta ese momento se dan por
// "usadas" en la modalidad anterior: empieza de cero en la nueva. Así una
// cuenta no se lleva al salir las encuestas que su Despacho ya canjeó, ni
// mete a un Despacho las que ya tenía como Abogad@.
function reiniciarEncuestasDeCuenta(usuarioId) {
  db.prepare('UPDATE usuarios SET encuestas_canjeadas = ? WHERE id = ?')
    .run(contarTodasLasEncuestas(usuarioId), usuarioId);
}

// Encuestas de un Despacho: las de cada cuenta desde que entró.
function encuestasDelDespacho(miembros) {
  return miembros.reduce(
    (total, m) => total + Math.max(0, contarEncuestasDefinitivas([m.id]) - m.encuestas_canjeadas),
    0
  );
}

function despachoAJSON(despacho) {
  const miembros = miembrosDe(despacho.id);
  return {
    id: despacho.id,
    nombre: despacho.nombre,
    tipo: despacho.tipo,
    tipoTexto: TIPOS_DESPACHO[despacho.tipo],
    plan: despacho.plan,
    planTexto: despacho.plan ? PLANES[despacho.plan] : null,
    maximoCuentas: MAXIMO_CUENTAS_POR_TIPO[despacho.tipo],
    miembros: miembros.map(m => ({ id: m.id, email: m.email, puesto: m.despacho_puesto })),
    encuestas: resumenEncuestas(
      encuestasDelDespacho(miembros),
      despacho.encuestas_canjeadas,
      ENCUESTAS_POR_BENEFICIO[despacho.tipo]
    ),
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
  miembrosDe(id).forEach(m => reiniciarEncuestasDeCuenta(m.id));
  db.prepare(`
    UPDATE usuarios SET plan = ?, despacho_id = NULL, despacho_puesto = NULL,
      limite_sesiones = CASE WHEN limite_sesiones = ? THEN NULL ELSE limite_sesiones END
    WHERE despacho_id = ?
  `).run(despacho.plan, SESIONES_CUENTA_COMPARTIDA, id);
  db.prepare('DELETE FROM despachos WHERE id = ?').run(id);
}

// Asigna el plan de una cuenta. Con despachoId la mete a ese Despacho en
// el primer número libre (#1 a #5); sin él, la deja como Abogad@ con
// `plan`. Devuelve un texto de error si no se puede (Despacho lleno).
export function asignarPlanAUsuario(usuario, { plan, despachoId }) {
  if (!despachoId) {
    const veniaDeCompartida = usuario.despacho_id
      && buscarDespacho(usuario.despacho_id)?.tipo === 'compartida';
    if (usuario.despacho_id) reiniciarEncuestasDeCuenta(usuario.id);
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
  reiniciarEncuestasDeCuenta(usuario.id);
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
  return {
    modalidad: 'abogado',
    plan: usuario.plan,
    despachoId: null,
    puesto: null,
    nombreCompleto: usuario.plan ? `${PLANES[usuario.plan]} - Abogad@` : 'Sin plan asignado',
    detalle: null,
    encuestas: resumenEncuestas(
      contarEncuestasDefinitivas([usuario.id]),
      usuario.encuestas_canjeadas ?? 0,
      ENCUESTAS_POR_BENEFICIO.abogado
    )
  };
}

// Registra que se aplicó un beneficio: "quema" TODAS las respuestas que
// la cuenta tenga en este momento (también las que sobrepasaron el mínimo
// y las que siguen en su plazo de corrección), así que para otro descuento
// tendrá que juntar un lote completo de respuestas nuevas. Devuelve un
// texto de error si todavía no le alcanza.
export function registrarBeneficioDeUsuario(usuario) {
  if (usuario.despacho_id) return 'Esta cuenta es de un Despacho: el beneficio se registra desde la burbuja "Despachos".';
  const { beneficiosDisponibles, porBeneficio, disponibles } = planDeUsuarioAJSON(usuario).encuestas;
  if (beneficiosDisponibles < 1) {
    return `Todavía no le alcanza: necesita ${porBeneficio} encuestas definitivas nuevas y tiene ${disponibles}.`;
  }
  db.prepare('UPDATE usuarios SET encuestas_canjeadas = ? WHERE id = ?')
    .run(contarTodasLasEncuestas(usuario.id), usuario.id);
  return null;
}

export function registrarBeneficioDeDespacho(id) {
  const despacho = buscarDespacho(id);
  if (!despacho) return 'Ese Despacho no existe.';
  const { encuestas } = despachoAJSON(despacho);
  if (encuestas.beneficiosDisponibles < 1) {
    return `Todavía no le alcanza: necesita ${encuestas.porBeneficio} encuestas definitivas nuevas y tiene ${encuestas.disponibles}.`;
  }
  // Mismo criterio que encuestasDelDespacho, pero con TODAS las respuestas
  // de cada cuenta desde que entró, para quemarlas todas.
  const totalDelDespacho = miembrosDe(id).reduce(
    (total, m) => total + Math.max(0, contarTodasLasEncuestas(m.id) - m.encuestas_canjeadas),
    0
  );
  db.prepare('UPDATE despachos SET encuestas_canjeadas = ? WHERE id = ?').run(totalDelDespacho, id);
  return null;
}

// -------------------------------------------------------------------
// Lado del USUARIO (encuestas.html): barra de avance hacia el descuento y
// botón "Reclamar descuento". Solo aplica a cuentas con Plan Mensual
// (Abogad@ o Despacho), porque el descuento es sobre su siguiente mes.
// Reclamar "quema" las encuestas igual que registrarBeneficio* y deja un
// registro en reclamos_descuento, que el admin ve como notificación en la
// burbuja "Descuentos reclamados" hasta marcarlo como aplicado.
//
// El botón se bloquea en los últimos DIAS_BLOQUEO_RECLAMO días del mes
// de la cuenta (o si ya venció): así el admin tiene al menos una semana
// para aplicarlo antes de cobrar la renovación. Podrá reclamarlo en
// cuanto renueve.
// -------------------------------------------------------------------

export const DIAS_BLOQUEO_RECLAMO = 7;
export const PRECIO_NORMAL_MENSUAL = { abogado: 49, despacho: 199 };

// Respuestas de una cuenta que todavía están en su plazo de corrección y
// que no se han "quemado": se sumarán a la barra cuando sean definitivas.
function pendientesDeCuenta(usuarioId, canjeadas) {
  const todas = Math.max(0, contarTodasLasEncuestas(usuarioId) - canjeadas);
  const definitivas = Math.max(0, contarEncuestasDefinitivas([usuarioId]) - canjeadas);
  return todas - definitivas;
}

function reclamoPendienteDe({ usuarioId, despachoId }) {
  const fila = despachoId
    ? db.prepare("SELECT * FROM reclamos_descuento WHERE despacho_id = ? AND estado = 'pendiente' ORDER BY creado_en DESC").get(despachoId)
    : db.prepare("SELECT * FROM reclamos_descuento WHERE usuario_id = ? AND despacho_id IS NULL AND estado = 'pendiente' ORDER BY creado_en DESC").get(usuarioId);
  return fila ? { precio: fila.precio, creadoEn: fila.creado_en } : null;
}

export function progresoDescuentoDeUsuario(usuario) {
  const plan = planDeUsuarioAJSON(usuario);
  if (plan.plan !== 'mensual') return { aplica: false };

  let encuestas, pendientes, despachoId = null, textoGrupo = null;
  if (plan.modalidad === 'despacho') {
    const despacho = despachoAJSON(buscarDespacho(plan.despachoId));
    encuestas = despacho.encuestas;
    despachoId = despacho.id;
    pendientes = miembrosDe(despacho.id).reduce(
      (total, m) => total + pendientesDeCuenta(m.id, m.encuestas_canjeadas), 0
    );
    textoGrupo = despacho.tipo === 'independientes'
      ? 'sumando las de todas las cuentas de tu Despacho'
      : 'contestadas desde la cuenta de tu Despacho';
  } else {
    encuestas = plan.encuestas;
    pendientes = pendientesDeCuenta(usuario.id, usuario.encuestas_canjeadas ?? 0);
  }

  const diasRestantes = (new Date(usuario.licencia_vence_en) - new Date()) / (24 * 60 * 60 * 1000);
  let motivoBloqueo = null;
  if (diasRestantes <= 0) {
    motivoBloqueo = 'Tu mes ya terminó: podrás reclamar tu descuento en cuanto renueves.';
  } else if (diasRestantes < DIAS_BLOQUEO_RECLAMO) {
    motivoBloqueo = `Faltan menos de ${DIAS_BLOQUEO_RECLAMO} días para que termine tu mes: podrás reclamar tu descuento en cuanto renueves.`;
  }

  const completado = encuestas.beneficiosDisponibles > 0;
  return {
    aplica: true,
    modalidad: plan.modalidad,
    textoGrupo,
    contestadas: Math.min(encuestas.disponibles, encuestas.porBeneficio),
    excedente: Math.max(0, encuestas.disponibles - encuestas.porBeneficio),
    minimo: encuestas.porBeneficio,
    pendientes,
    precio: PRECIO_BENEFICIO[plan.modalidad],
    precioNormal: PRECIO_NORMAL_MENSUAL[plan.modalidad],
    completado,
    puedeReclamar: completado && !motivoBloqueo,
    motivoBloqueo: completado ? motivoBloqueo : null,
    reclamoPendiente: reclamoPendienteDe({ usuarioId: usuario.id, despachoId })
  };
}

export function reclamarDescuento(usuario) {
  const progreso = progresoDescuentoDeUsuario(usuario);
  if (!progreso.aplica) return { error: 'El descuento por encuestas aplica al Plan Mensual.' };
  if (!progreso.completado) {
    return { error: `Todavía no llegas: llevas ${progreso.contestadas} de ${progreso.minimo} encuestas.` };
  }
  if (progreso.motivoBloqueo) return { error: progreso.motivoBloqueo };

  const encuestasUsadas = progreso.contestadas + progreso.excedente;
  const error = progreso.modalidad === 'despacho'
    ? registrarBeneficioDeDespacho(usuario.despacho_id)
    : registrarBeneficioDeUsuario(usuario);
  if (error) return { error };

  db.prepare(`
    INSERT INTO reclamos_descuento (usuario_id, despacho_id, modalidad, precio, encuestas_usadas)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    usuario.id,
    progreso.modalidad === 'despacho' ? usuario.despacho_id : null,
    progreso.modalidad,
    progreso.precio,
    encuestasUsadas
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

export function eliminarReclamoDescuento(id) {
  db.prepare('DELETE FROM reclamos_descuento WHERE id = ?').run(id);
}
