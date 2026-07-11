# Changelog

All notable changes to this project will be documented in this file.

## [1.1.2] - 2026-07-11

### Added
- "Add to Dashboard" feature: from the 3D Visualizer tab, write an
  ingress-aware `iframe` Lovelace card pointing at the selected home's
  live Unity scene into any HA dashboard/view. Backed by a native
  PHP WebSocket client (`www/lib/LovelaceWs.php`) for `lovelace/config`,
  `lovelace/config/save`, `lovelace/dashboards/list`, and
  `lovelace/resources*` — no REST fallback exists in HA Core. New PHP
  endpoints `listDashboards.php` and `addDashboardCard.php`. On
  YAML-mode/`sections`-layout views or any WS failure, returns the card
  JSON so the UI shows a copy-paste fallback.
- Custom sidebar logo and HA frontend icon module
  (`ha-sweethome3d-logo.svg`, `ha-sweethome3d-icons.js`, registered as
  a Lovelace resource via `registerIcon.php` at container start) so
  `panel_icon: custom:ha-sweethome3d:logo` in `config.yaml` resolves in
  the HA frontend instead of falling back to a blank icon.
- Local deployment tooling: `scripts/deploy-local.{ps1,sh}`,
  `scripts/setup.sh`, `scripts/verify.sh`, `.env.example`,
  `LOCAL_DEPLOYMENT.md`, `docs/testing-entity-selector.md`. Lets
  developers run the addon without a full HA instance.

### Fixed
- Entity selector dropdown in the furniture dialog now populates when the
  addon is deployed under HA Ingress. The frontend's `fetch()` was using an
  absolute path (`/haApiProxy.php`) that resolved to the HA host root,
  bypassing the Ingress prefix; switched to a relative path
  (`haApiProxy.php`) so the request lands on the addon's nginx/php-fpm.
  No per-user configuration needed — the PHP proxy's `SUPERVISOR_TOKEN`
  path already handles any HA instance.

### Removed
- Effect Radius slider and all its export-pipeline entanglements:
  - `FurnitureDialogEnhancer.vue`: dropped the radius row, `onRadiusInput`
    handler, and `.ha-effect-radius-*` / `.ha-range-*` CSS.
  - `furnitureStore.ts`: dropped the `effectRadius` ref, load/reset, and
    return entry.
  - `unity-export-utils.js`: dropped the `effectRadius` / `propagationType`
    / `affectedArea` emit block in `extractDeviceMetadata` and deleted 11
    now-orphaned static methods (`extractEffectPropagation`,
    `calculateAffectedArea`, `calculateRoomFilledArea`,
    `calculateCircularArea`, `calculateSquareArea`,
    `calculateDirectionalArea`, `findRoomContaining`, `isPointInRoom`,
    `sampleWallConstrainedPoints`, `pathCrossesWalls`,
    `lineSegmentsIntersect`). File shrank from 996 → 709 lines.
  - Removed the commented-out `<script src="lib/effect-radius-renderer.js">`
    vestige from all three `index.html` copies.
  - Updated `AGENTS.md` to reflect the removed fields and methods.
  - Existing `home-*_devices.json` seed files still carry stale
    `effectRadius` / `affectedArea` keys; live export overwrites them on
    next run, and Unity's JSON deserializer ignores unknown fields.


## [1.1.1] - 2026-04-30

### Changed
- Renamed addon from `SweetHome3D` to `HASweetHome3D`. Updated the
  display name, sidebar panel title, and internal slug (`sweethome3d`
  → `hasweethome3d`).

### Added
- Addon `logo.png` and `icon.png` for the Home Assistant addon store
  page and sidebar/store thumbnail.

## [1.1.0] - 2026-04-29

### Changed
- Addon is now ingress-only and embeds in the Home Assistant sidebar.
  Removed the public `8099/tcp` port mapping and the external `webui`
  URL — the addon is reached exclusively through the HA sidebar entry
  via Home Assistant Ingress.

## [1.0.0] - 2025-10-15

### Added
- Initial release of SweetHome3D Home Assistant Add-on
- Complete SweetHome3D JS application integration
- PHP backend support for file operations
- Nginx web server configuration
- Home Assistant sidebar integration
- Configurable PHP settings (memory limit, execution time, file upload sizes)
- Support for all Home Assistant architectures (amd64, aarch64, armv7, armhf, i386)
- Automatic data directory creation with proper permissions
- Save and load functionality for home designs
- Complete furniture and texture catalogs

### Features
- Web-based 3D home design interface
- Real-time 2D plan editing with 3D preview
- Furniture placement and arrangement
- Texture and material application
- File import/export capabilities
- Multi-language support
