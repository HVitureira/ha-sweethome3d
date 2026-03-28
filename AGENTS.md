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
- **Settings panel**: HA server address, long-lived access token, tracked entities, visualization parameters — all persisted in `localStorage`
- **Unity visualizer**: Embedded as iframe at `/unity-visualizer/`; receives config from `localStorage` on load and via `postMessage` on settings changes
- Runs as Docker container (nginx + PHP-FPM, port 8099)
- Integrates with Home Assistant as an Ingress add-on

### Target Deployment
- **Primary**: Home Assistant add-on (Docker, all architectures: amd64, aarch64, armv7, armhf, i386)
- **Secondary**: Local development via `docker-compose up`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Tab Bar (Vue, position:fixed, top:0, z-index:2000)     │    │
│  │  [ Floor Plan ]  [ 3D Visualizer ]  [ ⚙ Settings ]     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Tab A (#home-pane, position:absolute, top:40px→)       │    │
│  │    SweetHome3D JS floor plan editor                     │    │
│  │    Vue overlay: FurnitureDialogEnhancer + ExportButtons │    │
│  │                                                         │    │
│  │  Tab B (UnityView.vue, position:fixed, top:40px→)       │    │
│  │    <iframe src="/unity-visualizer/index.html">          │    │
│  │    Unity WebGL canvas (full viewport below tab bar)     │    │
│  │                                                         │    │
│  │  Tab C (SettingsView.vue, position:fixed, top:40px→)    │    │
│  │    HA address, long-lived token, viz params, Save       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│               Home Assistant Add-on Container                    │
│  Docker: Alpine + nginx + PHP-FPM (port 8099)                   │
├─────────────────────────────────────────────────────────────────┤
│  nginx → serves static files from /var/www/html/                │
│  PHP-FPM → handles data save/load to /var/www/html/data/        │
├─────────────────────────────────────────────────────────────────┤
│  index.html (Vue Vite entry)                                     │
│  ├── SweetHome3D core JS (sweethome3d.min.js + dependencies)    │
│  ├── Custom Export Scripts (4 JS files)                          │
│  ├── HA Integration Script (inline ~1000 lines)                 │
│  ├── Vue 3 app (#vue-app overlay, 0px, position:fixed)          │
│  │     ├── TabBar.vue (position:fixed, z-index:2000)            │
│  │     ├── RouterView with KeepAlive (UnityView stays alive)    │
│  │     ├── FurnitureDialogEnhancer (Teleport into SH3D dialog)  │
│  │     └── ExportButtons (only on Floor Plan tab)               │
│  └── /unity-visualizer/ → Unity WebGL iframe content            │
├─────────────────────────────────────────────────────────────────┤
│  Export Pipeline                                                 │
│  ├── OBJExporter.js → OBJ/MTL geometry + texture extraction     │
│  ├── unity-export-utils.js → Device JSON + room/wall data       │
│  ├── obj-exporter-integration.js → UI integration (buttons)     │
│  └── objDefaults.js → 100+ default material definitions          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
ha-sweethome3d/
├── sweethome3d/
│   ├── Dockerfile                  # Docker image definition
│   ├── start.sh                    # Standalone startup script
│   ├── config.yaml                 # HA add-on configuration
│   ├── build.yaml                  # Build config for HA
│   ├── config-example.yaml         # Example config
│   ├── model-create.sh             # IoT furniture model generator
│   ├── rootfs/                     # Container filesystem overlays
│   │   └── etc/
│   │       ├── nginx/              # nginx config (has /unity-visualizer/ Brotli block)
│   │       ├── php82/              # PHP-FPM config
│   │       ├── cont-init.d/        # s6-overlay init scripts
│   │       └── services.d/         # s6-overlay service definitions
│   ├── www/                        # Web root (served by nginx)
│   │   ├── index.html              # Main app (heavily customized)
│   │   └── lib/
│   │       ├── sweethome3d.min.js  # Core SweetHome3D (2.5MB, DO NOT MODIFY)
│   │       ├── objExporter.js      # OBJ geometry exporter (1902 lines)
│   │       ├── unity-export-utils.js # Unity metadata exporter (971 lines)
│   │       ├── obj-exporter-integration.js # Export UI integration (253 lines)
│   │       ├── objDefaults.js      # Default material library (903 lines)
│   │       ├── resources/          # Furniture catalog assets (294 items)
│   │       └── (other SH3D core libs: gl-matrix, jszip, etc.)
│   └── README.md                   # Add-on specific readme
├── www-vue/                        # Vue 3 TypeScript overlay app (see section below)
│   ├── index.html                  # Vite entry — loads SH3D scripts + mounts #vue-app
│   ├── vite.config.ts              # publicDir → ../sweethome3d/www; PHP proxy + unity-visualizer-static plugin
│   ├── tsconfig.json               # TypeScript project config (strict)
│   ├── package.json                # pinia, vue, vue-router
│   └── src/
│       ├── main.ts                 # createApp → .use(pinia).use(router).mount('#vue-app')
│       ├── App.vue                 # Root: TabBar + RouterView(KeepAlive) + route watcher
│       ├── router/
│       │   └── index.ts            # Vue Router hash history: /, /visualizer, /settings
│       ├── views/
│       │   ├── FloorPlanView.vue   # Empty placeholder (SH3D shown via #home-pane DOM toggle)
│       │   ├── UnityView.vue       # Full-viewport iframe to /unity-visualizer/index.html
│       │   └── SettingsView.vue    # HA credentials + visualization params form
│       ├── types/
│       │   └── sweethome3d.d.ts    # Ambient globals: SH3DFurniture, SH3DApplication, window.*
│       ├── utils/
│       │   └── deviceDetection.ts  # isSmartDeviceFurniture, isSwitchFurniture, resolveCatalogId
│       ├── services/
│       │   └── furnitureService.ts # Thin wrappers: getFurnitureController, get/setCustomProperty
│       ├── stores/
│       │   ├── furnitureStore.ts   # Pinia store: active controller + all HA property refs
│       │   └── settingsStore.ts    # Pinia store: HA settings, auto-persisted to localStorage
│       ├── composables/
│       │   └── useFurnitureDialog.ts # MutationObserver: detects dialog open/close
│       └── components/
│           ├── ExportButtons.vue   # Floating export buttons (Ctrl+E / Ctrl+Shift+E)
│           ├── layout/
│           │   └── TabBar.vue      # 40px fixed tab bar (Floor Plan / 3D Visualizer / Settings)
│           └── dialogs/
│               └── FurnitureDialogEnhancer.vue  # Teleport: injects HA fields into live dialog
├── unity-build/                    # Pre-built Unity WebGL output (gitignored except .gitkeep)
│   ├── .gitkeep                    # Keeps dir in git; actual build files are gitignored
│   ├── index.html                  # Unity entry point (reads window.smartHomeConfig from LS)
│   ├── Build/                      # WebAssembly + framework (Brotli compressed)
│   ├── TemplateData/               # style.css, favicon.ico
│   └── StreamingAssets/            # smart-viz-files/ (exported home data, overwritten on export)
├── docker-compose.yml              # Local dev compose file
├── README.md                       # Repository readme
├── AGENTS.md                       # This file
├── INTEGRATION_PLAN.md             # Full technical plan for the tab integration
├── REPO_SETUP.md                   # Repository setup guide + CI/CD recommendations
├── test-data/                      # Test data directory
└── test-config                     # Test config file
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
  ├── <script> tags loading SH3D globals (sweethome3d.min.js, objExporter.js, etc.)
  │     These run first, creating window.application, window.homeComponent3D, etc.
  └── <div id="vue-app">   ← Vue mounts here
        position: fixed; width: 0; height: 0; z-index: 1000; pointer-events: none
        (zero-size container; individual components use position:fixed to escape it)
```

The `#vue-app` container is **zero-size and non-interactive by default**. Child views (TabBar, UnityView, SettingsView) use `position: fixed` to escape the zero-size container and take over the viewport. `pointer-events: all` is set on each interactive view.

### Tab routing

Vue Router is configured with **hash history** (`createWebHashHistory`). This means:
- URLs look like `http://host/#/`, `http://host/#/visualizer`, `http://host/#/settings`
- The server always receives just `/` — no nginx rewrite rules needed
- All PHP endpoints (`/readData.php`, etc.) are completely unaffected

| Route | Component | Behavior |
|-------|-----------|----------|
| `#/` | `FloorPlanView.vue` | Shows `#home-pane` (SweetHome3D DOM) |
| `#/visualizer` | `UnityView.vue` | Shows Unity iframe (kept alive via KeepAlive) |
| `#/settings` | `SettingsView.vue` | Shows settings form |

### SweetHome3D DOM toggle

SweetHome3D renders into `#home-pane` — a DOM node owned by vanilla JS, not Vue. Visibility is toggled via a route watcher in `App.vue`:

```typescript
watch(() => route.path, (path) => {
  const pane = document.getElementById('home-pane')
  if (!pane) return
  pane.style.display = path === '/' ? '' : 'none'
}, { immediate: true })
```

`#home-pane` has `position: absolute; top: 40px; left: 0; right: 0; bottom: 0` (added via `index.html` CSS). This makes `#home-pane` a positioning context so all its `position: absolute` children compute `100%` heights relative to it (viewport minus 40px tab bar), not `body`.

### Unity visualizer iframe

`UnityView.vue` embeds the pre-built Unity WebGL app:

```
┌─────────────────────────────────────────────────────────────────┐
│  UnityView.vue (position:fixed, top:40px → bottom:0)            │
│                                                                  │
│  onMounted:                                                      │
│    1. write localStorage['ha-smart-home-settings'] (latest)     │
│    2. set iframeSrc = '/unity-visualizer/index.html'            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  <iframe src="/unity-visualizer/index.html">             │   │
│  │    reads localStorage on load → window.smartHomeConfig   │   │
│  │    Unity C# calls window.getSmartHomeConfig() via jslib  │   │
│  │    connects to Home Assistant with token                  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  watch(route.path): if back to /visualizer after settings change│
│    → writeConfigToStorage() + postMessage(SMART_HOME_CONFIG_UPDATE)│
└─────────────────────────────────────────────────────────────────┘
```

`defineOptions({ name: 'UnityView' })` is **required** so `<KeepAlive :include="['UnityView']">` can identify and preserve this component across tab switches. Without KeepAlive, Unity would reload every time the user switches away.

### Settings store — `settingsStore.ts`

Pinia store with full `SmartHomeSettings` interface, auto-persisted to `localStorage['ha-smart-home-settings']`:

| Field group | Fields |
|-------------|--------|
| Home Assistant | `homeAssistantAddress`, `homeAssistantAccessToken`, `useSSL`, `trackedEntities` |
| MQTT (secondary) | `brokerIP`, `brokerPort`, `mqttUsername`, `mqttPassword`, `useWebSockets` |
| Visualization | `minTemp`, `maxTemp`, `interpolationPower`, `updateInterval`, `maxParticles`, `optimizeForWebGL` |
| Connection | `reconnectDelay`, `maxReconnectAttempts`, `connectionTimeout` |
| Bridge | `sensorBridgeType`, `forceHomeAssistantInEditor` |

`toUnityConfig()` returns a flat object that exactly matches the C# `ConfigurationData` struct in `WebGLConfigurationManager.cs` — no transformation needed on the Unity side.

`watch(settings, deep)` auto-saves to localStorage on every change. `update(patch)` merges a partial object. `reset()` restores factory defaults.

### Config delivery flow (localStorage → Unity)

```
SettingsView: Save clicked
  → store.update(local)
  → watch fires → localStorage['ha-smart-home-settings'] = JSON.stringify(settings)

User navigates to #/visualizer (first time)
  → UnityView.onMounted()
    1. writeConfigToStorage()  ← ensure localStorage is fresh
    2. iframeSrc = '/unity-visualizer/index.html'  ← triggers iframe load

Unity iframe loads:
  index.html <script> IIFE:
    → reads localStorage['ha-smart-home-settings']
    → builds window.smartHomeConfig from stored values

Unity C# starts:
  → WebGLConfigurationManager.RequestWebGLConfiguration()
  → window.getSmartHomeConfig() (jslib)  ← reads window.smartHomeConfig
  → ProcessConfiguration(json)
  → HomeAssistantConnector_WebGL.Connect(address, token)

User changes settings, returns to #/visualizer (KeepAlive, no reload):
  → UnityView watch(route.path)
    1. writeConfigToStorage()
    2. iframe.contentWindow.postMessage({ type: 'SMART_HOME_CONFIG_UPDATE', config })
  → Unity index.html 'message' listener updates window.smartHomeConfig in-place
```

### Key architectural patterns

#### 1. Dialog detection — `useFurnitureDialog.ts`
A `MutationObserver` on `document.body` watches for `div.home-furniture-dialog` being added/removed. The guard `el.closest('.dialog-template') === null` distinguishes the **live dialog** from the hidden template copy that always exists in the DOM.

```
SH3D opens dialog
  → MutationObserver fires (childList, subtree)
  → isLiveDialog() returns true
  → getFurnitureController() reads window.application.getHomes()[0].getSelectedItems()[0]
  → store.loadFromController(controller)  ← populates all reactive refs
  → teleportTarget = liveDialog.querySelector('[data-name="name-and-price-panel"]')
  → dialogOpen = true
```

#### 2. Dialog field injection — `FurnitureDialogEnhancer.vue`
Uses Vue `<Teleport>` to inject HA fields **into** the live SweetHome3D dialog grid, without modifying index.html or any SH3D source:

```html
<Teleport v-if="dialogOpen && teleportTarget" :to="teleportTarget">
  <!-- renders inside SH3D's name-and-price-panel grid -->
</Teleport>
```

Fields shown conditionally:
- `store.isSmartDevice` → HA Entity ID input + Effect Radius slider
- `store.isSwitchDevice` → Controls Entity ID input + Switch Type select

#### 3. Pinia store — `furnitureStore.ts`
Single source of truth for the currently-selected furniture piece's HA properties:

| Ref | Type | Property key |
|-----|------|-------------|
| `haEntityId` | `string` | `'haEntityId'` |
| `effectRadius` | `number` | `'effectRadius'` |
| `controlsEntityId` | `string` | `'controlsEntityId'` |
| `switchType` | `'pressure' \| 'fixed'` | `'switchType'` |

`loadFromController(controller)` reads all properties from the SH3D furniture object on dialog open. `commitProperty(key, value)` writes immediately via `setCustomProperty()` and queues in `pendingProps`. `flushPendingProps()` re-writes on dialog close.

#### 4. Property persistence — `furnitureService.ts`
Wraps the SH3D furniture property API:
```typescript
controller.getProperty(key)       // read
controller.setProperty(key, value) // write (null clears)
```
`getFurnitureController()` → `window.application.getHomes()[0].getSelectedItems()[0]`

#### 5. Device detection — `deviceDetection.ts`
`resolveCatalogId(furniture)` tries 5 ways to get the catalog ID (defensive, SH3D API varies):
1. `furniture.getCatalogId?.()`
2. `furniture.properties.catalogId`
3. `furniture.getProperty?.('catalogId')`
4. `furniture.getAdditionalProperties?.().entries` scan
5. `furniture.getCatalogPieceOfFurniture?.().getId?.()`

`isSmartDeviceFurniture(f)` → `catalogId.startsWith('ha_')` OR `creator === 'HA'` OR category contains `'smart'` OR IoT keyword in name/id.

`isSwitchFurniture(f)` → `catalogId.startsWith('ha_switch')` OR `catalogId === 'ha_light_dimmer'`.

### Build & dev commands
```bash
cd www-vue/

npm run dev      # Vite dev server
                 # publicDir = ../sweethome3d/www (serves SH3D files directly)
                 # Proxies PHP endpoints to localhost:8099
                 # Serves /unity-visualizer/* from ../unity-build/ (unity-visualizer-static plugin)

npm run build    # vue-tsc + vite build → dist/
                 # copyPublicDir: false (don't copy the 300MB SH3D assets)
```

`VITE_PHP_TARGET` env var overrides the PHP proxy target (default `http://localhost:8099`).

**Unity build prerequisite**: Place the pre-built Unity WebGL output at `ha-sweethome3d/unity-build/` before running `npm run dev` or `docker build`. The Unity build is not built as part of this repo's CI — see `REPO_SETUP.md` for the recommended CI/CD handoff between the two repos.

### Adding a new view/tab

To add a fourth tab:
1. Create `www-vue/src/views/MyView.vue` with `position: fixed; top: 40px; ...` and `z-index: 1500; pointer-events: all`
2. Add the route to `www-vue/src/router/index.ts`
3. Add a `<RouterLink to="/my-view">` to `TabBar.vue`
4. If the view must persist across tab switches (like Unity), add `defineOptions({ name: 'MyView' })` and add `'MyView'` to the `KeepAlive :include` array in `App.vue`

### Adding a new HA field (Vue approach)

This is the canonical way to add new fields to the furniture dialog. Do NOT add HTML to `sweethome3d/www/index.html` anymore.

**Step 1 — Add property ref to `furnitureStore.ts`:**
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

**Step 2 — Add the field to `FurnitureDialogEnhancer.vue`:**
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
Add any CSS to `<style scoped>` — no inline styles.

**Step 3 — Expose in export (if needed):**
In `sweethome3d/www/lib/unity-export-utils.js`, inside `extractDeviceMetadata()`:
```javascript
const myProp = piece.getProperty('myProp')
if (myProp) deviceData.myProp = myProp
```

### Type definitions — `sweethome3d.d.ts`
Ambient global file (no `export {}`). Declares:
- `interface SH3DFurniture` — `getCatalogId`, `getProperty`, `setProperty`, `getAdditionalProperties`, etc.
- `interface SH3DApplication` — `getHomes()`
- `interface Window` — `application`, `homeComponent3D`, `OBJExporter`, `UnityExportUtilities`

Add new SH3D API methods here when you need to call them from TypeScript.

---

## Export Pipeline (SweetHome3D → Unity)

### How It Works
```
User clicks "📦 Export for Unity" (or Ctrl+E)
  ↓
exportForUnity() in index.html
  ↓
UnityExportUtilities.exportForUnity(home, component3D, baseName)
  ├── 1. OBJExporter.exportToOBJ() → {baseName}_geometry.zip
  │     ├── Traverses home.getWalls(), getRooms(), getFurniture()
  │     ├── Exports wall geometry with textures
  │     ├── Exports room floors/ceilings
  │     ├── Loads furniture 3D models from URLs (ZIP containing OBJ)
  │     ├── Transforms furniture positions and applies textures
  │     ├── Builds OBJ + MTL file content
  │     └── Creates ZIP with OBJ, MTL, and texture images
  ├── 2. extractDeviceMetadata(home) → {baseName}_devices.json
  │     ├── Scans furniture for IoT devices (ha_ prefix in catalog ID)
  │     ├── Converts positions from cm to meters
  │     ├── Reads haEntityId from furniture properties
  │     ├── Calculates effect propagation areas (room-bounded)
  │     ├── Extracts room polygons and wall segments
  │     └── Returns JSON with devices, rooms, walls
  └── 3. generateUnityImportScript() → {baseName}_Import.cs
        └── Auto-generated C# script for Unity editor import
```

### Exported Files

#### 1. `{homeId}_geometry.zip`
Contains:
- `{homeId}.obj` — 3D mesh (vertices, normals, UVs, faces)
- `{homeId}.mtl` — Material definitions (colors, textures, shininess)
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
    "displaySuffix": "°C",
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
- **Exported JSON**: meters (divided by 100), with SH3D Y → Unity Z mapping
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
   - "📦 Export for Unity" → full export (geometry + JSON + C# script)
   - "🔷 Export to OBJ" → geometry only

4. **Smart Device Counter** (catalog panel, bottom-right)
   - Shows count of IoT devices in current design
   - Updated every 2 seconds

5. **Keyboard Shortcuts**
   - `Ctrl+E` → Export for Unity
   - `Ctrl+Shift+E` → Export to OBJ

### Smart Device Detection
A furniture piece is considered a smart device if:
1. Catalog ID starts with `ha_` (e.g., `ha_temperature_sensor`)
2. OR `properties.catalogId` starts with `ha_`
3. OR `creator` property is `"HA"`
4. OR category name contains `"Smart"`

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

**Use the Python automation script** — it handles model ZIP, icon, and catalog in one command:

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
2. Rescale to fit within the given `--width`×`--depth`×`--height` box
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
"model#N":        "lib/resources/models/ha-{name}.zip!/temp-ha-{name}/ha-{name}.obj",
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

> **`catalogId`** must start with `ha_` · **`creator`** must be `"HA"` · **`category`** must contain "Smart" · **`modelSize`** must match the actual ZIP byte count

#### Updating export logic (if new device type)

- `UnityExportUtilities.getDeviceType()` — classify the new device type for Unity
- `UnityExportUtilities.getParticleSettings()` — configure particle visualization
- Both can be patched automatically via `--device-type` and `--particle-color` script args

#### Unity side

- Add prefab to the project
- Update `SceneAutoSetup` inspector:
  - `lightPrefab`: for bulbs/ceiling lamps (`ha_light_bulb`, `ha_light_ceiling`)
  - `lightSwitchPrefab`: for wall switches/dimmers (`ha_light_dimmer`, `ha_switch_plug`)

---

### Replacing an Existing Device Model

Use this when upgrading a cube device to a real 3D model (e.g., a Meshy.ai export).

**Step 1 — Delete the old ZIP:**
```bash
rm sweethome3d/www/lib/resources/models/ha-{name}.zip
```

**Step 2 — Remove the old catalog entries** (all 14 keys for that device's index):
```python
python -c "
import json, re
path = 'sweethome3d/www/lib/resources/DefaultFurnitureCatalog.json'
with open(path, 'r', encoding='utf-8') as f:
    cat = json.load(f)
target = 'ha_sensor_temp_humidity'  # ← change to your catalogId
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

**Step 3 — Re-run the script** with the same `--name` and `--catalog-id` but `--external-obj` pointing to the new model folder. The script assigns the next free index automatically.

> The PNG icon file is rewritten in-place (same path) — no need to delete it first.

> **Why the index changes**: The script never overwrites an existing ZIP. Deleting the ZIP frees the name for reuse, but the catalog index (#N) advances to the next available number. This is harmless — SweetHome3D always looks up devices by `catalogId`.

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

---

### Modifying Export Format
- **Add JSON fields**: Edit `UnityExportUtilities.extractDeviceMetadata()`
- **Change OBJ output**: Edit `OBJExporter.buildOBJContent()` / `buildMTLContent()`
- **Add texture handling**: Edit `OBJExporter.parseMTLTextures()`
- **Coordinate conversion**: Check `integrateOBJContent()` for transform math

### Debugging Export Issues
1. Open browser DevTools console
2. Run `exportForUnity()` manually
3. Check console for `📤`, `✅`, `❌` prefixed logs
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
3. Start → access via HA sidebar

---

## Known Gotchas

| Issue | Details |
|-------|---------|
| `sweethome3d.min.js` is 2.5MB | Do NOT modify; all customizations via separate scripts |
| Furniture model loading is async | `exportModelFromURL()` uses JSZip to load from URLs |
| Entity ID persistence | Uses `furniture.setProperty()` / `getProperty()` API |
| Effect radius renderer | `effect-radius-renderer.js` removed — was commented out and non-functional |
| Coordinate units | SH3D internal = cm; JSON export = meters; OBJ geometry = cm |
| Material color parsing | Historical bug with `flyellow` appearing pink — fixed via `objDefaults.js` |
| Vue dialog detection guard | `isLiveDialog()` checks `el.closest('.dialog-template') === null` — SH3D keeps a hidden template copy in the DOM at all times; without this guard the observer fires twice |
| Vue `<Teleport>` target | Teleports into `[data-name="name-and-price-panel"]` — a CSS grid inside the live dialog. Vue fields inherit the grid layout, so they appear as natural rows |
| `furnitureStore.flushPendingProps()` | Writes all pending properties again on dialog close (belt-and-suspenders). This means each property write happens twice: once on `@change`, once on close |
| Vue overlay `pointer-events` | `#vue-app` is `pointer-events: none; width: 0; height: 0`. Views escape via `position: fixed; pointer-events: all`. Without zero-size `#vue-app`, the overlay would block SH3D mouse input |
| `vite build` copies no public assets | `copyPublicDir: false` — the SH3D `www/` files are served separately by nginx; the Vite build only outputs the Vue bundle |
| `#home-pane` positioning context | Adding `position: absolute; top: 40px` to `#home-pane` in `index.html` makes it a positioning context. All SH3D children (`position: absolute`) now resolve heights relative to `#home-pane` (viewport minus 40px), not `body`. Do NOT change this CSS — removing it breaks the SH3D layout |
| Unity iframe `KeepAlive` | `UnityView.vue` MUST have `defineOptions({ name: 'UnityView' })`. Without the named component, KeepAlive's `:include="['UnityView']"` cannot match it and Unity reloads on every tab switch |
| Unity Brotli files | Unity WebGL output uses `.wasm.br`, `.js.br`, `.data.br` pre-compressed files. nginx must set `Content-Encoding: br` + correct MIME type + `gzip off` for each. The Vite dev server handles this via the `unity-visualizer-static` plugin. Missing these headers causes the browser to display a load error |
| Unity `window.getSmartHomeConfig()` | This function in `unity-build/index.html` is called by C# `WebGLConfigurationManager` via jslib. Do NOT rename or remove it. It reads from `window.smartHomeConfig` (built from localStorage) and returns a flat JSON string matching `ConfigurationData` |
| Export buttons visibility | `<ExportButtons v-if="route.path === '/'"` in `App.vue`. Keyboard shortcuts (Ctrl+E) are also gated by this; they only make sense on the Floor Plan tab |
| Unity build must exist for Docker | The `Dockerfile` has `COPY unity-build/ /var/www/html/unity-visualizer/`. If `unity-build/` is empty (only `.gitkeep`), the Unity tab will show a blank iframe. Place a real build before `docker build` |
| `X-Frame-Options: SAMEORIGIN` | Already set in nginx.conf. This allows the Unity iframe because both the parent Vue app and the iframe origin are on the same host/port. No change needed |

---

## Companion Project

This app works with the **Unity Smart Home Visualizer** (`smart-home-visualizer` repo):
- Path: `../smart-home-visualizer/`
- AGENTS.md: `../smart-home-visualizer/AGENTS.md`
- Import side: `SceneAutoSetup.cs` loads the exported ZIP + JSON
- Unity WebGL build is placed at `ha-sweethome3d/unity-build/` and served at `/unity-visualizer/`
- Config bridge: `smart-home-visualizer/Assets/WebGLTemplates/Default/index.html` reads from `localStorage['ha-smart-home-settings']` which is written by `settingsStore.ts`

### Repository relationship

The two repos are **kept separate** (different toolchains, different release cadences). The integration point is the Unity **WebGL build output** — a folder of static files that `ha-sweethome3d` serves at `/unity-visualizer/` inside the Docker image.

See **`REPO_SETUP.md`** (in this repo root) for:
- Rationale for not using a monorepo or git submodule
- Recommended GitHub Actions CI/CD workflows for both repos (game-ci Unity builder)
- Local development setup options (build Unity yourself, download release, copy from colleague)
- `.gitignore` recommendations
- Versioning strategy (matching `v*` tags across both repos)

### Unity WebGL build location

```
ha-sweethome3d/unity-build/
├── .gitkeep                    ← tracked; keeps dir in git
├── index.html                  ← Unity entry point (localStorage reader)
├── Build/
│   ├── Build.loader.js
│   ├── Build.wasm.br           ← WebAssembly (Brotli compressed)
│   ├── Build.framework.js.br   ← Unity framework (Brotli)
│   └── Build.data.br           ← Scene data (Brotli)
├── TemplateData/
│   ├── style.css
│   └── favicon.ico
└── StreamingAssets/
    └── smart-viz-files/
        ├── home-{id}_devices.json    ← IoT device metadata (overwritten by exportForUnity.php)
        └── home-{id}_geometry.zip   ← 3D model OBJ+MTL (overwritten by exportForUnity.php)
```

The `StreamingAssets/smart-viz-files/` data bundled in the Unity build is only a default/demo dataset — the live export from the SweetHome3D editor always overwrites it.

---

*Last updated: March 26, 2026*
