# Vue 3 Frontend Overlay Reference (`www-vue/`)

`www-vue/` is a **Vue 3.5 + TypeScript 5.9 + Pinia + Vue Router 4** SPA that overlays the SweetHome3D JS editor without modifying `sweethome3d.min.js`.

## Overlay Mount & Routing

```
www-vue/index.html
├── <script> tags loading SweetHome3D globals (window.application, window.homeComponent3D, OBJExporter, UnityExportUtilities)
└── <div id="vue-app">   (position: fixed; width: 0; height: 0; z-index: 1000; pointer-events: none)
      ├── TabBar.vue (position: fixed; top: 0; height: 40px; z-index: 2000)
      ├── RouterView (#/ FloorPlanView, #/settings SettingsView)
      ├── UnityView.vue (mounted directly in App.vue via v-show="route.path === '/visualizer'")
      ├── FurnitureDialogEnhancer.vue (<Teleport> into live SH3D dialog)
      └── ExportButtons.vue (v-if="route.path === '/'")
```

- **Hash history (`createWebHashHistory`)**: Routes `#/`, `#/visualizer`, `#/settings` keep server requests at `/`, leaving PHP endpoints unaffected. `urlBase` in `www-vue/index.html` must derive from `origin + pathname` (never `href`).
- **Toggling `#home-pane`**: Hide with `visibility: hidden; position: absolute; pointer-events: none` (never `display: none`, which collapses SH3D splitters) and dispatch `window.dispatchEvent(new Event('resize'))` when restoring `#/`.
- **Iframe persistence**: `UnityView.vue` stays permanently in the DOM via `v-show` (never `<KeepAlive>`, which detaches/reattaches DOM and reloads WebGL).

## Settings Store & Unity Config Delivery (`settingsStore.ts`)

Auto-persists `SmartHomeSettings` to `localStorage['ha-smart-home-settings']`:
- **Home Assistant**: `homeAssistantAddress`, `homeAssistantAccessToken`, `useSSL`, `trackedEntities`
- **MQTT (secondary)**: `brokerIP`, `brokerPort`, `mqttUsername`, `mqttPassword`, `useWebSockets`
- **Visualization**: `minTemp`, `maxTemp`, `interpolationPower`, `updateInterval`, `maxParticles`, `optimizeForWebGL`
- **Connection / Bridge**: `reconnectDelay`, `maxReconnectAttempts`, `connectionTimeout`, `sensorBridgeType`, `forceHomeAssistantInEditor`

`toUnityConfig()` returns a flat object matching C# `ConfigurationData` in `WebGLConfigurationManager.cs`. When returning to `#/visualizer` after editing settings, `UnityView.vue` writes `localStorage` and sends `postMessage({ type: 'SMART_HOME_CONFIG_UPDATE', config })` to the iframe.

## Furniture Dialog Enhancement

1. `useFurnitureDialog.ts` runs a `MutationObserver` on `document.body` for `div.home-furniture-dialog` with guard `el.closest('.dialog-template') === null` (ignores SH3D's hidden template copy).
2. Reads controller via `window.application.getHomes()[0].getSelectedItems()[0]`, loads properties into `furnitureStore.ts`, and teleports fields into `[data-name="name-and-price-panel"]`.
3. `deviceDetection.ts` checks 5 ways to resolve `catalogId`: `getCatalogId()`, `properties.catalogId`, `getProperty('catalogId')`, `getAdditionalProperties().entries`, `getCatalogPieceOfFurniture().getId()`.
4. `furnitureStore.ts` commits properties via `controller.setProperty(key, value)` on `@change` and flushes again on dialog close (`flushPendingProps()`).

## Adding a New HA Field (Canonical Vue Approach)

1. Add a `ref` in `www-vue/src/stores/furnitureStore.ts` (`loadFromController`, `reset`, return object).
2. Add the field row inside `FurnitureDialogEnhancer.vue` (`<Teleport>`, `<style scoped>`, call `store.commitProperty(...)`).
3. If exported to Unity, read `piece.getProperty('myProp')` inside `UnityExportUtilities.extractDeviceMetadata()` in `sweethome3d/www/lib/unity-export-utils.js`.
4. Add any new SH3D globals to `www-vue/src/types/sweethome3d.d.ts` (ambient file, no `export {}`).

## Adding a New Tab View

1. Create `www-vue/src/views/MyView.vue` (`position: fixed; top: 40px; left: 0; right: 0; bottom: 0; z-index: 1500; pointer-events: all`).
2. Register route in `src/router/index.ts` and link in `TabBar.vue`.
3. If DOM must survive tab switches (e.g., WebGL/iframes), mount directly in `App.vue` with `v-show`.
