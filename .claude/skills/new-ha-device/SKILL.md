---
name: new-ha-device
description: >
  Automates adding a brand-new HA smart device to the SweetHome3D project from
  scratch, OR replacing an existing device's model with a better one. Two modes:
  (1) Cube mode — generates OBJ+MTL colored-cube geometry from parameters;
  (2) External OBJ mode — takes a Meshy.ai (or other) OBJ export folder,
  decimates it with trimesh, rescales to target dimensions, and packages it.
  Both modes produce a ZIP with the required internal path format
  (temp-{name}/{name}.obj), scan DefaultFurnitureCatalog.json for the next free
  #N index to avoid collisions, append all 14 catalog properties (model,
  catalogId, name, icon, category, width, depth, height, elevation, movable,
  doorOrWindow, tags, creator, modelSize), and optionally patch
  unity-export-utils.js getDeviceType() and getParticleSettings(). Use this
  skill whenever the user invokes /new-ha-device, says "add a new HA device",
  "create a smart device", "register a new IoT device", "new
  sensor/switch/light for SweetHome3D", "replace device model", "use this
  Meshy model", "package this OBJ", or asks to add/update a device in the
  catalog -- even if they don't mention the catalog or files explicitly.
---

# /new-ha-device

You are automating the creation or replacement of an HA smart device for
SweetHome3D. This touches three files consistently: a model ZIP, a PNG icon,
and the JSON catalog. The script handles all fiddly details (index scanning,
ZIP structure, OBJ generation, decimation, scaling, pure-Python PNG) — you
just need to collect parameters and run it.

---

## Choose a mode first

**Cube mode** (default): generates a solid-color box. Use when no real model
is available yet. Requires `--color`.

**External OBJ mode**: takes a Meshy.ai export folder (or any OBJ+MTL+PNG
folder), decimates the mesh with `trimesh`, rescales to target dimensions, and
packages it. Use when the user provides or mentions a downloaded/generated 3D
model. Does NOT require `--color` (color is sampled from the PNG texture).

Required install for external mode:
```bash
pip install trimesh fast-simplification
```

---

## Replacing an existing device model

To swap an existing cube device with a real model (e.g., upgrading
`ha-sensor-temp-humidity` to use a Meshy export):

**Step 1 — Delete the old ZIP:**
```bash
rm sweethome3d/www/lib/resources/models/ha-{name}.zip
```

**Step 2 — Remove old catalog entries** (all 14 keys for that index):
```python
python -c "
import json, re
path = 'sweethome3d/www/lib/resources/DefaultFurnitureCatalog.json'
with open(path, 'r', encoding='utf-8') as f:
    cat = json.load(f)
# Find the index N for this catalogId
target = 'ha_sensor_temp_humidity'   # ← change to your catalogId
n = next((re.search(r'#(\d+)$', k).group(1) for k, v in cat.items()
          if k.startswith('catalogId#') and v == target), None)
if n:
    removed = [k for k in list(cat) if k.endswith(f'#{n}')]
    for k in removed: del cat[k]
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(cat, f, indent=2, ensure_ascii=False); f.write('\n')
    print(f'Removed #{n}: {removed}')
else:
    print('catalogId not found')
"
```

**Step 3 — Re-run the script** with `--external-obj` (or `--color` for a new
cube). The script will assign the next free index — the index number changes
but that's fine, SweetHome3D matches devices by `catalogId`, not index.

---

## Step 1 — Collect parameters

If the user already provided parameters, extract them. Otherwise ask for
missing ones.

### Cube mode (required):
- `name` — kebab-case slug (e.g. `co2-sensor`). Script auto-adds `ha-` prefix.
- `display-name` — human-readable label (e.g. `"CO2 Sensor"`)
- `catalog-id` — unique ID (e.g. `ha_co2_sensor`). Script auto-adds `ha_` prefix.
- `category` — exactly one of:
  - `Smart Sensors`
  - `Smart Lights`
  - `Smart Switches`
  - `Smart Thermostats`
  - `Smart Cameras`
- `color` — RGB 0-255, comma-separated (e.g. `80,200,120`)
- `width`, `depth`, `height` — dimensions in centimeters
- `elevation` — distance from floor to bottom of device in centimeters

### External OBJ mode (all of above except `--color` is optional):
- `external-obj` — path to folder containing `*.obj` [+ `*.mtl` + `*.png`]
- `target-faces` — mesh face target after decimation (default: `2000`;
  actual result may be higher depending on mesh topology)
- `color` — optional RGB override for the icon (otherwise sampled from PNG)

### Both modes — optional unity-export-utils.js patching:
- `device-type` — adds a case to `getDeviceType()` (e.g. `co2_sensor`)
- `particle-color` — RGBA 0-1 for particle effects (e.g. `0.4,0.9,0.4,0.5`).
  Only used if `device-type` is also given.
- `tags` — extra catalog tags beyond the auto-included `HA, IoT, Smart Home`

