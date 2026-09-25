# Precios nuevos, modalidades "Abogad@" / "Despacho" y beneficio de encuestas

Fecha: 2026-09-24.

## Qué cambió (textos legales)

- **Precios (Términos 3.3):** Fundadores $1,199 / Despacho $4,799 (sin fecha de
  vencimiento mientras la Plataforma opere); Co-fundadores $899 / Despacho
  $3,599 (48 meses); Mensual $49 / Despacho $199. Fundadores y Co-fundadores
  se reabren hasta el 31/10/2026 a las 21:00 (3.2).
- **"Vitalicio" → "sin fecha de vencimiento mientras la Plataforma opere"**
  (3.4 Bis): aclara que no es "de por vida" y que si la Plataforma cierra, el
  acceso concluye sin reembolso y el Responsable se deslinda.
- **Modalidades (3.3 Bis nueva):** cada plan tiene "Abogad@" (1 persona) y
  "Despacho" (5 usuarios); nombre completo "Plan - Modalidad". 3.7 aclara que
  "Abogad@" no acredita título/cédula y "Despacho" no exige despacho
  constituido. 2.2 usa los nombres nuevos y numera las cuentas (#1 a #5).
- **Beneficio de encuestas (6.1):** Abogad@: 10 encuestas = 1 mes a $39.
  Despacho: 1 mes a $179 con 10 encuestas (Cuenta única compartida) o 20
  sumando todas sus cuentas (Cuentas independientes). **Se cuenta por mes del
  calendario:** cada mes empieza en 0, un solo descuento por mes, y lo que
  se conteste después de reclamarlo ese mes no cuenta para nada. Aviso visible
  debajo del título de encuestas.html.
- **Aviso de Privacidad (Sección II):** nuevo dato "Plan, modalidad y conteo de
  encuestas para el beneficio" (solo números, no el contenido).

- **Barra y "Reclamar descuento" (encuestas.html):** las cuentas con Plan
  Mensual ven su avance ("6 de 10 encuestas"); al completarla aparece un
  mensaje y el botón "Reclamar descuento", que usa sus encuestas y deja un
  aviso en la burbuja de admin "Descuentos reclamados" (tabla
  `reclamos_descuento`). Bloqueado en los últimos 7 días de su mes o si ya
  venció; podrá reclamarlo al renovar. Cláusula 6.1 y Aviso actualizados.

- **Panel más compacto:** en "Usuarios y licencias" cada cuenta tiene un solo
  botón "Modificar" (abre un menú con todas las acciones) y hay un buscador.
  En cada tarjeta de Despacho: "+ Agregar cuenta" (correo existente o nuevo)
  y ✕ para sacar una cuenta. Se restauró el margen/ancho de las ventanas del
  panel, que se había perdido en un cambio anterior.
- **Días de corrección:** siguen existiendo para cambiar la respuesta, pero para
  el descuento cada encuesta cuenta desde que se envía (aclarado en 6.1, Aviso,
  encuestas.html y admin).

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `servidor/db/despachos.js` | Planes, Despachos, número de cuenta, conteo mensual de encuestas (cuentan desde que se envían) y reclamos de descuento. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `servidor/db/conexion.js` | Columnas `plan`, `despacho_id`, `despacho_puesto`, `encuestas_canjeadas` en `usuarios`; tabla nueva `despachos`. |
| `servidor/db/usuarios.js` | `listarUsuarios` devuelve las columnas nuevas. |
| `servidor.js` | `usuarioAJSON` incluye `plan`; `POST /api/admin/usuarios` acepta `plan`; rutas nuevas de planes, beneficios y despachos. |
| `servidor/renderizarMarkdownLegal.js` | Soporta sub-listas (un nivel de sangría). |
| `publico/admin.html` | Burbuja nueva "Despachos"; selector de plan en "Crear usuario"; estilos de las tarjetas de despacho. |
| `publico/encuestas.html`, `publico/Sistema/encuestasPrincipal.js` | Barra de avance, mensaje de meta cumplida y botón "Reclamar descuento". |
| `publico/Sistema/manejaAdmin.js` | Columna "Plan" + "Cambiar plan" + "Registrar beneficio ($39)" en usuarios; burbuja de Despachos; "Vitalicia" → "Sin vencimiento" en textos del panel. |
| `Terminos_y_Condiciones_Artonseley.md`, `Aviso_de_Privacidad_Artonseley.md` | Ver arriba. |

## Pendiente para el dueño

- Cambiar a mano, en admin → Encuestas, el texto "Te descontamos 20%" de la
  encuesta ya publicada (vive en la base de datos de producción, no en el código).
- Asignar el plan a las cuentas que ya existen ("Cambiar plan"); hoy todas
  salen como "Sin plan asignado".
