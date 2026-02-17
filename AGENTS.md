# SweetHome3D HA Add-on - LLM Agent Context Guide

This document provides comprehensive context for LLM agents working on this modified SweetHome3D JS web application, which runs as a Home Assistant add-on and exports 3D geometry + IoT device data for Unity.

---

## Project Overview

**ha-sweethome3d** is a customized fork of SweetHome3D JS (v7.5.2) packaged as a **Home Assistant add-on**. Users design their home floor plan in the browser, place IoT smart devices from a custom furniture catalog, assign Home Assistant entity IDs, and export everything for a Unity-based digital twin visualizer.

### Key Capabilities
- Full SweetHome3D JS floor plan editor (walls, rooms, furniture, 3D preview)
- Custom "Smart Devices" furniture catalog (sensors, switches with `ha_` prefix catalog IDs)
- HA Entity ID field in furniture dialog (visible only for smart devices)
- Effect radius slider per device (for particle system bounds in Unity)
- OBJ + MTL + textures export to ZIP for Unity 3D model loading
- Device metadata JSON export (positions, entity IDs, rooms, walls)
- Auto-generated Unity C# import script
- Runs as Docker container (nginx + PHP-FPM, port 8099)
- Integrates with Home Assistant as an Ingress add-on

### Target Deployment
- **Primary**: Home Assistant add-on (Docker, all architectures: amd64, aarch64, armv7, armhf, i386)
- **Secondary**: Local development via `docker-compose up`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│               Home Assistant Add-on Container                    │
│  Docker: Alpine + nginx + PHP-FPM (port 8099)                   │
├─────────────────────────────────────────────────────────────────┤
│  nginx → serves static files from /var/www/html/                │
│  PHP-FPM → handles data save/load to /var/www/html/data/        │
├─────────────────────────────────────────────────────────────────┤
│  index.html (2784 lines)                                         │
│  ├── SweetHome3D core JS (sweethome3d.min.js + dependencies)    │
│  ├── Custom Export Scripts (4 JS files)                          │
│  ├── HA Integration Script (inline ~1000 lines)                 │
│  └── Custom HTML: HA entity field, effect radius slider          │
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
│   │       ├── nginx/              # nginx config
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
├── docker-compose.yml              # Local dev compose file
├── README.md                       # Repository readme
├── AGENTS.md                       # This file
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
| `model-create.sh` | ~8K | Script to generate IoT device 3D models for the furniture catalog |

### Core SweetHome3D Files (DO NOT MODIFY)
| File | Purpose |
|------|---------|
| `www/lib/sweethome3d.min.js` | Core SweetHome3D application (2.5MB minified) |
| `www/lib/gl-matrix-min.js` | WebGL matrix math library |
| `www/lib/jszip.min.js` | ZIP file handling |
| `www/lib/graphics2d.min.js` | 2D rendering |
| `www/lib/geom.min.js` | Geometry processing |

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

Adding a new device requires **3 artifacts** (model ZIP, icon, catalog entry) plus optional export updates.

#### Step 1: Create the 3D Model

Each device model is a **ZIP** containing an OBJ file + MTL file. The simplest approach is a colored cube:

**Option A: Use `model-create.sh`** (recommended for batch creation)
```bash
# Run from ha-sweethome3d/ directory
cd sweethome3d
bash model-create.sh
# Creates 9 device models + icons in www/lib/resources/models/
```

The script's `create_model` function accepts: `name width height depth r g b material_name`

**Option B: Create manually**

1. Create a directory `temp-{name}/` with two files:

```
# {name}.obj
mtllib {name}.mtl
o {MaterialName}
v -2.5 0.0 -2.5
v 2.5 0.0 -2.5
v 2.5 0.0 2.5
v -2.5 0.0 2.5
v -2.5 5.0 -2.5
v 2.5 5.0 -2.5
v 2.5 5.0 2.5
v -2.5 5.0 2.5
usemtl {MaterialName}
f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
f 1 4 3 2
f 5 6 7 8
```

```
# {name}.mtl
newmtl {MaterialName}
Ka 0.3 0.69 0.31
Kd 0.3 0.69 0.31
Ks 0.5 0.5 0.5
Ns 32
d 1.0
illum 2
```

2. ZIP the directory: `zip -r {name}.zip temp-{name}/`
3. Place in `www/lib/resources/models/{name}.zip`

**Option C: Use a real 3D model**

You can use any OBJ model. Just ensure:
- OBJ + MTL files are inside a ZIP
- Dimensions are in centimeters
- The model path in the catalog matches the structure inside the ZIP

#### Step 2: Create an Icon

Create a 64×64 PNG icon for the furniture catalog:

