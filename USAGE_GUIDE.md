# SweetHome3D HA Add-on - Usage Guide

This guide walks you through setting up and using the new version of the SweetHome3D Home Assistant add-on, which now includes a **3D Visualizer** (Unity WebGL) and a **Settings** panel alongside the floor plan editor.

---

## What's New

The add-on now has three tabs:

| Tab | What it does |
|-----|-------------|
| **Floor Plan** | The SweetHome3D editor you already know — design walls, rooms, place furniture and smart devices |
| **3D Visualizer** | A real-time Unity WebGL view of your home with live Home Assistant data (temperatures, lights, sensors) |
| **Settings** | Configure your Home Assistant connection, tracked entities, and visualization parameters |

---

## Prerequisites

### 1. Home Assistant Long-Lived Access Token

The 3D Visualizer connects to your Home Assistant instance to read sensor data in real time. It authenticates using a **long-lived access token**.

**To create one:**

1. Open your Home Assistant instance in a browser
2. Click your profile picture (bottom-left of the sidebar)
3. Scroll down to **Long-Lived Access Tokens**
4. Click **Create Token**
5. Give it a name (e.g., `SweetHome3D Visualizer`)
6. Copy the token immediately — it will only be shown once

### 2. Unity WebGL Build

The 3D Visualizer requires a pre-built Unity WebGL application. This is the output of the `smart-home-visualizer` Unity project.

**If you are a developer / building from source:**

Place the Unity WebGL build output into the `unity-build/` directory at the root of the `ha-sweethome3d` repository before building the Docker image:

```
ha-sweethome3d/
  unity-build/
    index.html
    Build/
    TemplateData/
    StreamingAssets/
```

**If you are installing the add-on from the HA Add-on Store:**

The Unity build is bundled into the Docker image automatically — no action needed.

### 3. Network Accessibility

Your Home Assistant instance must be reachable from the browser where you open the add-on. If you access HA remotely (e.g., via DuckDNS, Nabu Casa), use that external address in the settings.

---

## Step-by-Step Setup

### Step 1 — Install and Start the Add-on

1. In Home Assistant, go to **Settings** > **Add-ons** > **Add-on Store**
2. Add the repository URL: `https://github.com/HVitureira/ha-sweethome3d`
3. Find **SweetHome3D** and click **Install**
4. Start the add-on
5. Click **Open Web UI** or find it in the sidebar

### Step 2 — Configure Settings

When the add-on opens, you will see a tab bar at the top. Click **Settings**.

Fill in the following:

#### Connection

| Field | What to enter |
|-------|--------------|
| **HA Server Address** | Your Home Assistant address without the protocol. Examples: `homeassistant.local:8123`, `my-ha.duckdns.org`, `192.168.1.100:8123` |
| **Long-Lived Access Token** | Paste the token you created in the prerequisites |
| **Use SSL** | Check this if your HA instance uses HTTPS (recommended for remote access) |

#### Tracked Entities

Enter the entity IDs you want to monitor in the 3D Visualizer, **one per line**:

```
sensor.living_room_temperature
sensor.bedroom_humidity
light.kitchen_ceiling
switch.hallway_light
binary_sensor.front_door
```

These are the Home Assistant entities that will appear as live data points in the 3D view. You can find entity IDs in Home Assistant under **Settings** > **Devices & Services** > **Entities**.

#### Visualization (optional, defaults are fine)

| Field | Default | Description |
|-------|---------|-------------|
| Min Temperature | 18 | Lower bound of the temperature color scale (blue) |
| Max Temperature | 35 | Upper bound of the temperature color scale (red) |
| Interpolation Power | 3.95 | How sharply temperature gradients transition between sensors |
| Update Interval | 0.5s | How often the visualizer polls for new data |
| Max Particles | 5000 | Maximum number of particles in the visualization effects |
| Optimize for WebGL | On | Reduces visual fidelity for better performance in browsers |

#### Connection Tuning (optional, defaults are fine)

| Field | Default | Description |
|-------|---------|-------------|
| Reconnect Delay | 5s | Wait time before retrying a failed connection |
| Max Reconnect Attempts | 10 | How many times to retry before giving up |
| Connection Timeout | 30s | How long to wait for the initial connection |

Click **Save Settings** when done.

### Step 3 — Design Your Floor Plan

Click the **Floor Plan** tab to return to the SweetHome3D editor.

1. **Draw walls** using the wall tool
2. **Create rooms** by clicking inside enclosed wall areas
3. **Place smart devices** from the furniture catalog (look for the "Smart Sensors" and "Smart Lights" categories)
4. **Assign entity IDs**: Double-click a smart device to open its properties dialog. The **HA Entity ID** field appears for devices with catalog IDs starting with `ha_`. Enter the matching Home Assistant entity ID (e.g., `sensor.living_room_temperature`)
5. **Set effect radius** (optional): Controls the size of the particle effect in the 3D visualizer. Adjust per device based on room size
6. **Save your home** (Ctrl+S)

