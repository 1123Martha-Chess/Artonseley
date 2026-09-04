// registro.js
// -------------------------------------------------------------------
// El "esqueleto" de la Calculadora Jurídica Financiera: un mapa
// tipo -> módulo. La ruta POST /api/calculadora/:tipo (en servidor.js)
// busca aquí el módulo que corresponde y le pasa los datos.
//
// Cada módulo de calculadora exporta:
//   validar(entradas)          -> string[]  (lista de errores; vacía = ok)
//   calcular(entradas, indices) -> objeto de resultado con { tipo: 'resultado', ... }
//
// Agregar una calculadora nueva (Fase 2: INPC/intereses; Fase 3: pensión
// alimenticia) = un archivo nuevo en esta carpeta + una línea en CALCULADORAS.
// -------------------------------------------------------------------

import * as indemnizacionLaboral from './indemnizacionLaboral.js';

export const CALCULADORAS = {
  'indemnizacion-laboral': indemnizacionLaboral
};

// Los índices económicos (salario mínimo, UMA) viven en la tabla
// "indices_economicos" y los edita el administrador desde el panel
// (ver servidor/db/indicesEconomicos.js y las rutas /api/admin/indices-economicos).
export { obtenerIndicesEconomicos } from '../db/indicesEconomicos.js';

// ¿Ya tiene el administrador cargados los valores vigentes? Mientras los
// salarios mínimos valgan 0, la calculadora no debe calcular (daría ceros).
export function indicesEconomicosListos(indices) {
  return !!indices && indices.salarioMinimoGeneral > 0 && indices.salarioMinimoFronteraNorte > 0;
}