```bash
# Using ImageMagick
magick -size 64x64 xc:"#4CAF50" -gravity center -pointsize 24 \
  -fill white -font Arial-Bold -annotate +0+0 "E" ha-my-device.png
```

Place in `www/lib/resources/models/ha-my-device.png`

#### Step 3: Register in the Furniture Catalog

Edit `www/lib/resources/DefaultFurnitureCatalog.json`. The catalog uses a **flat key-value format** with **numbered indices**. Each piece of furniture has properties suffixed with `#N` where N is its unique index.

Current smart devices use indices **#101 through #109**. To add a new device, use the next available index (e.g., `#110`):

```json
{
  "model#110": "lib/resources/models/ha-my-device.zip!/temp-ha-my-device/ha-my-device.obj",
  "catalogId#110": "ha_energy_meter",
  "name#110": "Energy Meter",
  "icon#110": "lib/resources/models/ha-my-device.png",
  "category#110": "Smart Sensors",
  "width#110": "5",
  "depth#110": "5",
  "height#110": "5",
  "elevation#110": "100",
  "movable#110": "true",
  "doorOrWindow#110": "false",
  "tags#110": "HA, IoT, Sensor, Energy, Power, Smart Home",
  "creator#110": "HA",
  "modelSize#110": "1400"
}
```

> [!IMPORTANT]
> - **`catalogId`** MUST start with `ha_` for the device to be detected as a smart device
> - **`creator`** should be `"HA"` for consistent detection
> - **`category`** should contain "Smart" (e.g., `Smart Sensors`, `Smart Lights`, `Smart Switches`)
> - **`model`** path follows pattern: `lib/resources/models/{zip-name}.zip!/temp-{zip-name}/{obj-name}.obj`
> - **`elevation`** is the default wall height in cm where the device appears (150 = wall-mounted sensor level)

#### Existing Smart Device Catalog Entries

| Index | Catalog ID | Name | Category |
|-------|-----------|------|----------|
| #101 | `ha_sensor_temperature` | Temperature Sensor | Smart Sensors |
| #102 | `ha_sensor_humidity` | Humidity Sensor | Smart Sensors |
| #103 | `ha_sensor_temp_humidity` | Temperature & Humidity Sensor | Smart Sensors |
| #104 | `ha_sensor_motion` | Motion Sensor | Smart Sensors |
| #105 | `ha_sensor_light` | Light Sensor | Smart Sensors |
| #106 | `ha_sensor_motion_light` | Motion & Light Sensor | Smart Sensors |
| #107 | `ha_light_bulb` | Smart Light Bulb | Smart Lights |
| #108 | `ha_light_dimmer` | Smart Dimmer | Smart Lights |
| #109 | `ha_switch_plug` | Smart Plug | Smart Switches |

#### Step 4: Update Export Logic (if needed)

- `UnityExportUtilities.isIoTDevice()` — add detection if your catalog ID doesn't follow `ha_` convention
- `UnityExportUtilities.getDeviceType()` — classify the new device type for Unity
- `UnityExportUtilities.getParticleSettings()` — configure particle visualization if applicable

#### Step 5: Unity Side

- Add consumer class extending `EntityMessageConsumerBase`
- Add prefab to the project
- Update `SceneAutoSetup.GetDevicePrefab()` to return the prefab for the new type

---

### Adding Custom Inputs to the Furniture Edit Form

The furniture edit dialog is defined as an **HTML template** in `index.html` (id: `home-furniture-dialog-template`, starting at line ~517). Custom HA fields are injected into this template and wired up via inline JS functions.

#### Architecture

```
index.html
  ├── HTML Template (div#home-furniture-dialog-template)
  │     Contains form fields with data-name attributes
  │     Custom fields hidden by default (style="display:none")
  │
  └── Inline <script> (HA Integration IIFE, ~1000 lines)
        ├── setupHAEntityField() — shows/hides fields, reads/writes values
        ├── getHAEntityId(furniture) — reads property from furniture object
        ├── setHAEntityId(controller, value) — writes property to furniture
        ├── isSmartDeviceFurniture(furniture) — determines visibility
        └── initHAEntityField() — polls every 500ms for dialog open
```

#### Step 1: Add HTML to the Dialog Template

Find the `home-furniture-dialog-template` div (line ~517) and add your field inside the `name-and-price-panel` grid. Use `data-name` attributes for JS access and start hidden:

```html
<!-- Inside div[data-name="name-and-price-panel"] in index.html -->

<!-- YOUR NEW FIELD -->
<div class="label-cell ha-only" data-name="my-field-label" style="display:none;">
  <div>🔌 My Custom Field:</div>
</div>
<div class="ha-only" data-name="my-field-container" style="display:none;">
  <input name="my-field-input" size="50" type="text"
    placeholder="Enter value here" />
  <div style="font-size: 0.85em; color: #666; margin-top: 0.3em;">
    Description of what this field does
  </div>
</div>
```

