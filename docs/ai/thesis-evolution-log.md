# Thesis Evolution Log (`ha-sweethome3d`)

Concise ledger of **architectural evolutions and core engineering trade-offs** in `ha-sweethome3d` that should be reflected in `../smart-home-thesis-intro/`.

- Log **genuine evolutions, protocol shifts, and design trade-offs** only (skip routine CSS tweaks or minor bugfixes).
- `../smart-home-thesis-intro/scripts/check-code-sync.py` reads every **`[ ] Pending`** entry automatically.
- Mark entries **`[x] Covered`** once reflected in the thesis/papers.

## Entry Template

```markdown
### YYYY-MM-DD — Short Evolution Title
- **Status**: `[ ] Pending`
- **Before → After**: Previous approach → new approach
- **Rationale / Trade-off**: Why the change was made and what trade-off it introduces
- **Affected Files**: `www-vue/src/...` or `sweethome3d/www/...`
- **Suggested Thesis Target**: Chapter / Paper / Diagram / Listing
```

---

## Recorded Evolutions

### 2026-03 — Inline HTML/JS Augmentation to Non-Invasive Vue 3 Overlay
- **Status**: `[x] Covered`
- **Before → After**: Polling `setInterval` + inline HTML injected into `sweethome3d/www/index.html` → standalone **Vue 3.5 + TypeScript + Pinia** overlay (`www-vue/`) using `MutationObserver` + `<Teleport>` into live SweetHome3D dialogs without modifying `sweethome3d.min.js`.
- **Rationale / Trade-off**: Decouples custom IoT authoring UI from the 2.5 MB minified upstream core while keeping upgrade compatibility; trades a narrow DOM selector dependency (`.home-furniture-dialog`, `[data-name="name-and-price-panel"]`).
- **Affected Files**: `www-vue/src/composables/useFurnitureDialog.ts`, `www-vue/src/components/dialogs/FurnitureDialogEnhancer.vue`
- **Suggested Thesis Target**: `Chapters/6. Discussion.tex`, `Paper-1-Authoring/Paper-1-Authoring.tex`

### 2026-06 — Native PHP RFC6455 Lovelace WebSocket Client (`LovelaceWs.php`)
- **Status**: `[ ] Pending`
- **Before → After**: Attempted REST calls to Supervisor API / manual iframe YAML copy-paste → dependency-free RFC6455 PHP WebSocket client (`LovelaceWs.php`) over `ws://supervisor/core/websocket` powering one-click "Add to Dashboard" (`addDashboardCard.php`) and sidebar icon registration (`registerIcon.php`), plus standalone `?homeId=` Unity iframe loading.
- **Rationale / Trade-off**: HA Core exposes Lovelace management exclusively over WebSocket (no REST endpoint); zero-dependency PHP avoids adding Python/Composer to the Alpine container, requiring `clear_env = no` in `php-fpm.conf` and graceful fallback for YAML/`sections` dashboards.
- **Affected Files**: `sweethome3d/www/lib/LovelaceWs.php`, `sweethome3d/www/addDashboardCard.php`, `sweethome3d/www/listDashboards.php`, `sweethome3d/rootfs/etc/php82/php-fpm.conf`
- **Suggested Thesis Target**: `Chapters/3. Development.tex`, `Chapters/6. Discussion.tex`, `Figures/diagrams/dashboard-integration-flow.puml`
