# Add-on Runtime, PHP Backend & Export JS (`sweethome3d/`) — Subtree Guide

Docker build context (`./sweethome3d`), Alpine + Nginx + PHP 8.2 + s6-overlay container configs, PHP endpoints, and SweetHome3D custom export scripts.

## Key Ownership

- **Custom export JS (`www/lib/`)**: `objExporter.js`, `unity-export-utils.js`, `obj-exporter-integration.js`, `objDefaults.js`.
- **DO NOT MODIFY (upstream minified fork base)**: `www/lib/sweethome3d.min.js` (~2.5 MB compressed/minified), `gl-matrix-min.js`, `jszip.min.js`, `graphics2d.min.js`, `geom.min.js`. To search internal SH3D patterns, unminify into `/tmp` or `$env:TEMP` (never into the repo) and grep bounded slices — see [docs/ai/addon-practices.md](../docs/ai/addon-practices.md).
- **PHP endpoints (`www/`)**: `listHomes.php`, `listHomesExtended.php`, `writeData.php`, `deleteHome.php`, `haApiProxy.php`, `listDashboards.php`, `addDashboardCard.php`, `lib/LovelaceWs.php`, `lib/registerIcon.php`.
- **Container config (`rootfs/etc/`)**: Nginx (Brotli headers for `/unity-visualizer/`), `php82/php-fpm.conf`, `cont-init.d/`, `services.d/`.

## Critical Invariants

- **Lovelace is WebSocket-only**: Route all `lovelace/*` operations through `www/lib/LovelaceWs.php` (`ws://supervisor/core/websocket`, dependency-free RFC6455, no `exec()`/Python/REST).
- **Keep `clear_env = no`** in `rootfs/etc/php82/php-fpm.conf` or `getenv('SUPERVISOR_TOKEN')` returns `false` in HAOS.
- **Coordinate units**: SH3D internal = `cm`; exported `{homeId}_devices.json` = `m` (SH3D Y → Unity Z); exported OBJ = `cm`.
- **Compiled web assets**: `www/assets/` and `www/unity-visualizer/` are baked into the Docker image (`COPY www/` cannot reach repo-root `unity-build/`).
- **Line endings**: Keep LF (`\n`) on `start.sh` and all `rootfs/etc/{cont-init.d,services.d}/*` scripts.

See [docs/ai/export-pipeline.md](../docs/ai/export-pipeline.md), [docs/ai/lovelace-ws.md](../docs/ai/lovelace-ws.md), and [docs/ai/known-gotchas.md](../docs/ai/known-gotchas.md).
