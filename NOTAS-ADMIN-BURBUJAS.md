# Panel de administración en "burbujas"

Fecha: 2026-09-24. **No subido a GitHub todavía.**

Objetivo (según el boceto `AdminAyudaPaClaudeCode.png`): cada apartado de
`admin.html` es un rectángulo de esquinas redondeadas que solo muestra ícono
+ título. Al tocarlo NO se abre ningún menú ni ventana: el mismo rectángulo
se extiende dentro de la rejilla (2 columnas y las filas que necesite) y
aparece el apartado; las demás burbujas se acomodan a su lado. Solo una
abierta a la vez; tocar su título (o la ✕, o Escape) la cierra.

## Archivos AGREGADOS

| Archivo | Qué es |
|---|---|
| `publico/Sistema/burbujasAdmin.js` | Convierte cada `section.tarjeta` en burbuja al cargar (el `<h2>` se vuelve botón; el resto del contenido se mete en `.cuerpo-burbuja`). Abre/cierra, y con un `ResizeObserver` calcula cuántas filas de la rejilla ocupa la abierta. Exporta `abrirBurbujaQueContiene(elemento)`. |

## Archivos MODIFICADOS

| Archivo | Cambio |
|---|---|
| `publico/admin.html` | `<main>` → `<main class="rejilla-burbujas">` (rejilla de 3 columnas, 2 en tablet, 1 en celular; filas fijas de 110px / 84px en celular; `grid-auto-flow: dense`). Cada `<section class="tarjeta">` lleva `data-icono="…"` (emoji). Estilos nuevos: `.cabecera-burbuja`, `.icono-burbuja`, `.cerrar-burbuja`, `.cuerpo-burbuja`, `section.tarjeta.abierta`. El contenido de cada apartado no cambió. |
| `publico/Sistema/manejaAdmin.js` | Importa `abrirBurbujaQueContiene` y la llama antes de cada `scrollIntoView` a un formulario (ej. "Reemplazar" en *Documentos legales cargados* abre la burbuja *Cargar o reemplazar*). |

## Para agregar un apartado nuevo al panel

Agregar otra `<section class="tarjeta" data-icono="🆕">` con su `<h2>` dentro
de `main.rejilla-burbujas`; se convierte en burbuja sola.
