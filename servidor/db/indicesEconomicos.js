// indicesEconomicos.js
// -------------------------------------------------------------------
// Acceso a la tabla "indices_economicos" (ver conexion.js): los valores
// que usa la Calculadora Jurídica Financiera y que el administrador
// mantiene desde el panel (salario mínimo general y de la Frontera Norte,
// UMA, año).
//
// Es una tabla de UNA sola fila (id = 1); conexion.js se encarga de que
// exista. Aquí se devuelve/recibe siempre en camelCase, para que el resto
// del código no tenga que saber los nombres de columna.
// -------------------------------------------------------------------

import { db } from './conexion.js';

function aObjeto(fila) {
  return {
    anio: fila?.anio ?? 0,
    salarioMinimoGeneral: fila?.salario_minimo_general ?? 0,
    salarioMinimoFronteraNorte: fila?.salario_minimo_frontera_norte ?? 0,
    uma: fila?.uma ?? 0,
    actualizadoEn: fila?.actualizado_en ?? null
  };
}

export function obtenerIndicesEconomicos() {
  return aObjeto(db.prepare('SELECT * FROM indices_economicos WHERE id = 1').get());
}

export function guardarIndicesEconomicos({ anio, salarioMinimoGeneral, salarioMinimoFronteraNorte, uma }) {
  db.prepare(
    `UPDATE indices_economicos
       SET anio = ?,
           salario_minimo_general = ?,
           salario_minimo_frontera_norte = ?,
           uma = ?,
           actualizado_en = datetime('now')
     WHERE id = 1`
  ).run(anio, salarioMinimoGeneral, salarioMinimoFronteraNorte, uma);
  return obtenerIndicesEconomicos();
}
