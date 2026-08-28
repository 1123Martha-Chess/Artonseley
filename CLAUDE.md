# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Artonseley: a Spanish-language Node/Express app that lets users search Mexican legal articles by keyword (with synonym matching via a dictionary) or by article number. All code, comments, and user-facing strings are in Spanish — match that when editing.

Not a git repository (no `.git` here). No test suite, no linter, no build step — just Node/Express.

## Commands

```
npm install   # first time, or after package.json changes
npm start     # runs `node servidor.js`, serves on http://localhost:3000 (and on the LAN IP, printed at startup)
```

There is no test, lint, or build tooling in this project.

## Architecture

The core design principle (see README.md) is a strict client/server split: **no legal data or search logic is ever sent to the browser.** The client only renders UI and calls the API.

- **`publico/`** — everything the browser can see: `index.html` (single-page UI, inline `<style>`), `documento.css`, static info pages, and `publico/Sistema/*.js` (client-side ES modules, loaded via `<script type="module">` from `buscadorPrincipal.js`). This JS has no access to the law data — it only does `fetch('/api/...')` and DOM rendering.
  - **Legal pages are NOT static files.** `/terminos-y-condiciones.html` and `/avisos-de-privacidad.html` are generated per-request by `servidor/paginasLegales.js` from two Markdown files at the repo root (`Terminos_y_Condiciones_Artonseley.md`, `Aviso_de_Privacidad_Artonseley.md`) via the tiny converter in `servidor/renderizarMarkdownLegal.js`. Edit the `.md` to change the text; there are no `.html` files for these two in `publico/`. Routes are registered before `express.static` in `servidor.js`.
- **`servidor/`** — everything that stays server-side: the law JSON data (`servidor/datos/`), the synonym dictionary, the letter/prefix matcher, the article-text lookup, and the search orchestration (`procesarBusqueda.js`).
- **`servidor.js`** — Express entry point. Serves `publico/` as static files and exposes:
  - `GET /api/documentos` — list of distinct document names (e.g. "Código Penal", "Ley de Amparo"), used to render the sector/document filter buttons.
  - `POST /api/buscar` — body `{ texto, documentos }` → `{ tipo: 'resultados', resultados, avisos }` or `{ tipo: 'mensaje', mensaje }`.
  - `POST /api/sugerencias` — body `{ mensaje, urgencia }`, appends to `servidor/datos/sugerencias.json` (read-modify-write of the whole file; not a database).
  - `GET /api/sugerencias` — dumps all stored suggestions as JSON (no auth — intended for the site owner to check manually).

### Search pipeline (`servidor/procesarBusqueda.js`)

1. If the whole input matches `PATRON_NUMERO_DE_ARTICULO` (optionally "artículo"/"art" + a number), it's treated as an article-number lookup → `LectorDeJSON.buscarArticuloPorNumero`.
2. Otherwise the input is split on commas into a list of search terms. Each term goes through `identificadorDeLetras.identificarLetras()`, which checks it against every concept + synonym in `diccionario.js`: exact match returns that one word, a partial match returns all dictionary words that start with those letters (typeahead-style), and no match falls back to using the term literally.
3. `LectorDeJSON.buscarArticulosPorGrupos()` finds, per term-group, every article whose `palabrasClave` matches (first tries an exact dictionary *concept* match via `buscarConceptoLegal`, then falls back to substring match against keywords), then intersects the results across groups (comma-separated terms are AND'd together).
4. Article text bodies are looked up separately by id via `lectorDeTextos.js` and formatted into `[Documento: "Número" Título] (coincide con: ...) texto`. The client (`buscadorPrincipal.js`) parses that bracketed header back out with a regex to split it into a card header/body — if you change the format string in `LectorDeJSON.formatearResultado`, update `PATRON_ENCABEZADO_RESULTADO` in `buscadorPrincipal.js` too.

### Law data (`servidor/datos/`)

Each law source is a pair of files: `articulos/<archivo>.json` (`{ articulos: [{ id, documento, numero, titulo, palabrasClave }] }`) and `textos/<archivoTextos>.json` (`{ textos: [{ id, texto }] }`), joined by `id`. Sources are registered in the `FUENTES` array at the top of `servidor/LectorDeJSON.js`.

**To add a new law:** drop its articles JSON in `servidor/datos/articulos/`, its texts JSON in `servidor/datos/textos/`, and add one entry to `FUENTES` — `{ archivo, archivoTextos, etiqueta }`. Both `leyesCache` and the per-file text cache in `lectorDeTextos.js` are populated lazily on first request and never invalidated, so the server must be restarted after adding/editing data files.

Note: `servidor/datos/articulos/leyesAguasNacionales.json` and `servidor/datos/textos/leyesAguasNacionales.json` exist on disk but are **not** registered in `FUENTES`, so that law is currently unreachable through search. Its articles file also uses a bare top-level array instead of the `{ articulos: [...] }` wrapper the rest of the pipeline expects — it would need reshaping before being wired in.

### Document/sector grouping (client-side)

`publico/Sistema/sistemaDeBotones.js` groups the document names returned by `/api/documentos` into UI "sectors" via the `SECTORES` map at the top of that file. Any document not listed there is auto-bucketed into an "Otros" sector, so nothing silently disappears — but new laws should still be added to `SECTORES` for proper grouping. Document names here must match the `documento` field in the articles JSON exactly (including accents/capitalization).

### Other client-side config points

- `publico/Sistema/manejaConfiguracion.js` — `OPCIONES` array drives the ⚙️ dropdown menu (links to static pages, or opens the suggestions panel).
- `publico/Sistema/manejaSugerencias.js` — `NOTIFICACIONES` array drives the 🔔 "modified laws" panel; this is hardcoded content, unrelated to the `/api/sugerencias` mailbox.
- `publico/Sistema/manejaBuzonSugerencias.js` — the actual suggestion-box UI (textarea + urgency level) that POSTs to `/api/sugerencias`.
