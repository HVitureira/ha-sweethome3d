# SweetHome3D HA Add-on (`ha-sweethome3d`) — Agent Guide (Tier 0 Index)

Home Assistant Ingress add-on (Alpine + Nginx + PHP 8.2 + s6-overlay, port 8099) built as a **non-invasive fork/augmentation of upstream SweetHome3D JS (`7.5.2`)**, pairing its compressed/minified core bundle with a **Vue 3.5 + TypeScript 5.9 + Pinia + Vite 6** overlay (`www-vue/`), OBJ/JSON export pipeline for Unity, embedded Unity WebGL visualizer (`/unity-visualizer/`), and Lovelace dashboard integration (`LovelaceWs.php`).

## Commands (macOS & Windows)

| Action | macOS / Linux | Windows (PowerShell) |
| :--- | :--- | :--- |
| AI & CodeGraph bootstrap | `./scripts/ai-setup.sh` | `.\scripts\ai-setup.ps1` |
| Dev server (no Docker needed) | `cd www-vue && npm run dev` | `cd www-vue; npm run dev` |
| Vue type-check & build | `cd www-vue && npm run type-check && npm run build` | `cd www-vue; npm run type-check; npm run build` |
| Verify addon & assets | `./scripts/verify.sh` | `.\scripts\verify.ps1` |
| Audit AI setup & budgets | `python3 scripts/check-ai-setup.py` | `python scripts/check-ai-setup.py` |
| Package for Docker / release | `./scripts/setup.sh` | `.\scripts\deploy-local.ps1` |
| Local Docker test | `docker-compose up --build` | `docker-compose up --build` |

## Non-Negotiable Invariants

- **Fork & minified core JS (`sweethome3d.min.js`, ~2.5 MB)**: Never modify `sweethome3d/www/lib/sweethome3d.min.js` or raw-grep it directly into context (huge single lines). To inspect internal SH3D patterns/APIs, pretty-print/unminify a temporary copy outside Git (`/tmp` or `$env:TEMP`) and search bounded slices only; extend externally via `www-vue/` or custom JS files.
- **UI fields belong in `www-vue/`** (`FurnitureDialogEnhancer.vue` via `<Teleport>`), never legacy inline HTML in `sweethome3d/www/index.html`.
- **Keep `#home-pane` CSS & hide method**: `position: absolute; top: 40px` and `visibility: hidden` (never `display: none`). Keep `UnityView` mounted via `v-show` in `App.vue` (never `<KeepAlive>`).
- **3-copy Unity `index.html` rule**: True source is `../smart-home-visualizer/Assets/WebGLTemplates/SmartHome3D/index.html`; `unity-build/index.html` feeds dev, `sweethome3d/www/unity-visualizer/index.html` feeds Docker. Never patch only (2) or (3).
- **Lovelace is WebSocket-only**: Never call HA REST endpoints for `lovelace/*`; always use `sweethome3d/www/lib/LovelaceWs.php`. Keep `clear_env = no` in `php82/php-fpm.conf` so `SUPERVISOR_TOKEN` is preserved.
- **LF line endings**: All `.sh` and s6 `run`/`finish` container scripts MUST use LF (`\n`).
- **Thesis evolution log**: After a genuine architectural evolution or core design trade-off (not routine bugfixes), append a 6-line entry to [docs/ai/thesis-evolution-log.md](docs/ai/thesis-evolution-log.md) (`scripts/check-thesis-impact.py` checks automatically on `verify`, `git push`, and PRs).

## Code Navigation (CodeGraph MCP)

Prefer **CodeGraph MCP** (`codegraph_explore`, symbol/caller/impact lookup) over brute-force grep for `www-vue/src/`, PHP endpoints, and custom export JS (`codegraph.json` excludes `sweethome3d.min.js`, `node_modules/`, and built bundles). Run `codegraph sync` after refactors.

## Progressive Disclosure Routing (Read On Demand)

| Task / Topic | Read This File |
| :--- | :--- |
| Add-on practices, fork strategy & unminifying `sweethome3d.min.js` to temp | [docs/ai/addon-practices.md](docs/ai/addon-practices.md) |
| Vue 3 overlay, routing, Pinia stores, `<Teleport>`, `localStorage` bridge | [docs/ai/vue-overlay.md](docs/ai/vue-overlay.md) & [www-vue/AGENTS.md](www-vue/AGENTS.md) |
| OBJ/MTL/JSON export pipeline, coordinates, catalog format | [docs/ai/export-pipeline.md](docs/ai/export-pipeline.md) & [sweethome3d/AGENTS.md](sweethome3d/AGENTS.md) |
| Lovelace WebSocket client (`LovelaceWs.php`), `?homeId=` standalone mode | [docs/ai/lovelace-ws.md](docs/ai/lovelace-ws.md) |
| Battle-tested gotchas (Brotli, IndexedDB, `urlBase`, two Unity folders) | [docs/ai/known-gotchas.md](docs/ai/known-gotchas.md) |
| MCP setup (CodeGraph across harnesses, macOS/Windows) | [docs/ai/mcp-setup.md](docs/ai/mcp-setup.md) |
| Add or replace a 3D smart device in catalog | Skill: [.agents/skills/new-ha-device/SKILL.md](.agents/skills/new-ha-device/SKILL.md) |
| Build, verify, sync Unity & deploy addon | Skill: [.agents/skills/release-and-deploy-addon/SKILL.md](.agents/skills/release-and-deploy-addon/SKILL.md) |

## Companion Repositories (Recommended Side-by-Side Layout)

This repo works standalone. For full digital-twin workflows, clone sibling repos side-by-side:

- **Unity 6 Visualizer**: `../smart-home-visualizer/` (see `../smart-home-visualizer/AGENTS.md`)
- **Thesis & Papers**: `../smart-home-thesis-intro/` (see `../smart-home-thesis-intro/AGENTS.md`)
