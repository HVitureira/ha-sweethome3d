---
name: new-ha-device
description: >
  Automates adding a brand-new HA smart device to the SweetHome3D project from
  scratch: generates OBJ+MTL cube geometry, a 64x64 PNG icon, packages them into
  a ZIP with the required internal path format (temp-{name}/{name}.obj), scans
  DefaultFurnitureCatalog.json for the next free #N index to avoid collisions,
  appends all 14 catalog properties (model, catalogId, name, icon, category,
  width, depth, height, elevation, movable, doorOrWindow, tags, creator,
  modelSize), and optionally patches unity-export-utils.js getDeviceType() and
  getParticleSettings(). Use this skill whenever the user invokes /new-ha-device,
  says "add a new HA device", "create a smart device", "register a new IoT
  device", "new sensor/switch/light for SweetHome3D", or asks to add a device to
  the catalog -- even if they don't mention the catalog or files explicitly.
---

# /new-ha-device

You are automating the creation of a new HA smart device for SweetHome3D. This
touches three files consistently: a model ZIP, a PNG icon, and the JSON catalog.
The script handles all the fiddly details (index scanning, ZIP structure, OBJ
winding order, pure-Python PNG) so you just need to collect parameters and run it.

## Step 1 - Collect parameters

If the user already provided parameters in their message, extract them. Otherwise
ask for any that are missing. You need:

**Required:**
- `name` - kebab-case slug (e.g. `co2-sensor`). The script auto-adds `ha-` prefix.
- `display-name` - human-readable label (e.g. `"CO2 Sensor"`)
- `catalog-id` - unique ID (e.g. `ha_co2_sensor`). The script auto-adds `ha_` prefix.
- `category` - must be exactly one of:
  - `Smart Sensors`
  - `Smart Lights`
  - `Smart Switches`
  - `Smart Thermostats`
  - `Smart Cameras`
- `color` - RGB 0-255, comma-separated (e.g. `80,200,120`)
- `width`, `depth`, `height` - dimensions in centimeters
- `elevation` - distance from floor to bottom of device in centimeters

**Optional (for unity-export-utils.js):**
- `device-type` - if provided, adds a case to `getDeviceType()` (e.g. `co2_sensor`)
- `particle-color` - RGBA 0-1 for particle effects (e.g. `0.4,0.9,0.4,0.5`).
  Only used if `device-type` is also given.
- `tags` - extra catalog tags beyond the auto-included `HA, IoT, Smart Home`

**Project root:**
This skill is at `ha-sweethome3d/.claude/skills/new-ha-device/`. The script
expects the `SweetHome3DJS-7.5.2` directory (one level above `ha-sweethome3d/`)
as `--project-root`. Pass `--project-root ".."` when running from inside
`ha-sweethome3d/`.

## Step 2 - Run the script

Run from inside the `ha-sweethome3d/` directory:

```
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

The script prints a progress log and a summary at the end. If it exits with a
non-zero code, read the error message and fix the cause before retrying.

## Step 3 - Report back

After the script succeeds, tell the user:
- Which files were created/modified
- The catalog index assigned (e.g. `#113`)
- The exact `catalogId` used (important for HA integrations)
- Whether unity-export-utils.js was patched

## Common mistakes to avoid

- **Index collision**: The script scans the catalog automatically -- never hardcode
  an index manually.
- **ZIP path**: The internal structure MUST be `temp-{name}/{name}.obj`, not just
  `{name}.obj` at the root. The script enforces this.
- **Category typo**: The category string must match exactly (capitalization matters).
  The script validates this.
- **ha_ / ha- prefix**: The script auto-adds these, so `co2-sensor` and
  `ha-co2-sensor` both work for `--name`.

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

## Reference: valid HA categories and their typical dimensions

| Category          | Typical devices              | Typical size (WxDxH cm) | Typical elevation |
|-------------------|------------------------------|-------------------------|-------------------|
| Smart Sensors     | temperature, humidity, CO2   | 5x5x5 to 6x6x8          | 100-220 cm        |
| Smart Lights      | bulbs, strips, ceiling       | 3-30 cm wide            | 0-260 cm          |
| Smart Switches    | wall switches, plugs         | 5-8 cm wide, 1-8 cm h   | 50-130 cm         |
| Smart Thermostats | thermostats, HVAC controls   | 8-12 cm                 | 120-150 cm        |
| Smart Cameras     | security cameras             | 4-10 cm                 | 200-260 cm        |
