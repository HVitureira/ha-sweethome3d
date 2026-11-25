# Vue 3 Overlay (`www-vue/`) — Subtree Guide

Vue 3.5 + TypeScript 5.9 (`strict`) + Pinia + Vue Router 4 (hash history) + Vite 6 overlay mounted into `#vue-app` on top of SweetHome3D JS.

## Commands

- `npm run dev` — Vite dev server with `sh3d-dev-backend` middleware (emulates PHP via `../test-data/`, serves `/unity-visualizer/` from `../unity-build/` — **no Docker needed**).
- `npm run type-check` — `vue-tsc --noEmit` (run before every commit).
- `npm run build` — `vue-tsc && vite build` (`copyPublicDir: false`).

## Critical Overlay Invariants

- `#vue-app` is `position: fixed; width: 0; height: 0; pointer-events: none`. Views escape via `position: fixed; top: 40px; pointer-events: all`.
- Use hash history (`createWebHashHistory`); `index.html` must compute `urlBase` from `origin + pathname` (never `href`).
- Toggle `#home-pane` with `visibility: hidden; position: absolute; pointer-events: none` + `window.dispatchEvent(new Event('resize'))` on restore (never `display: none`).
- Keep `UnityView.vue` rendered directly in `App.vue` with `v-show` (never `<KeepAlive>` — detaching reloads the WebGL iframe).
- Dialog detection (`useFurnitureDialog.ts`) must guard `el.closest('.dialog-template') === null`; inject HA fields via `<Teleport>` in `FurnitureDialogEnhancer.vue` with `<style scoped>`.
- Declare new SH3D globals in `src/types/sweethome3d.d.ts` (ambient, no `export {}`).

See [docs/ai/vue-overlay.md](../docs/ai/vue-overlay.md) and [docs/ai/known-gotchas.md](../docs/ai/known-gotchas.md).
