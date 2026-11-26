---
name: release-and-deploy-addon
description: >-
  Build the Vue 3 frontend, sync Unity WebGL assets, verify LF line endings and
  3-copy index.html parity, test locally in Docker, and deploy ha-sweethome3d to
  Home Assistant or prepare a GitHub Add-on Store release.
---

# Build, Verify & Deploy `ha-sweethome3d`

## Steps

1. **Type-check & build Vue overlay**:
   ```bash
   cd www-vue && npm run type-check && npm run build && cd ..
   ```
2. **Sync compiled assets & Unity WebGL build**:
   - **macOS / Linux**: `./scripts/setup.sh` (builds Vue, overlays `www-vue/dist/` into `sweethome3d/www/`, copies `unity-build/` into `sweethome3d/www/unity-visualizer/`, sets executable bits, runs `verify.sh`).
   - **Windows (to local HA via Samba)**: `.\scripts\deploy-local.ps1` (reads `HA_HOST` from `.env`, defaults to `homeassistant.local`, normalizes LF on container scripts, copies `sweethome3d/` to `\\$HA_HOST\addons\sweethome3d`).
   - **macOS (to local HA via Samba)**: `./scripts/deploy-local.sh` (uses `smbclient` or `/Volumes/addons`).
3. **Run full verification gate**:
   - **macOS / Linux**: `./scripts/verify.sh --full`
   - **Windows**: `.\scripts\verify.ps1`
   - Confirms: required config/s6 files, hashed Vue JS/CSS assets, Unity WebGL build presence, LF line endings on container scripts, and 3-copy Unity `index.html` parity.
4. **Local Docker smoke test**:
   ```bash
   docker-compose up --build
   ```
   Open `http://localhost:8099` and verify Floor Plan, 3D Visualizer (`/unity-visualizer/` Brotli load), and Settings tabs.
5. **Preparing a GitHub Add-on Store release**:
   - Home Assistant Supervisor builds the Docker image directly on users' machines, so compiled `sweethome3d/www/assets/` and `sweethome3d/www/unity-visualizer/` MUST be committed before tagging (`v*`, matching `smart-home-visualizer` tags).
   - Bump `version` in `sweethome3d/config.yaml` when cutting a release.
