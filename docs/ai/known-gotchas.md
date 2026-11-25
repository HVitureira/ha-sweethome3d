# Known Gotchas & Production Invariants (`ha-sweethome3d`)

| Issue | Details & Fix |
| :--- | :--- |
| **`sweethome3d.min.js` (2.5 MB)** | Never modify; extend only via `www-vue/` or custom scripts in `sweethome3d/www/lib/`. |
| **3 copies of Unity `index.html`** | (1) `../smart-home-visualizer/Assets/WebGLTemplates/SmartHome3D/index.html` (true source), (2) `unity-build/index.html` (dev server & `setup.sh` input), (3) `sweethome3d/www/unity-visualizer/index.html` (Docker/prod copy). Editing only (2) or (3) is wiped by the next Unity build or `setup.sh`. |
| **Two Unity folders** | `unity-build/` (repo root) is served by Vite dev server (`unity-visualizer-static`). `sweethome3d/www/unity-visualizer/` is baked into Docker (`COPY www/` cannot access outside `./sweethome3d` build context). Always sync `unity-build/` → `sweethome3d/www/unity-visualizer/` before `docker-compose up --build`. |
| **`clear_env = no` in `php82/php-fpm.conf`** | PHP-FPM wipes worker env vars by default. Without `clear_env = no`, `getenv('SUPERVISOR_TOKEN')` is `false` in real HAOS, breaking `haApiProxy.php`, `listDashboards.php`, and `addDashboardCard.php`. (In local `docker-compose`, `no_supervisor_token` is expected.) |
| **Lovelace is WebSocket-only** | No REST endpoint exists for `lovelace/*`. Always use `sweethome3d/www/lib/LovelaceWs.php`. |
| **Unity Brotli headers** | `.wasm.br`, `.js.br`, `.data.br` require `Content-Encoding: br` + proper MIME type + `gzip off` in Nginx (and `unity-visualizer-static` in `vite.config.ts`). |
| **`window.getSmartHomeConfig()`** | Called by C# `WebGLConfigurationManager` via `.jslib`. Never rename or remove from Unity `index.html`. |
| **`#home-pane` CSS & hide method** | Keep `position: absolute; top: 40px` so SH3D children resolve heights relative to viewport minus tab bar. Hide via `visibility: hidden; position: absolute; pointer-events: none` (never `display: none`) and dispatch `resize` on show. |
| **Unity iframe persistence** | Mount `UnityView` directly in `App.vue` with `v-show`, never `<KeepAlive>` (detaching DOM reloads the WebGL iframe). |
| **Vue overlay `pointer-events`** | `#vue-app` is `width: 0; height: 0; pointer-events: none`; views escape via `position: fixed; pointer-events: all`. |
| **Dialog MutationObserver guard** | `isLiveDialog()` must check `el.closest('.dialog-template') === null` to skip SH3D's hidden template copy. |
| **`urlBase` with hash router** | Compute `urlBase` in `www-vue/index.html` from `origin + pathname`, never `href` (prevents `#/listHomes.php` returning HTML → `Unexpected token '<'`). |
| **Vite dev backend (`sh3d-dev-backend`)** | Emulates PHP endpoints directly against `../test-data/`; Docker is not needed for frontend iteration. |
| **Stale IndexedDB recovery** | Switching ports (`5173` vs `8099`) or rebuilding Docker can leave orphaned SH3D recovery entries (`Can't open home ... Error: 0`). Fix: DevTools → Application → IndexedDB → delete `SweetHome3DJS`. |
| **`vite build` `copyPublicDir: false`** | Does not copy the 300 MB SH3D `www/` folder; only builds Vue assets synced into `sweethome3d/www/assets/`. |
| **Material colors (`flyellow` pink bug)** | Managed via `sweethome3d/www/lib/objDefaults.js`. |
| **Container script line endings** | s6-overlay / Alpine scripts fail with `^M` if saved with CRLF. `.gitattributes` enforces LF; `scripts/verify.{sh,ps1}` validates LF. |
