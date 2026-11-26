# HA Device Catalog Reference

## Required 14 Catalog Keys (`DefaultFurnitureCatalog.json`)

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
"modelSize#N":    "<zip byte count>"
```

- `catalogId` must start with `ha_`, `creator` must be `"HA"`, `category` must contain `"Smart"`, and `modelSize#N` must equal the exact ZIP byte count (`os.path.getsize`).
- ZIP internal structure must be `temp-{name}/{name}.obj` + `.mtl`.
- During `trimesh` decimation, UV coordinates are stripped intentionally; the script samples a flat `Kd` color from the PNG texture.

## Valid Categories & Typical Dimensions

| Category | Typical Devices | Size (W×D×H cm) | Elevation (cm) |
| :--- | :--- | :--- | :--- |
| `Smart Sensors` | temperature, humidity, CO2 | 5×5×5 to 6×6×8 | 100–220 |
| `Smart Lights` | bulbs, strips, ceiling | 3–30 wide | 0–260 |
| `Smart Switches` | wall switches, plugs | 5–8 wide, 1–8 high | 50–130 |
| `Smart Thermostats` | thermostats, HVAC controls | 8–12 | 120–150 |
| `Smart Cameras` | security cameras | 4–10 | 200–260 |

## Meshy.ai Suggested Prompts

| Device | Prompt |
| :--- | :--- |
| Temp/humidity sensor | `"Sonoff SNZB-02 temperature and humidity sensor, small white square IoT device, realistic"` |
| Motion sensor | `"PIR motion detector sensor, white dome shape, ceiling mount, realistic"` |
| Smart bulb | `"Philips Hue smart LED bulb, white, realistic"` |
| Wall switch | `"white wall light switch with single rocker button, realistic"` |
| Smart plug | `"smart home wall plug adapter with LED indicator, white, realistic"` |
| Ceiling light | `"round flat ceiling light fixture, white, modern, realistic"` |

## Current HA Device Catalog

| Index | Catalog ID | Name | Model |
| :--- | :--- | :--- | :--- |
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

## Removing Old Catalog Entries Before Replacement

```python
import json, re
path = "sweethome3d/www/lib/resources/DefaultFurnitureCatalog.json"
cat = json.load(open(path, encoding="utf-8"))
target = "ha_sensor_temp_humidity"
n = next((re.search(r"#(\d+)$", k).group(1) for k, v in cat.items()
          if k.startswith("catalogId#") and v == target), None)
if n:
    for k in [k for k in list(cat) if k.endswith(f"#{n}")]:
        del cat[k]
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(cat, f, indent=2, ensure_ascii=False); f.write("\n")
```
