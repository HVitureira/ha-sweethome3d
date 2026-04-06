# Tab Integration: SweetHome3D + Unity Visualizer + HA Settings

## Context

The HA addon (`ha-sweethome3d`) currently runs SweetHome3D as a vanilla JS floor-plan editor with a thin Vue 3 overlay that adds smart-device HA fields to the furniture dialog and provides export buttons. The Unity WebGL visualizer (`smart-home-visualizer`) is a separate Unity project that connects to Home Assistant via a long-lived token and loads the exported 3D home geometry in a browser.

**Problem**: The two apps are completely disconnected. There is no way to switch between editing the floor plan and viewing it in 3D, and HA credentials (token, server address) are hardcoded in the Unity build template.

**Goal**: Transform the addon into a unified tabbed interface with:
1. **Floor Plan** tab — the existing SweetHome3D editor (unchanged functionality)
2. **3D Visualizer** tab — Unity WebGL, embedded as an iframe, loading the exported home
3. **Settings** tab — a form for HA server address, long-lived token, and Unity visualizer parameters; settings persist in `localStorage` and are injected into Unity on every load

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Browser                                                         │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Tab Bar (Vue, position:fixed, top:0, z-index:2000, 40px) │  │
│  │  [ Floor Plan ]  [ 3D Visualizer ]  [ Settings ]          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Content Area (top: 40px → bottom: 0)                      │  │
│  │                                                             │  │
│  │  Active Tab A: SweetHome3D (#home-pane, absolute, 40px→)  │  │
│  │      [Furniture Catalog] [Floor Plan] [3D View]            │  │
│  │                              ↑                              │  │
│  │  Vue overlay (z-index:1000): FurnitureDialogEnhancer       │  │
│  │                              ExportButtons (fixed BL)       │  │
│  │                                                             │  │
│  │  Active Tab B: Unity WebGL iframe (position:fixed, 40px→) │  │
│  │      [Unity canvas — full viewport below tab bar]          │  │
│  │                                                             │  │
│  │  Active Tab C: Settings form (position:fixed, 40px→)      │  │
│  │      [HA Address]  [Token]  [Viz params]  [Save]           │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Reason |
|---|---|---|
| Router mode | Hash (`#/visualizer`) | No server rewrite rules needed; PHP endpoints unaffected |
| Unity embedding | `<iframe>` | Clean isolation; Unity has its own DOM, loading bar, fullscreen button |
| `KeepAlive` on `UnityView` | Yes | Unity must not reload on tab switch |
| Config delivery | `localStorage` on first load + `postMessage` for live updates | localStorage read before Unity starts; postMessage for subsequent changes |
| SweetHome3D visibility | `document.getElementById('home-pane').style.display` | Direct DOM toggle — Vue cannot own SH3D's DOM |
| `#home-pane` positioning | `position: absolute; top: 40px` | Makes it a positioning context so children compute heights relative to it |
| Unity build location | `ha-sweethome3d/unity-build/` | Pre-built; served via Vite middleware in dev and nginx in production |
| ExportButtons visibility | `v-if="route.path === '/'"` | Export only makes sense on the floor plan tab |

---

## Config Data Flow

```
Settings tab → store.update() → watch(deep) → localStorage['ha-smart-home-settings']
                                                        ↓
First visit to /visualizer:                   Return visit (KeepAlive):
  onMounted:                                    watch(route.path):
  1. writeConfigToStorage()                     1. writeConfigToStorage()
  2. iframeSrc = '/unity-visualizer/'           2. postMessage → iframe

Unity iframe index.html:
  On load  → reads localStorage → window.smartHomeConfig
  On msg   → updates window.smartHomeConfig in-place

C# WebGLConfigurationManager (unchanged):
  RequestWebGLConfiguration() → window.getSmartHomeConfig() → ProcessConfiguration()
```

---

## Files Created

| File | Purpose |
|---|---|
| `www-vue/src/router/index.ts` | Hash router, 3 routes |
| `www-vue/src/stores/settingsStore.ts` | HA settings + viz params, auto-persisted to localStorage |
| `www-vue/src/components/layout/TabBar.vue` | 40px fixed nav, dark theme |
| `www-vue/src/views/FloorPlanView.vue` | Empty template (router placeholder) |
| `www-vue/src/views/UnityView.vue` | `<iframe>` + lazy src + postMessage config injection |
| `www-vue/src/views/SettingsView.vue` | HA address, token, viz params form |

## Files Modified

| File | Change |
|---|---|
| `www-vue/package.json` | Added `vue-router: ^4.5.0` |
| `www-vue/src/main.ts` | Added `.use(router)` |
| `www-vue/src/App.vue` | TabBar + RouterView(KeepAlive) + `#home-pane` watcher + conditional ExportButtons |
| `www-vue/index.html` | Added CSS: `#home-pane { position:absolute; top:40px; left:0; right:0; bottom:0 }` |
| `www-vue/vite.config.ts` | Added `unity-visualizer-static` dev middleware |
| `sweethome3d/Dockerfile` | Added `COPY unity-build/ /var/www/html/unity-visualizer/` |
| `sweethome3d/rootfs/etc/nginx/nginx.conf` | Added `/unity-visualizer/` location with Brotli MIME headers |
| `smart-home-visualizer/.../WebGLTemplates/Default/index.html` | Replaced hardcoded config with localStorage reader + postMessage listener |

---

## Unity Build

The Unity WebGL build is pre-built and placed at `ha-sweethome3d/unity-build/`:

```
unity-build/
├── index.html
├── Build/
│   ├── Build.loader.js
│   ├── Build.wasm.br
│   ├── Build.framework.js.br
│   └── Build.data.br
├── TemplateData/
│   ├── style.css
│   └── favicon.ico
└── StreamingAssets/
    └── smart-viz-files/
        ├── home-XXXX_devices.json
        └── home-XXXX_geometry.zip
```

Served at `/unity-visualizer/` in both dev (Vite middleware) and production (nginx).

---

## Verification

1. `npm run dev` in `www-vue/` → tab bar visible, SweetHome3D works on Floor Plan tab
2. Settings tab → fill HA address + token → Save → check DevTools localStorage
3. 3D Visualizer tab → Unity iframe loads, console shows `[SmartHome] Config loaded from localStorage`
4. Tab switch back and forth → Unity does NOT reload (KeepAlive)
5. Change settings → return to visualizer → `[SmartHome] Config updated via postMessage` in console
6. Docker: `curl -I /unity-visualizer/Build/Build.wasm.br` → `Content-Type: application/wasm`, `Content-Encoding: br`

---

## nginx Brotli Block

Unity WebGL uses Brotli pre-compressed files. nginx must serve them with correct MIME types and `Content-Encoding: br`. The `gzip off` directive prevents nginx from trying to re-compress already-compressed data.

```nginx
location /unity-visualizer/ {
    alias /var/www/html/unity-visualizer/;
    try_files $uri =404;
    location ~* \.wasm\.br$ { default_type application/wasm; add_header Content-Encoding br always; gzip off; }
    location ~* \.js\.br$   { default_type application/javascript; add_header Content-Encoding br always; gzip off; }
    location ~* \.data\.br$ { default_type application/octet-stream; add_header Content-Encoding br always; gzip off; }
}
```
