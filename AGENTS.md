# SweetHome3D HA Add-on - LLM Agent Context Guide

This document provides comprehensive context for LLM agents working on this modified SweetHome3D JS web application, which runs as a Home Assistant add-on and exports 3D geometry + IoT device data for Unity.

---

## Project Overview

**ha-sweethome3d** is a customized fork of SweetHome3D JS (v7.5.2) packaged as a **Home Assistant add-on**. Users design their home floor plan in the browser, place IoT smart devices from a custom furniture catalog, assign Home Assistant entity IDs, and export everything for a Unity-based digital twin visualizer.

### Key Capabilities
- Full SweetHome3D JS floor plan editor (walls, rooms, furniture, 3D preview)
- Custom "Smart Devices" furniture catalog (sensors, switches with `ha_` prefix catalog IDs)
- **Smart Lights**: Support for `ha_light` and `ha_switch` devices (exported as `type: light` / `type: switch`)
- HA Entity ID field in furniture dialog (visible only for smart devices)
- Effect radius slider per device (for particle system bounds in Unity)
- OBJ + MTL + textures export to ZIP for Unity 3D model loading
- Device metadata JSON export (positions, entity IDs, rooms, walls)
- Auto-generated Unity C# import script
- **Tabbed UI**: Floor Plan tab (SweetHome3D editor), 3D Visualizer tab (Unity WebGL iframe), Settings tab (HA credentials + viz params)
- **Settings panel**: HA server address, long-lived access token, tracked entities, visualization parameters â€” all persisted in `localStorage`
- **Unity visualizer**: Embedded as iframe at `/unity-visualizer/`; receives config from `localStorage` on load and via `postMessage` on settings changes
- **Add to Dashboard**: button in the Visualizer tab writes a `type: iframe` card (pointing at the selected home's live Unity scene) directly into a chosen Home Assistant Lovelace dashboard/view, via the Core WebSocket API — see [HA Dashboard Integration (Lovelace)](#ha-dashboard-integration-lovelace)
- Runs as Docker container (nginx + PHP-FPM, port 8099)
- Integrates with Home Assistant as an Ingress add-on

### Target Deployment
- **Primary**: Home Assistant add-on (Docker, all architectures: amd64, aarch64, armv7, armhf, i386)
- **Secondary**: Local development via `docker-compose up`

---

## Architecture Overview

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Browser                                                         â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚  Tab Bar (Vue, position:fixed, top:0, z-index:2000)     â”‚    â”‚
â”‚  â”‚  [ Floor Plan ]  [ 3D Visualizer ]  [ âš™ Settings ]     â”‚    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”‚
â”‚  â”‚  Tab A (#home-pane, position:absolute, top:40pxâ†’)       â”‚    â”‚
â”‚  â”‚    SweetHome3D JS floor plan editor                     â”‚    â”‚
â”‚  â”‚    Vue overlay: FurnitureDialogEnhancer + ExportButtons â”‚    â”‚
â”‚  â”‚                                                         â”‚    â”‚
â”‚  â”‚  Tab B (UnityView.vue, position:fixed, top:40pxâ†’)       â”‚    â”‚
â”‚  â”‚    <iframe src="/unity-visualizer/index.html">          â”‚    â”‚
â”‚  â”‚    Unity WebGL canvas (full viewport below tab bar)     â”‚    â”‚
â”‚  â”‚                                                         â”‚    â”‚
â”‚  â”‚  Tab C (SettingsView.vue, position:fixed, top:40pxâ†’)    â”‚    â”‚
â”‚  â”‚    HA address, long-lived token, viz params, Save       â”‚    â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚               Home Assistant Add-on Container                    â”‚
â”‚  Docker: Alpine + nginx + PHP-FPM (port 8099)                   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  nginx â†’ serves static files from /var/www/html/                â”‚
â”‚  PHP-FPM â†’ handles data save/load to /var/www/html/data/        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  index.html (Vue Vite entry)                                     â”‚
â”‚  â”œâ”€â”€ SweetHome3D core JS (sweethome3d.min.js + dependencies)    â”‚
â”‚  â”œâ”€â”€ Custom Export Scripts (4 JS files)                          â”‚
â”‚  â”œâ”€â”€ HA Integration Script (inline ~1000 lines)                 â”‚
â”‚  â”œâ”€â”€ Vue 3 app (#vue-app overlay, 0px, position:fixed)          â”‚
â”‚  â”‚     â”œâ”€â”€ TabBar.vue (position:fixed, z-index:2000)            â”‚
â”‚  â”‚     â”œâ”€â”€ RouterView + UnityView (always mounted, v-show)      â”‚
â”‚  â”‚     â”œâ”€â”€ FurnitureDialogEnhancer (Teleport into SH3D dialog)  â”‚
â”‚  â”‚     â””â”€â”€ ExportButtons (only on Floor Plan tab)               â”‚
â”‚  â””â”€â”€ /unity-visualizer/ â†’ Unity WebGL iframe content            â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Export Pipeline                                                 â”‚
â”‚  â”œâ”€â”€ OBJExporter.js â†’ OBJ/MTL geometry + texture extraction     â”‚
â”‚  â”œâ”€â”€ unity-export-utils.js â†’ Device JSON + room/wall data       â”‚
â”‚  â”œâ”€â”€ obj-exporter-integration.js â†’ UI integration (buttons)     â”‚
â”‚  â””â”€â”€ objDefaults.js â†’ 100+ default material definitions          â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## Directory Structure

```
ha-sweethome3d/
â”œâ”€â”€ sweethome3d/
â”‚   â”œâ”€â”€ Dockerfile                  # Docker image definition
â”‚   â”œâ”€â”€ start.sh                    # Standalone startup script
â”‚   â”œâ”€â”€ config.yaml                 # HA add-on configuration
â”‚   â”œâ”€â”€ build.yaml                  # Build config for HA
â”‚   â”œâ”€â”€ config-example.yaml         # Example config
â”‚   â”œâ”€â”€ model-create.sh             # IoT furniture model generator
â”‚   â”œâ”€â”€ rootfs/                     # Container filesystem overlays
â”‚   â”‚   â””â”€â”€ etc/
â”‚   â”‚       â”œâ”€â”€ nginx/              # nginx config (has /unity-visualizer/ Brotli block)
â”‚   â”‚       â”œâ”€â”€ php82/              # PHP-FPM config
â”‚   â”‚       â”œâ”€â”€ cont-init.d/        # s6-overlay init scripts
â”‚   â”‚       â””â”€â”€ services.d/         # s6-overlay service definitions
â”‚   â”œâ”€â”€ www/                        # Web root (served by nginx)
â”‚   â”‚   â”œâ”€â”€ index.html              # Main app (heavily customized)
â”‚   â”‚   â””â”€â”€ lib/
â”‚   â”‚       â”œâ”€â”€ sweethome3d.min.js  # Core SweetHome3D (2.5MB, DO NOT MODIFY)
â”‚   â”‚       â”œâ”€â”€ objExporter.js      # OBJ geometry exporter (1902 lines)
â”‚   â”‚       â”œâ”€â”€ unity-export-utils.js # Unity metadata exporter (971 lines)
â”‚   â”‚       â”œâ”€â”€ obj-exporter-integration.js # Export UI integration (253 lines)
â”‚   â”‚       â”œâ”€â”€ objDefaults.js      # Default material library (903 lines)
â”‚   â”‚       â”œâ”€â”€ resources/          # Furniture catalog assets (294 items)
â”‚   â”‚       â””â”€â”€ (other SH3D core libs: gl-matrix, jszip, etc.)
â”‚   â””â”€â”€ README.md                   # Add-on specific readme
â”œâ”€â”€ www-vue/                        # Vue 3 TypeScript overlay app (see section below)
â”‚   â”œâ”€â”€ index.html                  # Vite entry â€” loads SH3D scripts + mounts #vue-app
â”‚   â”œâ”€â”€ vite.config.ts              # publicDir â†’ ../sweethome3d/www; sh3d-dev-backend middleware (no Docker needed); unity-visualizer-static plugin
â”‚   â”œâ”€â”€ tsconfig.json               # TypeScript project config (strict)
â”‚   â”œâ”€â”€ package.json                # pinia, vue, vue-router
â”‚   â””â”€â”€ src/
â”‚       â”œâ”€â”€ main.ts                 # createApp â†’ .use(pinia).use(router).mount('#vue-app')
â”‚       â”œâ”€â”€ App.vue                 # Root: TabBar + RouterView + UnityView(v-show) + route watcher
â”‚       â”œâ”€â”€ router/
â”‚       â”‚   â””â”€â”€ index.ts            # Vue Router hash history: /, /visualizer, /settings
â”‚       â”œâ”€â”€ views/
â”‚       â”‚   â”œâ”€â”€ FloorPlanView.vue   # Empty placeholder (SH3D shown via #home-pane DOM toggle)
â”‚       â”‚   â”œâ”€â”€ UnityView.vue       # Full-viewport iframe to /unity-visualizer/index.html
â”‚       â”‚   â””â”€â”€ SettingsView.vue    # HA credentials + visualization params form
â”‚       â”œâ”€â”€ types/
â”‚       â”‚   â””â”€â”€ sweethome3d.d.ts    # Ambient globals: SH3DFurniture, SH3DApplication, window.*
â”‚       â”œâ”€â”€ utils/
â”‚       â”‚   â””â”€â”€ deviceDetection.ts  # isSmartDeviceFurniture, isSwitchFurniture, resolveCatalogId
â”‚       â”œâ”€â”€ services/
â”‚       â”‚   â””â”€â”€ furnitureService.ts # Thin wrappers: getFurnitureController, get/setCustomProperty
â”‚       â”œâ”€â”€ stores/
â”‚       â”‚   â”œâ”€â”€ furnitureStore.ts   # Pinia store: active controller + all HA property refs
â”‚       â”‚   â””â”€â”€ settingsStore.ts    # Pinia store: HA settings, auto-persisted to localStorage
â”‚       â”œâ”€â”€ composables/
â”‚       â”‚   â””â”€â”€ useFurnitureDialog.ts # MutationObserver: detects dialog open/close
â”‚       â””â”€â”€ components/
â”‚           â”œâ”€â”€ ExportButtons.vue   # Floating export buttons (Ctrl+E / Ctrl+Shift+E)
â”‚           â”œâ”€â”€ layout/
â”‚           â”‚   â””â”€â”€ TabBar.vue      # 40px fixed tab bar (Floor Plan / 3D Visualizer / Settings)
â”‚           â””â”€â”€ dialogs/
â”‚               â””â”€â”€ FurnitureDialogEnhancer.vue  # Teleport: injects HA fields into live dialog
â”œâ”€â”€ unity-build/                    # Pre-built Unity WebGL output (gitignored except .gitkeep)
â”‚   â”œâ”€â”€ .gitkeep                    # Keeps dir in git; actual build files are gitignored
â”‚   â”œâ”€â”€ index.html                  # Unity entry point (reads window.smartHomeConfig from LS)
â”‚   â”œâ”€â”€ Build/                      # WebAssembly + framework (Brotli compressed)
â”‚   â”œâ”€â”€ TemplateData/               # style.css, favicon.ico
â”‚   â””â”€â”€ StreamingAssets/            # smart-viz-files/ (exported home data, overwritten on export)
â”œâ”€â”€ docker-compose.yml              # Local dev compose file
â”œâ”€â”€ README.md                       # Repository readme
â”œâ”€â”€ AGENTS.md                       # This file
â”œâ”€â”€ INTEGRATION_PLAN.md             # Full technical plan for the tab integration
â”œâ”€â”€ REPO_SETUP.md                   # Repository setup guide + CI/CD recommendations
â”œâ”€â”€ test-data/                      # Test data directory
â””â”€â”€ test-config                     # Test config file
```

---

## Critical Files

### Custom Files (Our Code)
| File | Lines | Purpose |
|------|-------|---------|
| `www/index.html` | 2784 | Main HTML + inline HA integration JS (~1000 lines of custom code) |
| `www/lib/objExporter.js` | 1902 | Exports SweetHome3D scene to OBJ format with textures |
| `www/lib/unity-export-utils.js` | 971 | Complete Unity export: device JSON + rooms + walls + C# script |
| `www/lib/obj-exporter-integration.js` | 253 | Adds export button + keyboard shortcut to SweetHome3D UI |
| `www/lib/objDefaults.js` | 903 | 100+ default MTL material definitions (ambient, diffuse, specular) |
| `www/lib/LovelaceWs.php` | ~310 | Native PHP WebSocket client for HA Core API (proxied via Supervisor) — dashboards, cards, sidebar-icon resource registration. No `exec()`/Python — see [HA Dashboard Integration](#ha-dashboard-integration-lovelace) |
| `www/lib/registerIcon.php` | ~20 | CLI-only entry point (invoked from `00-sweethome3d.sh` at container start) — registers the sidebar logo as a Lovelace resource via `LovelaceWs.php` |
| `www/listDashboards.php` | ~15 | GET endpoint — lists HA Lovelace dashboards + their views, via `LovelaceWs.php` |
| `www/addDashboardCard.php` | ~70 | POST endpoint — builds an ingress-aware iframe card and writes it into the chosen dashboard/view, via `LovelaceWs.php` |
| `.claude/skills/new-ha-device/scripts/create_ha_device.py` | ~550 | Python script to add/replace HA device models (cube or Meshy.ai OBJ) |

### Core SweetHome3D Files (DO NOT MODIFY)
| File | Purpose |
|------|---------|
| `www/lib/sweethome3d.min.js` | Core SweetHome3D application (2.5MB minified) |
| `www/lib/gl-matrix-min.js` | WebGL matrix math library |
| `www/lib/jszip.min.js` | ZIP file handling |
| `www/lib/graphics2d.min.js` | 2D rendering |
| `www/lib/geom.min.js` | Geometry processing |

---

## Vue 3 Frontend Overlay (`www-vue/`)

The `www-vue/` directory contains a **Vue 3 + TypeScript + Vue Router app** that overlays the SweetHome3D canvas. It adds a three-tab navigation system, a Unity WebGL visualizer iframe, a settings panel, and HA-specific UI (furniture dialog fields, export buttons) without touching the original SH3D JS source.

### How the overlay works

```
www-vue/index.html
  â”œâ”€â”€ <script> tags loading SH3D globals (sweethome3d.min.js, objExporter.js, etc.)
  â”‚     These run first, creating window.application, window.homeComponent3D, etc.
  â””â”€â”€ <div id="vue-app">   â† Vue mounts here
        position: fixed; width: 0; height: 0; z-index: 1000; pointer-events: none
        (zero-size container; individual components use position:fixed to escape it)
```

The `#vue-app` container is **zero-size and non-interactive by default**. Child views (TabBar, UnityView, SettingsView) use `position: fixed` to escape the zero-size container and take over the viewport. `pointer-events: all` is set on each interactive view.

### Tab routing

Vue Router is configured with **hash history** (`createWebHashHistory`). This means:
- URLs look like `http://host/#/`, `http://host/#/visualizer`, `http://host/#/settings`
- The server always receives just `/` â€” no nginx rewrite rules needed
- All PHP endpoints (`/readData.php`, etc.) are completely unaffected

| Route | Component | Behavior |
|-------|-----------|----------|
| `#/` | `FloorPlanView.vue` | Shows `#home-pane` (SweetHome3D DOM) |
| `#/visualizer` | `UnityView.vue` | Shows Unity iframe (always mounted via v-show in App.vue, not routed) |
| `#/settings` | `SettingsView.vue` | Shows settings form |

### SweetHome3D DOM toggle

SweetHome3D renders into `#home-pane` â€” a DOM node owned by vanilla JS, not Vue. Visibility is toggled via a route watcher in `App.vue` using `visibility: hidden` + `position: absolute` (NOT `display: none`, which collapses dimensions and breaks SweetHome3D's splitter layout):

```typescript
watch(() => route.path, (path) => {
  const pane = document.getElementById('home-pane')
  if (!pane) return
  if (path === '/') {
    pane.style.visibility = ''
    pane.style.position = ''
    pane.style.pointerEvents = ''
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')))
  } else {
    pane.style.visibility = 'hidden'
    pane.style.position = 'absolute'
    pane.style.pointerEvents = 'none'
  }
}, { immediate: true })
```

A `resize` event is dispatched when re-showing so SweetHome3D recalculates its splitter/canvas layout.

`#home-pane` has `position: absolute; top: 40px; left: 0; right: 0; bottom: 0` (added via `index.html` CSS). This makes `#home-pane` a positioning context so all its `position: absolute` children compute `100%` heights relative to it (viewport minus 40px tab bar), not `body`.

### Unity visualizer iframe

`UnityView.vue` embeds the pre-built Unity WebGL app:

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  UnityView.vue (position:fixed, top:40px â†’ bottom:0)            â”‚
â”‚                                                                  â”‚
â”‚  onMounted:                                                      â”‚
â”‚    1. write localStorage['ha-smart-home-settings'] (latest)     â”‚
â”‚    2. set iframeSrc = '/unity-visualizer/index.html'            â”‚
â”‚                                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚  <iframe src="/unity-visualizer/index.html">             â”‚   â”‚
â”‚  â”‚    reads localStorage on load â†’ window.smartHomeConfig   â”‚   â”‚
â”‚  â”‚    Unity C# calls window.getSmartHomeConfig() via jslib  â”‚   â”‚
â”‚  â”‚    connects to Home Assistant with token                  â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                  â”‚
â”‚  watch(route.path): if back to /visualizer after settings changeâ”‚
â”‚    â†’ writeConfigToStorage() + postMessage(SMART_HOME_CONFIG_UPDATE)â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

`UnityView` is rendered directly in `App.vue` with `v-show="route.path === '/visualizer'"` â€” NOT via the router. This keeps the iframe permanently in the DOM so Unity never reloads. KeepAlive is NOT used for UnityView because KeepAlive detaches/reattaches DOM elements, which causes browsers to reload iframes.

### Settings store â€” `settingsStore.ts`

Pinia store with full `SmartHomeSettings` interface, auto-persisted to `localStorage['ha-smart-home-settings']`:

| Field group | Fields |
|-------------|--------|
| Home Assistant | `homeAssistantAddress`, `homeAssistantAccessToken`, `useSSL`, `trackedEntities` |
| MQTT (secondary) | `brokerIP`, `brokerPort`, `mqttUsername`, `mqttPassword`, `useWebSockets` |
| Visualization | `minTemp`, `maxTemp`, `interpolationPower`, `updateInterval`, `maxParticles`, `optimizeForWebGL` |
| Connection | `reconnectDelay`, `maxReconnectAttempts`, `connectionTimeout` |
| Bridge | `sensorBridgeType`, `forceHomeAssistantInEditor` |

`toUnityConfig()` returns a flat object that exactly matches the C# `ConfigurationData` struct in `WebGLConfigurationManager.cs` â€” no transformation needed on the Unity side.

`watch(settings, deep)` auto-saves to localStorage on every change. `update(patch)` merges a partial object. `reset()` restores factory defaults.

### Config delivery flow (localStorage â†’ Unity)

```
SettingsView: Save clicked
  â†’ store.update(local)
  â†’ watch fires â†’ localStorage['ha-smart-home-settings'] = JSON.stringify(settings)

User navigates to #/visualizer (first time)
  â†’ UnityView.onMounted()
    1. writeConfigToStorage()  â† ensure localStorage is fresh
    2. iframeSrc = '/unity-visualizer/index.html'  â† triggers iframe load

Unity iframe loads:
  index.html <script> IIFE:
    â†’ reads localStorage['ha-smart-home-settings']
    â†’ builds window.smartHomeConfig from stored values

Unity C# starts:
  â†’ WebGLConfigurationManager.RequestWebGLConfiguration()
  â†’ window.getSmartHomeConfig() (jslib)  â† reads window.smartHomeConfig
  â†’ ProcessConfiguration(json)
  â†’ HomeAssistantConnector_WebGL.Connect(address, token)

User changes settings, returns to #/visualizer (v-show, no reload):
  â†’ UnityView watch(route.path)
    1. writeConfigToStorage()
    2. iframe.contentWindow.postMessage({ type: 'SMART_HOME_CONFIG_UPDATE', config })
  â†’ Unity index.html 'message' listener updates window.smartHomeConfig in-place
```

### Key architectural patterns

#### 1. Dialog detection â€” `useFurnitureDialog.ts`
A `MutationObserver` on `document.body` watches for `div.home-furniture-dialog` being added/removed. The guard `el.closest('.dialog-template') === null` distinguishes the **live dialog** from the hidden template copy that always exists in the DOM.

```
SH3D opens dialog
  â†’ MutationObserver fires (childList, subtree)
  â†’ isLiveDialog() returns true
  â†’ getFurnitureController() reads window.application.getHomes()[0].getSelectedItems()[0]
  â†’ store.loadFromController(controller)  â† populates all reactive refs
  â†’ teleportTarget = liveDialog.querySelector('[data-name="name-and-price-panel"]')
  â†’ dialogOpen = true
```

#### 2. Dialog field injection â€” `FurnitureDialogEnhancer.vue`
Uses Vue `<Teleport>` to inject HA fields **into** the live SweetHome3D dialog grid, without modifying index.html or any SH3D source:

```html
<Teleport v-if="dialogOpen && teleportTarget" :to="teleportTarget">
  <!-- renders inside SH3D's name-and-price-panel grid -->
</Teleport>
```

Fields shown conditionally:
- `store.isSmartDevice` â†’ HA Entity ID input + Effect Radius slider
- `store.isSwitchDevice` â†’ Controls Entity ID input + Switch Type select

#### 3. Pinia store â€” `furnitureStore.ts`
Single source of truth for the currently-selected furniture piece's HA properties:

| Ref | Type | Property key |
|-----|------|-------------|
| `haEntityId` | `string` | `'haEntityId'` |
| `effectRadius` | `number` | `'effectRadius'` |
| `controlsEntityId` | `string` | `'controlsEntityId'` |
| `switchType` | `'pressure' \| 'fixed'` | `'switchType'` |

`loadFromController(controller)` reads all properties from the SH3D furniture object on dialog open. `commitProperty(key, value)` writes immediately via `setCustomProperty()` and queues in `pendingProps`. `flushPendingProps()` re-writes on dialog close.

#### 4. Property persistence â€” `furnitureService.ts`
Wraps the SH3D furniture property API:
```typescript
controller.getProperty(key)       // read
controller.setProperty(key, value) // write (null clears)
```
`getFurnitureController()` â†’ `window.application.getHomes()[0].getSelectedItems()[0]`

#### 5. Device detection â€” `deviceDetection.ts`
`resolveCatalogId(furniture)` tries 5 ways to get the catalog ID (defensive, SH3D API varies):
1. `furniture.getCatalogId?.()`
2. `furniture.properties.catalogId`
3. `furniture.getProperty?.('catalogId')`
4. `furniture.getAdditionalProperties?.().entries` scan
5. `furniture.getCatalogPieceOfFurniture?.().getId?.()`

`isSmartDeviceFurniture(f)` â†’ `catalogId.startsWith('ha_')` OR `creator === 'HA'` OR category contains `'smart'` OR IoT keyword in name/id.

`isSwitchFurniture(f)` â†’ `catalogId.startsWith('ha_switch')` OR `catalogId === 'ha_light_dimmer'`.

### Build & dev commands
```bash
cd www-vue/

npm run dev      # Vite dev server
                 # publicDir = ../sweethome3d/www (serves SH3D files directly)
                 # Proxies PHP endpoints to localhost:8099
                 # Serves /unity-visualizer/* from ../unity-build/ (unity-visualizer-static plugin)

npm run build    # vue-tsc + vite build â†’ dist/
                 # copyPublicDir: false (don't copy the 300MB SH3D assets)
```

`VITE_PHP_TARGET` env var overrides the PHP proxy target (default `http://localhost:8099`).

**Unity build prerequisite**: Place the pre-built Unity WebGL output at `ha-sweethome3d/unity-build/` before running `npm run dev` or `docker build`. The Unity build is not built as part of this repo's CI â€” see `REPO_SETUP.md` for the recommended CI/CD handoff between the two repos.

### Adding a new view/tab

To add a fourth tab:
1. Create `www-vue/src/views/MyView.vue` with `position: fixed; top: 40px; ...` and `z-index: 1500; pointer-events: all`
2. Add the route to `www-vue/src/router/index.ts`
3. Add a `<RouterLink to="/my-view">` to `TabBar.vue`
4. If the view must persist across tab switches (like Unity), render it directly in `App.vue` with `v-show="route.path === '/my-view'"` instead of routing it. This keeps the DOM permanently mounted (important for iframes which reload when detached)

### Adding a new HA field (Vue approach)

This is the canonical way to add new fields to the furniture dialog. Do NOT add HTML to `sweethome3d/www/index.html` anymore.

**Step 1 â€” Add property ref to `furnitureStore.ts`:**
```typescript
const myProp = ref('')

function loadFromController(controller) {
  // ...existing...
  myProp.value = getCustomProperty(controller, 'myProp') ?? ''
}
function reset() {
  // ...existing...
  myProp.value = ''
}
// add to return {}
```

**Step 2 â€” Add the field to `FurnitureDialogEnhancer.vue`:**
```html
<template v-if="store.isSmartDevice">
  <!-- existing fields... -->
  <div class="label-cell ha-only">My Field:</div>
  <div class="ha-only">
    <input type="text" :value="store.myProp" @change="onMyPropChange" />
  </div>
</template>
```
Add the handler in `<script setup>`:
```typescript
function onMyPropChange(e: Event) {
  const value = (e.target as HTMLInputElement).value
  store.myProp = value
  store.commitProperty('myProp', value)
}
```
Add any CSS to `<style scoped>` â€” no inline styles.

**Step 3 â€” Expose in export (if needed):**
In `sweethome3d/www/lib/unity-export-utils.js`, inside `extractDeviceMetadata()`:
```javascript
const myProp = piece.getProperty('myProp')
if (myProp) deviceData.myProp = myProp
```

### Type definitions â€” `sweethome3d.d.ts`
Ambient global file (no `export {}`). Declares:
- `interface SH3DFurniture` â€” `getCatalogId`, `getProperty`, `setProperty`, `getAdditionalProperties`, etc.
- `interface SH3DApplication` â€” `getHomes()`
- `interface Window` â€” `application`, `homeComponent3D`, `OBJExporter`, `UnityExportUtilities`

Add new SH3D API methods here when you need to call them from TypeScript.

---

## Export Pipeline (SweetHome3D â†’ Unity)

### How It Works
```
User clicks "ðŸ“¦ Export for Unity" (or Ctrl+E)
  â†“
exportForUnity() in index.html
  â†“
UnityExportUtilities.exportForUnity(home, component3D, baseName)
  â”œâ”€â”€ 1. OBJExporter.exportToOBJ() â†’ {baseName}_geometry.zip
  â”‚     â”œâ”€â”€ Traverses home.getWalls(), getRooms(), getFurniture()
  â”‚     â”œâ”€â”€ Exports wall geometry with textures
  â”‚     â”œâ”€â”€ Exports room floors/ceilings
  â”‚     â”œâ”€â”€ Loads furniture 3D models from URLs (ZIP containing OBJ)
  â”‚     â”œâ”€â”€ Transforms furniture positions and applies textures
  â”‚     â”œâ”€â”€ Builds OBJ + MTL file content
  â”‚     â””â”€â”€ Creates ZIP with OBJ, MTL, and texture images
  â”œâ”€â”€ 2. extractDeviceMetadata(home) â†’ {baseName}_devices.json
  â”‚     â”œâ”€â”€ Scans furniture for IoT devices (ha_ prefix in catalog ID)
  â”‚     â”œâ”€â”€ Converts positions from cm to meters
  â”‚     â”œâ”€â”€ Reads haEntityId from furniture properties
  â”‚     â”œâ”€â”€ Calculates effect propagation areas (room-bounded)
  â”‚     â”œâ”€â”€ Extracts room polygons and wall segments
  â”‚     â””â”€â”€ Returns JSON with devices, rooms, walls
  â””â”€â”€ 3. generateUnityImportScript() â†’ {baseName}_Import.cs
        â””â”€â”€ Auto-generated C# script for Unity editor import
```

### Exported Files

#### 1. `{homeId}_geometry.zip`
Contains:
- `{homeId}.obj` â€” 3D mesh (vertices, normals, UVs, faces)
- `{homeId}.mtl` â€” Material definitions (colors, textures, shininess)
- Texture images (PNG/JPG) referenced by MTL

#### 2. `{homeId}_devices.json`
```json
{
  "version": "1.0",
  "exportDate": "2026-02-17T22:00:00Z",
  "sourceName": "my-home",
  "devices": [{
    "id": "device_0",
    "name": "Living Room Sensor",
    "type": "temperature_sensor",
    "isIoTDevice": true,
    "position": { "x": 5.0, "y": 1.5, "z": 3.0 },
    "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
    "haEntityId": "sensor.living_room_temperature",
    "displaySuffix": "Â°C",
    "affectedArea": {
      "type": "room_filled",
      "vertices": [{"x": 0, "y": 0, "z": 0}, ...],
      "height": 2.5
    },
    "particleSettings": { "spawnRate": 50, "particleSize": 0.05, ... }
  }],
  "rooms": [{ "name": "Living Room", "points": [...], "ceilingHeight": 2.5 }],
  "walls": [{ "xStart": 0, "yStart": 0, "xEnd": 10, "yEnd": 0, "height": 2.5, "thickness": 0.1 }]
}
```

### Coordinate System
- **SweetHome3D internal**: cm, Y-up plan, Y = depth from top of plan
- **Exported JSON**: meters (divided by 100), with SH3D Y â†’ Unity Z mapping
- **OBJ geometry**: centimeters (Unity scales by 0.01)

---

## HA Integration Features (index.html)

### Custom UI Elements

1. **HA Entity ID Field** (line ~540-571)
   - Appears in furniture dialog only for smart devices (`ha_` prefix)
   - Input with pattern validation: `[a-z_]+\.[a-z0-9_]+`
   - Stored via `furniture.setProperty('haEntityId', value)`

2. **Effect Radius Slider** (line ~552-571)
   - Range: 0.5m to 15m, step 0.5
   - Controls particle system bounds in Unity
   - Displayed only for smart devices

3. **Export Buttons** (floating, bottom-right)
   - "ðŸ“¦ Export for Unity" â†’ full export (geometry + JSON + C# script)
   - "ðŸ”· Export to OBJ" â†’ geometry only

4. **Smart Device Counter** (catalog panel, bottom-right)
   - Shows count of IoT devices in current design
   - Updated every 2 seconds

5. **Keyboard Shortcuts**
   - `Ctrl+E` â†’ Export for Unity
   - `Ctrl+Shift+E` â†’ Export to OBJ

### Smart Device Detection
A furniture piece is considered a smart device if:
1. Catalog ID starts with `ha_` (e.g., `ha_temperature_sensor`)
2. OR `properties.catalogId` starts with `ha_`
3. OR `creator` property is `"HA"`
4. OR category name contains `"Smart"`

---

## HA Dashboard Integration (Lovelace)

### Why this exists, and why it's WebSocket, not REST

Lovelace dashboard/card/resource management (`lovelace/config`, `lovelace/config/save`, `lovelace/dashboards/list`, `lovelace/resources*`) has **no REST equivalent** in HA core — it's WebSocket-only, reachable from inside the addon container at `ws://supervisor/core/websocket`, proxied by Supervisor and authenticated with `SUPERVISOR_TOKEN` (an env var Supervisor injects automatically — see Known Gotchas for the `clear_env` trap). There is no REST fallback; calling a REST path like `http://supervisor/core/api/lovelace/resources` returns 404 and fails silently if the response isn't checked carefully — this exact mistake was in `00-sweethome3d.sh` for the sidebar-icon registration until it was fixed.

### `www/lib/LovelaceWs.php`

A minimal, dependency-free RFC6455 client (`stream_socket_client` + manual frame pack/unpack + handshake) — no shell-out, no Python, no external library. Exposes:
- `lovelace_ws_connect_and_auth()` — opens the socket, performs the WS upgrade, handles the `auth_required → auth → auth_ok` handshake using `SUPERVISOR_TOKEN`.
- `lovelace_ws_list_dashboards()` — calls `lovelace/dashboards/list` + `lovelace/config` per dashboard → `[{url_path, title, views: [{index, title}]}]`.
- `lovelace_ws_add_card(array $args)` — fetches a view's `lovelace/config`, appends a card, saves via `lovelace/config/save`. Detects YAML-mode/strategy dashboards and the newer `sections` view layout (no flat `cards` array) and returns `{ok: false, reason: 'unsupported_view_layout', card}` instead of silently writing something that won't render.
- `lovelace_ws_register_resource(string $url, string $marker)` — lists existing resources via `lovelace/resources`, deletes stale entries matching `$marker` (old addon versions), creates the current one via `lovelace/resources/create`.

> **Verification status**: `lovelace/dashboards/list`, `lovelace/config`, `lovelace/config/save` are confirmed working against a real HA instance (cards are successfully added in production). The `lovelace/resources*` command names are inferred from the same naming convention but have **not** been field-verified yet — check addon logs after the next real deploy.

### Three consumers

1. **`www/listDashboards.php`** — GET endpoint backing the "Add to Dashboard" dialog's dropdowns. Thin wrapper around `lovelace_ws_list_dashboards()`.
2. **`www/addDashboardCard.php`** — POST `{homeId, urlPath, viewIndex}`. Resolves the addon's ingress-proxied URL via Supervisor `GET /addons/self/info` (`ingress_entry`, same pattern as `haApiProxy.php`), builds `{type: 'iframe', url: '{ingress_entry}/unity-visualizer/index.html?homeId={homeId}', ...}`, and calls `lovelace_ws_add_card()`. On `unsupported_view_layout` or any WS failure, returns the card JSON so the frontend can show a copy-paste fallback instead of failing silently.
3. **`www/lib/registerIcon.php`** (CLI, not web-facing) — invoked from `00-sweethome3d.sh` cont-init with the sidebar icon module's `/local/...` URL; registers it as a Lovelace resource so `panel_icon: custom:ha-sweethome3d:logo` (in `config.yaml`) actually resolves in the HA frontend instead of falling back to a blank icon.

### Frontend — `UnityView.vue`

"🖥️ Add to Dashboard" button (disabled until the selected home has a full export — `hasGeometry`) opens a dialog: fetch `listDashboards.php` → Dashboard `<select>` → dependent View `<select>` (derived via computed `availableViews`, no extra fetch) → POST `addDashboardCard.php`. `dashboardsLoading`/`addingCard` refs drive loading text + disabled states during both fetches. On `{ok: false, card}`, shows the card JSON in a read-only `<textarea>` with a Copy button instead of a bare error.

### Standalone scene loading (no parent app)

The generated card is a bare `<iframe src=".../unity-visualizer/index.html?homeId=X">` rendered directly by the HA frontend — there is no parent Vue app to `postMessage({type: 'LOAD_HOME', ...})` the way `UnityView.vue`'s own iframe usage works. To handle this, `index.html` also reads `?homeId=` from `location.search` directly: if present, it computes `baseUrl` from its own `window.location` (same strip-`/unity-visualizer`-from-pathname logic as `UnityView.vue`'s `getUnityDataBaseUrl()`) and calls `SendMessage('SceneSetup', 'LoadHomeFromWeb', ...)` itself — reusing the exact same `window.pendingLoadHome` queuing mechanism used for the postMessage path. No Unity-side (C#) changes were needed; `LoadHomeFromWeb` only ever consumes the `{homeId, baseUrl}` payload regardless of how `SendMessage` was triggered.

> ⚠️ **This logic lives in three places that must all be kept in sync** — see the "Unity `index.html` has three copies" row in Known Gotchas below. Patching only the deployed copy or only the build output is not enough.

---

## Key JavaScript Classes

### OBJExporter (objExporter.js)
```javascript
class OBJExporter {
  exportToOBJ(home, component3D, filename)  // Main entry point
  exportWall(wall, name)                     // Export wall geometry
  exportRoom(room, name)                     // Export floor/ceiling
  exportFurniture(piece, name, component3D)  // Export furniture (loads model from URL)
  exportModelFromURL(url, x, y, elev, angle) // Load + transform 3D model
  parseMTLTextures(mtlContent, textureMap)   // Extract material data
  integrateOBJContent(objContent, ...)        // Merge furniture OBJ into scene
  buildOBJContent() / buildMTLContent()       // Generate final file contents
  createZipFile(baseName, obj, mtl)           // Package as ZIP with textures
}
```

### UnityExportUtilities (unity-export-utils.js)
```javascript
class UnityExportUtilities {
  static exportForUnity(home, component3D, baseName)  // Complete export
  static extractDeviceMetadata(home)                   // IoT device data
  static isIoTDevice(catalogId, piece)                 // Detection logic
  static extractEffectPropagation(piece, home)         // Particle bounds
  static calculateRoomFilledArea(x, y, maxRadius, home) // Wall-constrained area
  static getParticleSettings(deviceType, particleType)  // Unity particle config
  static generateUnityImportScript(baseName, data)      // C# script generation
}
```

---

## Common Tasks

### Adding a New 3D Model / IoT Device Type

**Use the Python automation script** â€” it handles model ZIP, icon, and catalog in one command:

```bash
# From ha-sweethome3d/ directory:
python ".claude/skills/new-ha-device/scripts/create_ha_device.py" \
  --name ha-my-device \
  --display-name "My Device" \
  --catalog-id ha_my_device \
  --category "Smart Sensors" \
  --color "80,200,120" \
  --width 5 --depth 5 --height 8 \
  --elevation 150 \
  --project-root ".."
```

See `.claude/skills/new-ha-device/SKILL.md` for full parameter reference.

#### Option A: Colored cube (no 3D model available yet)

Use `--color "R,G,B"`. Generates an axis-aligned box with flat MTL color. Fast, no dependencies beyond Python stdlib.

#### Option B: Real 3D model from Meshy.ai or downloaded OBJ

Use `--external-obj PATH_TO_FOLDER`. The folder must contain `*.obj` (+ optionally `*.mtl` and `*.png`). The script uses `trimesh` to:
1. Decimate the mesh to ~`--target-faces` faces (default 2000)
2. Rescale to fit within the given `--width`Ã—`--depth`Ã—`--height` box
3. Sample the dominant color from the PNG for the flat MTL color and icon
4. Package into ZIP and update catalog

**Dependencies (one-time install):**
```bash
pip install trimesh fast-simplification
```

**Meshy.ai prompts for each device type:**
| Device | Suggested prompt |
|--------|-----------------|
| Temp/humidity sensor | `"Sonoff SNZB-02 temperature and humidity sensor, small white square IoT device, realistic"` |
| Motion sensor | `"PIR motion detector sensor, white dome shape, ceiling mount, realistic"` |
| Smart bulb | `"Philips Hue smart LED bulb, white, realistic"` |
| Wall switch | `"white wall light switch with single rocker button, realistic"` |
| Smart plug | `"smart home wall plug adapter with LED indicator, white, realistic"` |
| Ceiling light | `"round flat ceiling light fixture, white, modern, realistic"` |

> **Dimension tip**: Set `--height` to match the model's dominant axis. A standing sensor needs `--height 8`, a flat disc sensor needs `--height 2`.

#### Current device catalog

| Index | Catalog ID | Name | Model |
|-------|-----------|------|-------|
| #101 | `ha_sensor_temperature` | Temperature Sensor | Cube |
| #102 | `ha_sensor_humidity` | Humidity Sensor | Cube |
| #104 | `ha_sensor_motion` | Motion Sensor | Cube |
| #105 | `ha_sensor_light` | Light Sensor | Cube |
| #106 | `ha_sensor_motion_light` | Motion & Light Sensor | Cube |
| #107 | `ha_light_bulb` | Smart Light Bulb | Cube |
| #108 | `ha_light_dimmer` | Smart Dimmer | Cube |
| #109 | `ha_switch_plug` | Smart Plug | Cube |
| #110 | `ha_switch_pressure` | Pressure-Sensitive Switch | Cube |
| #111 | `ha_switch_regular` | Wall Switch | Cube |
| #112 | `ha_light_ceiling` | Ceiling Light | Cube |
| #113 | `ha_sensor_temp_humidity` | Temperature & Humidity Sensor | Meshy.ai |

> The index number (#N) is internal to the catalog file and can change when a device is replaced. SweetHome3D matches devices by `catalogId`, not index. Saved home files (.sh3x) reference `catalogId`.

#### Catalog format reference

The catalog uses a flat JSON with numbered suffixes. Each device needs exactly 14 keys:

```json
"model#N":        "lib/resources/models/ha-{name}.zip!/ha-{name}.obj",
"catalogId#N":    "ha_{name_underscored}",
"name#N":         "Display Name",
"icon#N":         "lib/resources/models/ha-{name}.png",
"category#N":     "Smart Sensors",
"width#N":        "5",
"depth#N":        "5",
"height#N":       "8",
"elevation#N":    "150",
"movable#N":      "true",
"doorOrWindow#N": "false",
"tags#N":         "HA, IoT, Smart Home, ...",
"creator#N":      "HA",
"modelSize#N":    "<zip byte count>"
```

> **`catalogId`** must start with `ha_` Â· **`creator`** must be `"HA"` Â· **`category`** must contain "Smart" Â· **`modelSize`** must match the actual ZIP byte count

#### Updating export logic (if new device type)

- `UnityExportUtilities.getDeviceType()` â€” classify the new device type for Unity
- `UnityExportUtilities.getParticleSettings()` â€” configure particle visualization
- Both can be patched automatically via `--device-type` and `--particle-color` script args

#### Unity side

- Add prefab to the project
- Update `SceneAutoSetup` inspector:
  - `lightPrefab`: for bulbs/ceiling lamps (`ha_light_bulb`, `ha_light_ceiling`)
  - `lightSwitchPrefab`: for wall switches/dimmers (`ha_light_dimmer`, `ha_switch_plug`)

---

### Replacing an Existing Device Model

Use this when upgrading a cube device to a real 3D model (e.g., a Meshy.ai export).

**Step 1 â€” Delete the old ZIP:**
```bash
rm sweethome3d/www/lib/resources/models/ha-{name}.zip
```

**Step 2 â€” Remove the old catalog entries** (all 14 keys for that device's index):
```python
python -c "
import json, re
path = 'sweethome3d/www/lib/resources/DefaultFurnitureCatalog.json'
with open(path, 'r', encoding='utf-8') as f:
    cat = json.load(f)
target = 'ha_sensor_temp_humidity'  # â† change to your catalogId
n = next((re.search(r'#(\d+)\$', k).group(1) for k, v in cat.items()
          if k.startswith('catalogId#') and v == target), None)
if n:
    removed = [k for k in list(cat) if k.endswith(f'#{n}')]
    for k in removed: del cat[k]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(cat, f, indent=2, ensure_ascii=False); f.write('\n')
    print(f'Removed #{n}: {len(removed)} keys')
else:
    print('catalogId not found')
"
```

**Step 3 â€” Re-run the script** with the same `--name` and `--catalog-id` but `--external-obj` pointing to the new model folder. The script assigns the next free index automatically.

> The PNG icon file is rewritten in-place (same path) â€” no need to delete it first.

> **Why the index changes**: The script never overwrites an existing ZIP. Deleting the ZIP frees the name for reuse, but the catalog index (#N) advances to the next available number. This is harmless â€” SweetHome3D always looks up devices by `catalogId`.

---

### Adding Custom Inputs to the Furniture Edit Form

> **Use the Vue 3 approach** described in the [Vue 3 Frontend Overlay](#vue-3-frontend-overlay-www-vue) section above. The legacy inline-JS approach below is kept for reference but should not be extended further.

#### Current Fields (Vue, `FurnitureDialogEnhancer.vue`)

| Field | Condition | Store ref | Property key |
|-------|-----------|-----------|-------------|
| HA Entity ID | `isSmartDevice` | `haEntityId` | `'haEntityId'` |
| Effect Radius slider | `isSmartDevice` | `effectRadius` | `'effectRadius'` |
| Controls Entity ID | `isSwitchDevice` | `controlsEntityId` | `'controlsEntityId'` |
| Switch Type select | `isSwitchDevice` | `switchType` | `'switchType'` |

#### Legacy inline-JS approach (reference only)

The original HA fields were added directly in `sweethome3d/www/index.html` using:
- HTML injected into `div[data-name="name-and-price-panel"]` inside `div#home-furniture-dialog-template`
- Fields hidden by default (`display:none`), shown by inline JS `setupHAEntityField()`
- Dialog detection via `setInterval` polling every 500ms (replaced by MutationObserver in Vue)
- Property persistence via `controller.setProperty()` / `controller.getProperty()`

Do **not** add new fields to `index.html`. The Vue overlay (`www-vue/`) handles all HA UI.

### Unity WebGL build location — Two Folders Explained

There are **two separate Unity-related folders** with distinct roles:

| Folder | Used by | Role |
|--------|---------|------|
| `unity-build/` | Vite dev server (`npm run dev`) | **Unity output target.** Set this as your Unity WebGL output path in the Unity Build Settings. The Vite `unity-visualizer-static` plugin reads directly from here and serves it at `/unity-visualizer/`. |
| `sweethome3d/www/unity-visualizer/` | Docker / production | **What gets baked into the Docker image.** The Dockerfile uses `COPY www/ /var/www/html/` with build context `./sweethome3d`. `unity-build/` is at the repo root — **outside** this context — and can never be directly copied by Docker. |

**The Dockerfile does NOT have a `COPY unity-build/` line and cannot have one** — Docker build contexts cannot reference parent directories. The only path into the image is through `sweethome3d/www/unity-visualizer/`.

**Required sync step after every Unity build** (before `docker-compose up --build`):

```powershell
# PowerShell (Windows)
Copy-Item -Path "unity-build\Build\*"           -Destination "sweethome3d\www\unity-visualizer\Build\"           -Recurse -Force
Copy-Item -Path "unity-build\StreamingAssets\*"  -Destination "sweethome3d\www\unity-visualizer\StreamingAssets\"  -Recurse -Force
Copy-Item -Path "unity-build\index.html"         -Destination "sweethome3d\www\unity-visualizer\index.html"       -Force
```

```bash
# bash / macOS / Linux
cp -r unity-build/Build/*           sweethome3d/www/unity-visualizer/Build/
cp -r unity-build/StreamingAssets/*  sweethome3d/www/unity-visualizer/StreamingAssets/
cp    unity-build/index.html         sweethome3d/www/unity-visualizer/index.html
```

After syncing, run `docker-compose up --build`. The `COPY www/` step will no longer be cached (Docker detects changed files) and the new Unity build will be included.

> **Dev server does not need the sync step.** `npm run dev` reads `unity-build/` directly.

Expected structure (both folders are identical in content):

```
ha-sweethome3d/unity-build/               ← Unity output target (dev server)
ha-sweethome3d/sweethome3d/www/unity-visualizer/   ← Docker bake target (production)
├── index.html                  ← Unity entry point (localStorage reader)
├── Build/
│   ├── unity-build.loader.js
│   ├── unity-build.wasm.br     ← WebAssembly (Brotli compressed)
│   ├── unity-build.framework.js.br
│   └── unity-build.data.br
├── TemplateData/
└── StreamingAssets/
    └── smart-viz-files/
        ├── home-{id}_devices.json    ← overwritten by exportForUnity.php at runtime
        └── home-{id}_geometry.zip   ← overwritten by exportForUnity.php at runtime
```

The `StreamingAssets/smart-viz-files/` data bundled in the Unity build is only a default/demo dataset — the live export from the SweetHome3D editor always overwrites it.

---

### Modifying Export Format
- **Add JSON fields**: Edit `UnityExportUtilities.extractDeviceMetadata()`
- **Change OBJ output**: Edit `OBJExporter.buildOBJContent()` / `buildMTLContent()`
- **Add texture handling**: Edit `OBJExporter.parseMTLTextures()`
- **Coordinate conversion**: Check `integrateOBJContent()` for transform math

### Debugging Export Issues
1. Open browser DevTools console
2. Run `exportForUnity()` manually
3. Check console for `📬`, `✅`, `❌` prefixed logs
4. For OBJ issues: `window.OBJExporter` is globally available
5. For device detection: `window.isSmartDeviceFurniture(piece)`

---

## Infrastructure & Deployment

### Docker (config.yaml)
- **Port**: 8099
- **Ingress**: Yes (HA sidebar integration)
- **PHP settings**: max_execution 300s, memory 256M, upload 50M
- **Volumes**: Maps `share:rw` and `config:rw` for data persistence
- **Data storage**: `/var/www/html/data/` for saved home designs

### Local Development
```bash
# Start with Docker Compose
docker-compose up --build

# Access at http://localhost:8099
```

### Home Assistant Installation
1. Add repository URL in HA Add-on Store
2. Install "SweetHome3D" add-on
3. Start â†’ access via HA sidebar

---

## Known Gotchas

| Issue | Details |
|-------|---------|
| `sweethome3d.min.js` is 2.5MB | Do NOT modify; all customizations via separate scripts |
| Furniture model loading is async | `exportModelFromURL()` uses JSZip to load from URLs |
| Entity ID persistence | Uses `furniture.setProperty()` / `getProperty()` API |
| Effect radius renderer | `effect-radius-renderer.js` removed â€” was commented out and non-functional |
| Coordinate units | SH3D internal = cm; JSON export = meters; OBJ geometry = cm |
| Material color parsing | Historical bug with `flyellow` appearing pink â€” fixed via `objDefaults.js` |
| Vue dialog detection guard | `isLiveDialog()` checks `el.closest('.dialog-template') === null` â€” SH3D keeps a hidden template copy in the DOM at all times; without this guard the observer fires twice |
| Vue `<Teleport>` target | Teleports into `[data-name="name-and-price-panel"]` â€” a CSS grid inside the live dialog. Vue fields inherit the grid layout, so they appear as natural rows |
| `furnitureStore.flushPendingProps()` | Writes all pending properties again on dialog close (belt-and-suspenders). This means each property write happens twice: once on `@change`, once on close |
| Vue overlay `pointer-events` | `#vue-app` is `pointer-events: none; width: 0; height: 0`. Views escape via `position: fixed; pointer-events: all`. Without zero-size `#vue-app`, the overlay would block SH3D mouse input |
| `vite build` copies no public assets | `copyPublicDir: false` â€” the SH3D `www/` files are served separately by nginx; the Vite build only outputs the Vue bundle |
| `#home-pane` positioning context | Adding `position: absolute; top: 40px` to `#home-pane` in `index.html` makes it a positioning context. All SH3D children (`position: absolute`) now resolve heights relative to `#home-pane` (viewport minus 40px), not `body`. Do NOT change this CSS â€” removing it breaks the SH3D layout |
| Unity iframe persistence | `UnityView` is rendered directly in `App.vue` with `v-show`, NOT via the router. KeepAlive is NOT used because it detaches/reattaches DOM â€” browsers reload iframes on reattach. `v-show` toggles CSS `display` without removing the element |
| `#home-pane` hide method | Uses `visibility: hidden` + `position: absolute` + `pointer-events: none`, NOT `display: none`. `display: none` collapses dimensions to 0px, breaking SweetHome3D's splitter calculations. A `resize` event is dispatched on re-show to recalculate layout |
| Unity Brotli files | Unity WebGL output uses `.wasm.br`, `.js.br`, `.data.br` pre-compressed files. nginx must set `Content-Encoding: br` + correct MIME type + `gzip off` for each. The Vite dev server handles this via the `unity-visualizer-static` plugin. Missing these headers causes the browser to display a load error |
| Unity `window.getSmartHomeConfig()` | This function in `unity-build/index.html` is called by C# `WebGLConfigurationManager` via jslib. Do NOT rename or remove it. It reads from `window.smartHomeConfig` (built from localStorage) and returns a flat JSON string matching `ConfigurationData` |
| Export buttons visibility | `<ExportButtons v-if="route.path === '/'"` in `App.vue`. Keyboard shortcuts (Ctrl+E) are also gated by this; they only make sense on the Floor Plan tab |
| `urlBase` and Vue Router hash mode | `www-vue/index.html` must calculate `urlBase` from `origin + pathname`, NOT `href`. Vue Router uses hash mode (`/#/visualizer`), and `href` includes the `#` fragment â€” SH3D would request `http://host/#/listHomes.php` which resolves to `/` and returns `index.html` HTML instead of JSON. Symptom: `Unexpected token '<'` on page reload when on any tab other than Floor Plan |
| Vite dev backend (`sh3d-dev-backend`) | `vite.config.ts` has a middleware that handles `listHomes.php`, `writeData.php`, `deleteHome.php`, and `/data/*` by reading/writing directly to `../test-data/`. This means **Docker is not required for dev** â€” only for production builds. The middleware scans `test-data/` for `.sh3x` files and serves them at `/data/`. Missing `.json` files return `{}` (SH3D expects valid JSON for preferences) |
| Stale IndexedDB recovery data | SH3D auto-recovery stores home state in IndexedDB (`SweetHome3DJS/Recovery/`). After rebuilding Docker or switching between ports (5173 vs 8099), orphaned records may cause `Can't open home ... Error: 0`. Fix: DevTools â†’ Application â†’ IndexedDB â†’ delete `SweetHome3DJS` database |
| Unity build must exist for Docker | **Two folders are involved** (see "Unity WebGL build location" below). `unity-build/` is used by the Vite dev server directly. For Docker, the files must be manually synced to `sweethome3d/www/unity-visualizer/` before running `docker-compose up --build`, because the Dockerfile build context (`./sweethome3d`) cannot reach the repo-root `unity-build/` folder. If `sweethome3d/www/unity-visualizer/Build/` is missing, the Unity tab will show a blank iframe. |
| `X-Frame-Options: SAMEORIGIN` | Already set in nginx.conf. This allows the Unity iframe because both the parent Vue app and the iframe origin are on the same host/port. No change needed |
| **Unity `index.html` has THREE copies — edit the right one** | (1) `smart-home-visualizer/Assets/WebGLTemplates/SmartHome3D/index.html` — the **real source**, regenerated by Unity on every WebGL export (`webGLTemplate: PROJECT:SmartHome3D` in `ProjectSettings.asset`). (2) `unity-build/index.html` — last export's output, what `scripts/setup.sh` reads *from*. (3) `sweethome3d/www/unity-visualizer/index.html` — the deployed copy, what `scripts/setup.sh` syncs *into* (via `rm -rf` + `cp -a unity-build/`). **Editing only (2) or (3) is silently lost**: `setup.sh` wipes (3) from (2) on every run, and the next Unity re-export wipes (2) from (1). Any change to the Unity HTML/JS shell (e.g. the standalone `?homeId=` loader, the `LOAD_HOME`/`postMessage` listener) must be made in **all three**, starting with (1). This bit us twice in one session — first editing (3) directly (wiped by `setup.sh`), then editing (2) only (would've been wiped by the next Unity build) |
| `clear_env = no` required in `php82/php-fpm.conf` | PHP-FPM defaults to wiping the worker process's environment before running any script, keeping only explicitly whitelisted vars. Without `clear_env = no` in the `[www]` pool, `getenv('SUPERVISOR_TOKEN')` always returns `false` — even though Supervisor genuinely injects the token into the container — breaking `addDashboardCard.php`, `listDashboards.php`, and the pre-existing `haApiProxy.php`. Only observable on a real HAOS/Supervised instance; local docker-compose never has `SUPERVISOR_TOKEN` set at all (no Supervisor process exists there), so `no_supervisor_token` there is expected/by-design, not this bug |
| Lovelace dashboards/cards/resources are WebSocket-only | No REST endpoint exists for any `lovelace/*` operation — `http://supervisor/core/api/lovelace/resources` (and similar) returns 404. Always go through `www/lib/LovelaceWs.php`'s WS client; do not add a `curl`-based REST call for Lovelace data, it will silently fail (this was the original sidebar-icon registration bug) |

---

## Companion Project

This app works with the **Unity Smart Home Visualizer** (`smart-home-visualizer` repo):
- Path: `../smart-home-visualizer/`
- AGENTS.md: `../smart-home-visualizer/AGENTS.md`
- Import side: `SceneAutoSetup.cs` loads the exported ZIP + JSON
- Unity WebGL build is placed at `ha-sweethome3d/unity-build/` and served at `/unity-visualizer/`
- Config bridge: `smart-home-visualizer/Assets/WebGLTemplates/SmartHome3D/index.html` reads from `localStorage['ha-smart-home-settings']` which is written by `settingsStore.ts`. **This is the actual active template** — confirmed via `ProjectSettings.asset` (`webGLTemplate: PROJECT:SmartHome3D`); it is the true source for every Unity-generated `index.html`, see Known Gotchas

### Repository relationship

The two repos are **kept separate** (different toolchains, different release cadences). The integration point is the Unity **WebGL build output** â€” a folder of static files that `ha-sweethome3d` serves at `/unity-visualizer/` inside the Docker image.

See **`REPO_SETUP.md`** (in this repo root) for:
- Rationale for not using a monorepo or git submodule
- Recommended GitHub Actions CI/CD workflows for both repos (game-ci Unity builder)
- Local development setup options (build Unity yourself, download release, copy from colleague)
- `.gitignore` recommendations
- Versioning strategy (matching `v*` tags across both repos)

### Unity WebGL build location

```
ha-sweethome3d/unity-build/
â”œâ”€â”€ .gitkeep                    â† tracked; keeps dir in git
â”œâ”€â”€ index.html                  â† Unity entry point (localStorage reader)
â”œâ”€â”€ Build/
â”‚   â”œâ”€â”€ Build.loader.js
â”‚   â”œâ”€â”€ Build.wasm.br           â† WebAssembly (Brotli compressed)
â”‚   â”œâ”€â”€ Build.framework.js.br   â† Unity framework (Brotli)
â”‚   â””â”€â”€ Build.data.br           â† Scene data (Brotli)
â”œâ”€â”€ TemplateData/
â”‚   â”œâ”€â”€ style.css
â”‚   â””â”€â”€ favicon.ico
â””â”€â”€ StreamingAssets/
    â””â”€â”€ smart-viz-files/
        â”œâ”€â”€ home-{id}_devices.json    â† IoT device metadata (overwritten by exportForUnity.php)
        â””â”€â”€ home-{id}_geometry.zip   â† 3D model OBJ+MTL (overwritten by exportForUnity.php)
```

The `StreamingAssets/smart-viz-files/` data bundled in the Unity build is only a default/demo dataset â€” the live export from the SweetHome3D editor always overwrites it.

---

*Last updated: June 21, 2026*

