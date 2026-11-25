# Home Assistant Add-on Web App Practices (`ha-sweethome3d`)

Engineering and agent-context practices for working safely inside this repository.

## 1. Fork & Non-Invasive Augmentation Architecture

`ha-sweethome3d` is a **customized fork/wrapper around upstream SweetHome3D JS (`7.5.2`)**, packaged as a Home Assistant Ingress add-on (Alpine + Nginx + PHP 8.2 + s6-overlay).

- **Do NOT edit upstream minified core files**: `sweethome3d/www/lib/sweethome3d.min.js` (~2.5 MB), `gl-matrix-min.js`, `jszip.min.js`, `graphics2d.min.js`, `geom.min.js`, and other `*.min.js` libraries are treated as an immutable runtime base.
- **Augment from the outside** using two clean layers:
  1. **Vue 3.5 + TypeScript overlay (`www-vue/`)**: Tabs, Settings UI, Unity WebGL iframe (`UnityView.vue`), Lovelace dashboard modal, export triggers, and furniture dialog HA fields injected via `MutationObserver` + `<Teleport>`.
  2. **External custom JS & PHP modules (`sweethome3d/www/`)**: `lib/objExporter.js`, `lib/unity-export-utils.js`, `lib/obj-exporter-integration.js`, `lib/objDefaults.js`, `lib/LovelaceWs.php`, and PHP endpoints (`haApiProxy.php`, `listDashboards.php`, `addDashboardCard.php`, etc.).
- This preserves compatibility with upstream SweetHome3D JS while keeping all custom code readable, typed, and CodeGraph-indexed.

---

## 2. Inspecting the Minified Core JS (`sweethome3d.min.js`) Safely

`sweethome3d/www/lib/sweethome3d.min.js` is **compressed and minified into massive lines (~2.5 MB)** and intentionally excluded from `codegraph.json`.

- **Never read or raw-grep `sweethome3d.min.js` directly into agent context**: A single grep hit can dump hundreds of kilobytes on one line and blow out the context window.
- **How to investigate internal SH3D APIs, DOM classes, or globals when needed**:
  1. **Unminify/pretty-print into a temporary file outside the repo** (`/tmp` on macOS/Linux or `$env:TEMP` on Windows):
     ```bash
     # macOS / Linux (using js-beautify via npx, or prettier)
     npx -y js-beautify sweethome3d/www/lib/sweethome3d.min.js -o /tmp/sh3d-pretty.js
     grep -n -C 5 "home-furniture-dialog" /tmp/sh3d-pretty.js | head -n 60
     ```
     ```powershell
     # Windows (PowerShell)
     npx -y js-beautify sweethome3d\www\lib\sweethome3d.min.js -o "$env:TEMP\sh3d-pretty.js"
     Select-String -Path "$env:TEMP\sh3d-pretty.js" -Pattern "home-furniture-dialog" -Context 3,5 | Select-Object -First 15
     ```
  2. **Inspect only targeted slices** (line-bounded reads of 40–80 lines around matches) — the pretty-printed file is tens of thousands of lines long.
  3. **Record discovered globals/methods** in `www-vue/src/types/sweethome3d.d.ts` (ambient types) so future sessions don't need to re-excavate the minified bundle.
  4. **Never commit an unminified copy** into the repository and never patch `sweethome3d.min.js`.

---

## 3. Frontend (`www-vue/`) Practices

- **Composition API + strict TypeScript**: Always use `<script setup lang="ts">`, Pinia setup stores (`furnitureStore.ts`, `settingsStore.ts`), and `<style scoped>` (no Options API, no inline styles).
- **DOM coexistence with SweetHome3D**:
  - `#vue-app` stays zero-size with `pointer-events: none`; views escape via `position: fixed; top: 40px; pointer-events: all`.
  - Hide `#home-pane` with `visibility: hidden; position: absolute; pointer-events: none` (never `display: none`) and dispatch `resize` when returning to `#/`.
  - Keep `UnityView.vue` mounted via `v-show` in `App.vue` (never `<KeepAlive>`).
  - Guard dialog observers with `el.closest('.dialog-template') === null`.
- **Local dev loop without Docker**: Run `cd www-vue && npm run dev`; `vite.config.ts` (`sh3d-dev-backend` + `unity-visualizer-static`) emulates PHP endpoints against `test-data/` and serves `unity-build/` with Brotli headers.
- **Verification**: Always run `npm run type-check` (`vue-tsc --noEmit`) before building or committing.

---

## 4. Backend (PHP 8.2, Nginx, Supervisor & Docker) Practices

- **Zero external PHP dependencies / no Python shell-outs**: Keep PHP endpoints self-contained stdlib PHP 8.2 (`stream_socket_client`, `curl`/streams).
- **Supervisor & Lovelace**:
  - Lovelace APIs (`lovelace/*`) are **WebSocket-only** via `sweethome3d/www/lib/LovelaceWs.php` (`ws://supervisor/core/websocket`). Never call REST endpoints for Lovelace.
  - Keep `clear_env = no` in `sweethome3d/rootfs/etc/php82/php-fpm.conf` so `SUPERVISOR_TOKEN` reaches PHP-FPM workers in HAOS.
  - Always provide graceful copy-paste/fallback JSON responses when HA views use unsupported layouts (`sections` / YAML mode) or when running locally without Supervisor.
- **Docker build context & compiled assets**:
  - `./sweethome3d/Dockerfile` only sees `./sweethome3d/` (`COPY www/`). Sync `www-vue/dist/` → `sweethome3d/www/` and `unity-build/` → `sweethome3d/www/unity-visualizer/` via `scripts/setup.sh` or `scripts/deploy-local.ps1`.
  - Home Assistant Supervisor builds the Docker image on end-user machines directly from GitHub, so compiled `sweethome3d/www/assets/` and `sweethome3d/www/unity-visualizer/` must be committed for releases.
- **Line endings**: Keep LF (`\n`) on all `.sh` and s6 `run`/`finish` container scripts; verify with `scripts/verify.{sh,ps1}`.