### Step 4 — Export for the Visualizer

While on the Floor Plan tab:

1. Click the **Export for Unity** button (bottom-right) or press **Ctrl+E**
2. This exports:
   - `{home}_geometry.zip` — 3D mesh of your home (walls, floors, furniture)
   - `{home}_devices.json` — IoT device positions, entity IDs, rooms, walls
   - `{home}_Import.cs` — Unity editor import script (only needed for Unity Editor development)

The exported data is saved on the server and becomes available to the 3D Visualizer.

### Step 5 — View in 3D Visualizer

Click the **3D Visualizer** tab.

The Unity WebGL application loads in a full-screen iframe. On first load, it:

1. Reads your settings from the Settings tab (HA address, token, tracked entities)
2. Connects to your Home Assistant instance via WebSocket
3. Loads the exported 3D model and device positions
4. Begins displaying real-time sensor data as particle effects

**What you should see:**
- Your home's 3D model (walls, rooms, furniture)
- Temperature sensors showing colored particles (blue = cold, red = hot)
- Lights responding to their on/off state in HA
- Motion sensors showing activity

---

## Changing Settings After Initial Setup

1. Go to the **Settings** tab
2. Make your changes
3. Click **Save Settings**
4. Switch back to the **3D Visualizer** tab

The visualizer will receive the updated settings automatically (via `postMessage`) without needing to reload. However, some changes (like the HA server address) may require the visualizer to reconnect — this happens automatically.

If you want to start fresh with default values, click **Reset to Defaults** on the Settings page.

---

## Keyboard Shortcuts

| Shortcut | Action | Tab |
|----------|--------|-----|
| Ctrl+E | Export for Unity (geometry + devices + C# script) | Floor Plan |
| Ctrl+Shift+E | Export to OBJ only (geometry) | Floor Plan |
| Ctrl+S | Save current home | Floor Plan |

---

## Troubleshooting

### 3D Visualizer shows a blank/white screen

- **Unity build not present**: Ensure the `unity-build/` directory contains the WebGL output files. The Visualizer tab loads `/unity-visualizer/index.html` — if that file doesn't exist, the iframe will be empty.
- **Browser compatibility**: Unity WebGL requires a modern browser with WebAssembly support. Chrome, Edge, and Firefox all work. Safari has limited WebGL2 support.

### Visualizer loads but shows no sensor data

- **Check the HA address**: Go to Settings and verify the address is reachable from your browser. Try opening `https://<your-address>/api/` in a new tab — you should see `{"message": "API running."}`.
- **Check the token**: Ensure the long-lived access token is correct and hasn't been revoked. Create a new one if unsure.
- **Check tracked entities**: Verify the entity IDs in Settings match real entities in your HA instance. Typos in entity IDs will silently fail.
- **Check SSL setting**: If your HA uses HTTPS, the SSL checkbox must be checked. If it uses plain HTTP (e.g., `http://192.168.1.100:8123`), uncheck it.

### Visualizer loads but the 3D model is missing

- **Export first**: You must export from the Floor Plan tab (Ctrl+E) before the visualizer has anything to display.
- **Re-export after changes**: If you've moved walls or devices, export again to update the 3D model.

### Floor Plan editor doesn't fit the screen / has wrong height

- Do not remove or modify the `#home-pane { position: absolute; top: 40px; ... }` CSS rule in `index.html`. This offsets the editor below the 40px tab bar. Removing it will cause the SweetHome3D canvas to render behind the tabs.

### Settings are lost after clearing browser data

Settings are stored in `localStorage` under the key `ha-smart-home-settings`. Clearing browser data or using incognito mode will reset them. There is currently no server-side settings backup — consider noting down your HA token separately.

---

## For Developers

### Running locally (development mode)

```bash
cd ha-sweethome3d/www-vue/

# Ensure PHP backend is running (e.g., via docker-compose)
docker-compose up -d

# Start Vite dev server
npm run dev
```

The Vite dev server:
- Serves SweetHome3D files from `../sweethome3d/www/`
- Proxies PHP endpoints (`/readData.php`, etc.) to `localhost:8099`
- Serves Unity files from `../unity-build/` at `/unity-visualizer/`
- Supports hot module replacement for Vue components

### Building the Docker image

```bash
cd ha-sweethome3d/

# Ensure unity-build/ has the WebGL output
ls unity-build/index.html  # should exist

# Build
cd sweethome3d/
docker build -t ha-sweethome3d .
```

### Related documentation

| Document | Description |
|----------|-------------|
| `AGENTS.md` | Full technical context for LLM agents and developers |
| `INTEGRATION_PLAN.md` | Detailed architectural plan for the tab integration |
| `REPO_SETUP.md` | Repository setup, CI/CD recommendations, versioning strategy |

---

*Last updated: March 28, 2026*