For a slider/range input (like the existing effect radius):
```html
<div data-name="my-slider-container" style="display:none; margin-top: 15px;">
  <div style="color: #666; font-size: 12px; margin-bottom: 5px; font-weight: 500;">
    📊 My Slider Label
  </div>
  <div style="display: flex; align-items: center; gap: 10px;">
    <input data-name="my-slider" type="range"
      min="0" max="100" step="1" value="50"
      style="flex: 1; cursor: pointer; height: 6px;" />
    <span data-name="my-slider-value"
      style="min-width: 50px; text-align: right; font-family: monospace; font-weight: bold;">
      50
    </span>
  </div>
</div>
```

#### Step 2: Wire Up Visibility and Persistence in JS

In the inline `<script>` section (inside the HA Integration IIFE), modify `setupHAEntityField()` to show/hide your field and read/write values. The pattern is:

```javascript
function setupHAEntityField() {
  // ... existing code to find elements ...
  
  // Find YOUR new elements
  const myFieldInput = document.querySelector('input[name="my-field-input"]');
  const myFieldLabel = document.querySelector('[data-name="my-field-label"]');
  const myFieldContainer = document.querySelector('[data-name="my-field-container"]');
  
  if (!myFieldInput) return;
  
  // Get the furniture controller (selected furniture piece)
  const controller = getFurnitureController();
  if (!controller || !isSmartDeviceFurniture(controller)) {
    // Hide for non-smart devices
    myFieldLabel.style.display = 'none';
    myFieldContainer.style.display = 'none';
    return;
  }
  
  // Show field
  myFieldLabel.style.display = '';
  myFieldContainer.style.display = '';
  
  // Read current value from furniture properties
  const currentValue = controller.getProperty('myPropertyName');
  myFieldInput.value = currentValue || '';
  
  // Save on change
  myFieldInput.addEventListener('change', function() {
    setCustomProperty(controller, 'myPropertyName', myFieldInput.value.trim());
  });
}
```

#### Step 3: Property Persistence (How Values Are Saved)

SweetHome3D furniture pieces have a property system accessed via:

```javascript
// Read a property
const value = furniture.getProperty('myPropertyName');

// Write a property (simple approach)
furniture.setProperty('myPropertyName', newValue);

// Write via additionalProperties (used for dialog-based editing)
let props = controller.getAdditionalProperties();
if (!props) props = { entries: [] };
props.entries.push({
  key: 'myPropertyName',
  value: newValue,
  getKey: function() { return this.key; },
  getValue: function() { return this.value; }
});
controller.setAdditionalProperties(props);
```

#### Step 4: Read Custom Properties During Export

In `unity-export-utils.js`, update `extractDeviceMetadata()` to include your new property in the exported JSON:

```javascript
// Inside extractDeviceMetadata() where device data is built:
const myValue = piece.getProperty('myPropertyName');
if (myValue) {
  deviceData.myPropertyName = myValue;
}
```

#### Existing Custom Fields Reference

| Field | HTML data-name | Property Key | Location |
|-------|---------------|-------------|----------|
| HA Entity ID | `ha-entity-label`, `ha-entity-input-container` | `haEntityId` | index.html line ~540 |
| Effect Radius | `ha-effect-radius-container` | (via slider data-name) | index.html line ~552 |

Key JS functions for reference:
- `setupHAEntityField()` — visibility + value binding (line ~2038)
- `getHAEntityId(furniture)` — reads `haEntityId` property (line ~2212)
- `setHAEntityId(controller, value)` — writes via `additionalProperties` (line ~2240)
- `isSmartDeviceFurniture(furniture)` — detection logic (line ~2126)
- `getFurnitureController()` — gets currently selected furniture (line ~2180)
- `initHAEntityField()` — polls for dialog open every 500ms (line ~2017)

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
| Effect radius renderer | Commented out in index.html (`effect-radius-renderer.js`), was not working |
| Coordinate units | SH3D internal = cm; JSON export = meters; OBJ geometry = cm |
| Material color parsing | Historical bug with `flyellow` appearing pink — fixed via `objDefaults.js` |

---

## Companion Project

This app works with the **Unity Smart Home Visualizer**:
- Path: `../smart-home-visualizer/`
- AGENTS.md: `../smart-home-visualizer/AGENTS.md`
- Import side: `SceneAutoSetup.cs` loads the exported ZIP + JSON

---

*Last updated: February 17, 2026*
