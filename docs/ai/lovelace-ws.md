# HA Dashboard Integration (Lovelace WebSocket)

## Why WebSocket (Not REST)

Lovelace dashboard/card/resource APIs (`lovelace/config`, `lovelace/config/save`, `lovelace/dashboards/list`, `lovelace/resources*`) have **no REST equivalent** in Home Assistant Core. They are reachable from inside the add-on container only via `ws://supervisor/core/websocket`, authenticated with `SUPERVISOR_TOKEN`. Calling REST paths such as `http://supervisor/core/api/lovelace/resources` returns 404.

## `sweethome3d/www/lib/LovelaceWs.php`

Minimal, dependency-free RFC6455 WebSocket client (`stream_socket_client`, manual framing/handshake — no `exec()`, no Python, no Composer dependencies):

- `lovelace_ws_connect_and_auth()` — connects to `ws://supervisor/core/websocket`, completes `auth_required → auth → auth_ok` using `SUPERVISOR_TOKEN`.
- `lovelace_ws_list_dashboards()` — queries `lovelace/dashboards/list` + `lovelace/config` per dashboard → `[{url_path, title, views: [{index, title}]}]`.
- `lovelace_ws_add_card(array $args)` — appends a card and saves via `lovelace/config/save`. Detects YAML-mode / strategy / newer `sections` view layouts (no flat `cards` array) and returns `{ok: false, reason: 'unsupported_view_layout', card}` so the frontend displays a copy-paste fallback.
- `lovelace_ws_register_resource(string $url, string $marker)` — lists resources via `lovelace/resources`, removes stale `$marker` entries, and creates the current entry via `lovelace/resources/create`.

## Three Consumers

1. **`sweethome3d/www/listDashboards.php`** (GET) — populates Dashboard/View dropdowns in `UnityView.vue`.
2. **`sweethome3d/www/addDashboardCard.php`** (POST `{homeId, urlPath, viewIndex}`) — resolves `ingress_entry` via Supervisor `GET /addons/self/info`, builds `{type: 'iframe', url: '{ingress_entry}/unity-visualizer/index.html?homeId={homeId}', ...}`, and writes via `lovelace_ws_add_card()`.
3. **`sweethome3d/www/lib/registerIcon.php`** (CLI, invoked by `rootfs/etc/cont-init.d/00-sweethome3d.sh`) — registers the custom sidebar icon resource (`panel_icon: custom:ha-sweethome3d:logo`).

## Standalone `?homeId=` Scene Loading (Iframe Card Mode)

When rendered inside a Lovelace iframe card, there is no parent Vue app to `postMessage({type: 'LOAD_HOME', ...})`. Instead, Unity's `index.html` reads `?homeId=` from `location.search`, derives `baseUrl` from `window.location` (stripping `/unity-visualizer`), and calls `SendMessage('SceneSetup', 'LoadHomeFromWeb', ...)` via `window.pendingLoadHome`.

> Remember the **3-copy Unity `index.html` invariant** — always edit `../smart-home-visualizer/Assets/WebGLTemplates/SmartHome3D/index.html` first and sync to `unity-build/index.html` and `sweethome3d/www/unity-visualizer/index.html`.
