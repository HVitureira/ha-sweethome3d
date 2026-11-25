# Export Pipeline & Cross-Repo Contract (`ha-sweethome3d` → `smart-home-visualizer`)

## Export Flow (`Ctrl+E` / Export for Unity)

```
ExportButtons.vue / exportForUnity()
  └── UnityExportUtilities.exportForUnity(home, component3D, baseName)
        ├── 1. OBJExporter.exportToOBJ()       → {homeId}_geometry.zip (OBJ + MTL + textures)
        ├── 2. extractDeviceMetadata(home)     → {homeId}_devices.json (devices, rooms, walls)
        └── 3. generateUnityImportScript()     → {homeId}_Import.cs (optional Unity helper)
```

## Key Custom JS Files (`sweethome3d/www/lib/`)

| File | Responsibility |
| :--- | :--- |
| `objExporter.js` | Traverses walls, rooms, furniture; loads furniture ZIPs asynchronously (`exportModelFromURL`); builds merged OBJ/MTL/textures ZIP (`OBJExporter`). |
| `unity-export-utils.js` | Extracts IoT devices (`isIoTDevice`, `getDeviceType`, `extractDeviceMetadata`, `getParticleSettings`) and builds `{homeId}_devices.json`. |
| `obj-exporter-integration.js` | UI hooks and keyboard shortcuts (`Ctrl+E` Unity export, `Ctrl+Shift+E` OBJ-only). |
| `objDefaults.js` | 100+ default MTL material definitions (prevents missing/pink textures such as `flyellow`). |

## Coordinate System Contract

- **SweetHome3D internal**: centimeters; 2D plan Y = depth, Z = elevation.
- **Exported `{homeId}_devices.json`**: meters (`cm / 100`), SH3D Y → Unity Z.
- **Exported OBJ geometry**: centimeters (Unity scales root mesh by `modelScaleFactor = 0.01`).

## `{homeId}_devices.json` Schema

```json
{
  "version": "1.0",
  "exportDate": "2026-02-17T22:00:00Z",
  "sourceName": "my-home",
  "devices": [
    {
      "id": "device_0",
      "name": "Living Room Sensor",
      "type": "temperature_sensor",
      "isIoTDevice": true,
      "position": { "x": 5.0, "y": 1.5, "z": 3.0 },
      "rotation": { "x": 0, "y": 0, "z": 0, "w": 1 },
      "haEntityId": "sensor.living_room_temperature",
      "displaySuffix": "°C"
    }
  ],
  "rooms": [{ "name": "Living Room", "points": [], "ceilingHeight": 2.5 }],
  "walls": [{ "xStart": 0, "yStart": 0, "xEnd": 10, "yEnd": 0, "height": 2.5, "thickness": 0.1 }]
}
```

> Note: Legacy `effectRadius`, `propagationType`, and `affectedArea` fields were intentionally removed from the export payload.

## Smart Device Detection

A piece is recognized as a Home Assistant smart device if:
1. `catalogId` starts with `ha_` (e.g., `ha_sensor_temperature`, `ha_light_bulb`, `ha_switch_pressure`)
2. OR `properties.catalogId` starts with `ha_`
3. OR `creator` is `"HA"`
4. OR category contains `"Smart"`

Switches additionally expose `controlsEntityId` (target `light.*` entity) and `switchType` (`"pressure"` | `"regular"`).

## Cross-Repo Sync Checklist

When changing JSON fields or device types here, also update sibling `../smart-home-visualizer/`:
- `Assets/Scripts/Core/DataModels/SmartHomeExportData.cs` (`DeviceCategory`, `DeviceExport`)
- `Assets/Scripts/Core/Setup/SceneAutoSetup.cs` (`InstantiateDevice`, prefabs)
- Relevant consumer under `Assets/Scripts/Device/HomeAssistant/`

## Debugging Export in Browser DevTools

- Run `exportForUnity()` directly in DevTools console; inspect `📬`, `✅`, `❌` log lines.
- Globals available: `window.OBJExporter`, `window.UnityExportUtilities`, `window.isSmartDeviceFurniture(piece)`.
