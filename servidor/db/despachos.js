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
// DEFINITIVAS (ya pasaron sus 3 días de corrección). Cada beneficio que
// el admin registra "consume" respuestas (encuestas_canjeadas) para que
// no se canjeen dos veces:
//   - Abogad@: 1 encuesta definitiva = 1 mes del Plan Mensual a $39.
//   - Despacho, Cuenta única compartida: 10 encuestas = 1 mes a $179.
//   - Despacho, Cuentas independientes: 20 encuestas, SUMANDO las de
//     todas sus cuentas = 1 mes a $179.
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

export const ENCUESTAS_POR_BENEFICIO = { abogado: 1, compartida: 10, independientes: 20 };
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

function resumenEncuestas(contestadas, canjeadas, porBeneficio) {
  const disponibles = Math.max(0, contestadas - canjeadas);
  return {
    contestadas,
    canjeadas,
    disponibles,
    porBeneficio,
    beneficiosDisponibles: Math.floor(disponibles / porBeneficio)
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
// o pasa a otro), sus encuestas definitivas hasta ese momento se dan por
// "usadas" en la modalidad anterior: empieza de cero en la nueva. Así una
// cuenta no se lleva al salir las encuestas que su Despacho ya canjeó, ni
// mete a un Despacho las que ya tenía como Abogad@.
function reiniciarEncuestasDeCuenta(usuarioId) {
  db.prepare('UPDATE usuarios SET encuestas_canjeadas = ? WHERE id = ?')
    .run(contarEncuestasDefinitivas([usuarioId]), usuarioId);
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

// Registra que se aplicó un beneficio: consume las encuestas que ese
// beneficio exige. Devuelve un texto de error si todavía no le alcanzan.
export function registrarBeneficioDeUsuario(usuario) {
  if (usuario.despacho_id) return 'Esta cuenta es de un Despacho: el beneficio se registra desde la burbuja "Despachos".';
  const { beneficiosDisponibles } = planDeUsuarioAJSON(usuario).encuestas;
  if (beneficiosDisponibles < 1) return 'Esta cuenta todavía no tiene encuestas definitivas sin canjear.';
  db.prepare('UPDATE usuarios SET encuestas_canjeadas = encuestas_canjeadas + ? WHERE id = ?')
    .run(ENCUESTAS_POR_BENEFICIO.abogado, usuario.id);
  return null;
}

export function registrarBeneficioDeDespacho(id) {
  const despacho = buscarDespacho(id);
  if (!despacho) return 'Ese Despacho no existe.';
  const { encuestas } = despachoAJSON(despacho);
  if (encuestas.beneficiosDisponibles < 1) {
    return `Todavía no le alcanzan: necesita ${encuestas.porBeneficio} encuestas definitivas sin canjear y tiene ${encuestas.disponibles}.`;
  }
  db.prepare('UPDATE despachos SET encuestas_canjeadas = encuestas_canjeadas + ? WHERE id = ?')
    .run(encuestas.porBeneficio, id);
  return null;
}
