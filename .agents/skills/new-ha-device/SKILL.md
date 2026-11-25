---
name: new-ha-device
description: >-
  Add a new Home Assistant smart device to the SweetHome3D catalog or replace
  an existing device model (cube mode or external Meshy.ai OBJ mode). Updates
  model ZIP, PNG icon, DefaultFurnitureCatalog.json, and optionally unity-export-utils.js.
---

# Add or Replace HA Smart Device

Use `.agents/skills/new-ha-device/scripts/create_ha_device.py` to generate or package a device ZIP (`temp-{name}/{name}.obj`), PNG icon, and all 14 `DefaultFurnitureCatalog.json` properties without index collisions.

For catalog JSON schema, typical category dimensions, Meshy prompts, and the current catalog index table, read [references/catalog-reference.md](./references/catalog-reference.md).

## Modes

- **Cube mode** (default): solid-color box, Python stdlib only, requires `--color "R,G,B"`.
- **External OBJ mode**: decimates & rescales a Meshy.ai / OBJ+MTL+PNG folder via `trimesh`. Requires one-time `pip install trimesh fast-simplification`.

## Replacing an Existing Device Model

The script refuses to overwrite an existing ZIP. To upgrade a cube device to a real 3D model:
1. Delete the old ZIP: `rm sweethome3d/www/lib/resources/models/ha-{name}.zip`
2. Remove all 14 catalog keys for that `catalogId` from `sweethome3d/www/lib/resources/DefaultFurnitureCatalog.json` (SweetHome3D matches by `catalogId`, so a new `#N` index is safe).
3. Re-run the script below with `--external-obj` (PNG icon is overwritten in place).

## Step 1 — Collect Required Parameters

- `name` — kebab-case slug (auto-prefixed with `ha-`, e.g., `co2-sensor`)
- `display-name` — human-readable label (e.g., `"CO2 Sensor"`)
- `catalog-id` — unique ID (auto-prefixed with `ha_`, e.g., `ha_co2_sensor`)
- `category` — exact match: `Smart Sensors` | `Smart Lights` | `Smart Switches` | `Smart Thermostats` | `Smart Cameras`
- `width`, `depth`, `height`, `elevation` — in centimeters (set `--height` to the model's dominant vertical axis)
- Cube mode: `--color "R,G,B"` (0–255)
- External OBJ mode: `--external-obj PATH` and optional `--target-faces 2000`, `--color`
- Optional export patch: `--device-type`, `--particle-color "R,G,B,A"`, `--tags`

## Step 2 — Run the Script (Standalone From Repo Root)

The script auto-detects the repo root (no `--project-root` needed when run inside `ha-sweethome3d/`):

```bash
# Cube mode (macOS / Linux / Windows)
python3 .agents/skills/new-ha-device/scripts/create_ha_device.py \
  --name "NAME" \
  --display-name "DISPLAY_NAME" \
  --catalog-id "CATALOG_ID" \
  --category "CATEGORY" \
  --color "R,G,B" \
  --width WIDTH --depth DEPTH --height HEIGHT --elevation ELEVATION
```

```bash
# External OBJ mode
python3 .agents/skills/new-ha-device/scripts/create_ha_device.py \
  --name "NAME" \
  --display-name "DISPLAY_NAME" \
  --catalog-id "CATALOG_ID" \
  --category "CATEGORY" \
  --width WIDTH --depth DEPTH --height HEIGHT --elevation ELEVATION \
  --external-obj "PATH/TO/OBJ_FOLDER" \
  --target-faces 2000
```

*(On Windows, substitute `python` if `python3` is not aliased.)*

## Step 3 — Verify & Report

1. Confirm exit code `0` and check printed catalog index (`#N`), `catalogId`, final scaled dimensions, and ZIP byte size.
2. Run `./scripts/verify.sh` (macOS/Linux) or `.\scripts\verify.ps1` (Windows).
3. If a new Unity prefab/consumer is needed, follow `../smart-home-visualizer/.agents/skills/add-ha-device-consumer/SKILL.md`.