### Project root:
The script expects the `SweetHome3DJS-7.5.2` directory as `--project-root`.
When running from inside `ha-sweethome3d/`, pass `--project-root ".."`.

---

## Step 2 — Run the script

Run from inside the `ha-sweethome3d/` directory.

**Cube mode:**
```bash
python ".claude/skills/new-ha-device/scripts/create_ha_device.py" \
  --name "NAME" \
  --display-name "DISPLAY_NAME" \
  --catalog-id "CATALOG_ID" \
  --category "CATEGORY" \
  --color "R,G,B" \
  --width WIDTH \
  --depth DEPTH \
  --height HEIGHT \
  --elevation ELEVATION \
  --project-root ".." \
  [--device-type "DEVICE_TYPE"] \
  [--particle-color "R,G,B,A"] \
  [--tags "TAG1, TAG2"]
```

**External OBJ mode (Meshy.ai / downloaded model):**
```bash
python ".claude/skills/new-ha-device/scripts/create_ha_device.py" \
  --name "NAME" \
  --display-name "DISPLAY_NAME" \
  --catalog-id "CATALOG_ID" \
  --category "CATEGORY" \
  --width WIDTH \
  --depth DEPTH \
  --height HEIGHT \
  --elevation ELEVATION \
  --project-root ".." \
  --external-obj "PATH/TO/MESHY_EXPORT_FOLDER/" \
  [--target-faces 2000] \
  [--color "R,G,B"] \
  [--device-type "DEVICE_TYPE"] \
  [--tags "TAG1, TAG2"]
```

The script prints a progress log and a summary at the end. If it exits with a
non-zero code, read the error message and fix the cause before retrying.

---

## Step 3 — Report back

After the script succeeds, tell the user:
- Which mode was used (cube / external OBJ)
- Which files were created/modified
- The catalog index assigned (e.g. `#113`)
- The exact `catalogId` used
- Final dimensions after scaling (external mode prints this)
- Whether unity-export-utils.js was patched

---

## Common mistakes to avoid

- **Index collision**: The script scans the catalog automatically — never
  hardcode an index manually.
- **ZIP path**: Internal structure MUST be `temp-{name}/{name}.obj`. The
  script enforces this.
- **Category typo**: The category string must match exactly (capitalization
  matters). The script validates this.
- **ha_ / ha- prefix**: The script auto-adds these; `co2-sensor` and
  `ha-co2-sensor` both work for `--name`.
- **--color required in cube mode**: If `--external-obj` is not given, `--color`
  is required. The script will error clearly if missing.
- **Dependencies for external mode**: `trimesh` and `fast-simplification` must
  be installed (`pip install trimesh fast-simplification`). The script gives a
  clear error if they are missing.
- **Decimation ceiling**: `fast-simplification` may not reach the exact
  `--target-faces` count for dense meshes — it stops when topology prevents
  further reduction. The result is still correct; adjust `--target-faces` if
  the ZIP is too large.
- **Texture lost in external mode**: UV coordinates are stripped during
  decimation, so the texture PNG is not included in the ZIP. The model uses a
  flat `Kd` color sampled from the PNG center. This is intentional — the shape
  improvement over a cube is the primary goal.
- **Dimension mismatch**: For external OBJ mode, set `--height` to match the
  model's dominant axis. A standing thermometer needs a tall height (e.g.
  `--height 8`), not a flat puck height (`--height 2`). The model is scaled to
  fit within the given box while preserving aspect ratio.
- **Existing device replacement**: The script refuses to overwrite an existing
  ZIP. Delete the old ZIP and remove the old catalog entries first (see
  "Replacing an existing device model" above).

---

## Reference: catalog entry format

Each HA device occupies 14 keys in the flat JSON:

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
"modelSize#N":    "<zip file size in bytes>"
```

Note: `modelSize#N` must match the actual ZIP byte count. The script measures
it automatically. If you manually edit a ZIP, update `modelSize#N` to match
`os.path.getsize(zip_path)`.

---

## Reference: valid HA categories and their typical dimensions

| Category          | Typical devices              | Typical size (WxDxH cm) | Typical elevation |
|-------------------|------------------------------|-------------------------|-------------------|
| Smart Sensors     | temperature, humidity, CO2   | 5x5x5 to 6x6x8          | 100-220 cm        |
| Smart Lights      | bulbs, strips, ceiling       | 3-30 cm wide            | 0-260 cm          |
| Smart Switches    | wall switches, plugs         | 5-8 cm wide, 1-8 cm h   | 50-130 cm         |
| Smart Thermostats | thermostats, HVAC controls   | 8-12 cm                 | 120-150 cm        |
| Smart Cameras     | security cameras             | 4-10 cm                 | 200-260 cm        |

---

## Reference: current HA device catalog

| Current Index | Catalog ID | Name | Model type |
|---------------|-----------|------|------------|
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
