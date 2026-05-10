# HASweetHome3D — Home Assistant Add-on

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg

## About

**HASweetHome3D** is a Home Assistant–integrated fork of the JavaScript version of [SweetHome3D](http://www.sweethome3d.com/), the free interior design application for placing furniture on a 2D floor plan with a 3D preview.

On top of the upstream editor, this add-on adds a **smart-home device catalog** (sensors, switches, lights) whose pieces can be linked to Home Assistant entity IDs, and an **export pipeline** that produces an OBJ + JSON bundle consumable by a Unity-based digital-twin visualizer. The add-on runs ingress-only and embeds in the HA sidebar.

## Features

- Full SweetHome3D JS floor plan editor (walls, rooms, furniture, 3D preview)
- Smart-home device catalog (`ha_*` IoT pieces) with HA entity-ID binding per device
- OBJ + MTL geometry and device metadata JSON export for the Unity digital-twin visualizer
- Embedded ingress sidebar entry — no host port published
- Save and load your home designs
- PHP backend for file operations
- Supports all Home Assistant architectures (amd64, aarch64, armv7, armhf, i386)

## Installation

1. Add this repository to your Home Assistant add-on store
2. Install the **HASweetHome3D** add-on
3. Start the add-on
4. A **HASweetHome3D** entry appears in the Home Assistant sidebar — click it to open the editor inline inside Home Assistant (via Ingress). No host port or external URL is exposed.

> If the sidebar entry doesn't appear after starting, open the addon page and make sure the **Show in sidebar** toggle is on.

## Configuration

### Option: `php_max_execution_time`

Sets the maximum execution time for PHP scripts in seconds.

**Default:** `300`

### Option: `php_memory_limit`

Sets the memory limit for PHP scripts.

**Default:** `256M`

### Option: `php_upload_max_filesize`

Sets the maximum allowed size for uploaded files.

**Default:** `200M`

### Option: `php_post_max_size`

Sets the maximum size of POST data that PHP will accept.

**Default:** `200M`

### Option: `homeassistant_address`

Home Assistant host or `host:port` used for API/WebSocket connections.
Leave empty to allow automatic address detection.

**Default:** `""` (auto-detect)

### Option: `homeassistant_token`

Home Assistant long-lived access token used for API and WebSocket authentication.

**Default:** `""`

### Option: `use_ssl`

Use SSL connection for Home Assistant communication.

Enable this when your Home Assistant instance is configured with HTTPS and valid SSL certificates.
This controls WebSocket protocol selection:

- Enabled: `wss://`
- Disabled: `ws://`

**Default:** `true`

## Usage

1. Once the add-on is running, click **HASweetHome3D** in the Home Assistant sidebar — the editor loads inline inside Home Assistant
2. Create new home designs or load existing ones from the editor
3. Your designs are automatically saved to the add-on's data directory

## Support

For issues related to this add-on, please open an issue on the [GitHub repository](https://github.com/HVitureira/ha-sweethome3d).

For SweetHome3D application issues, visit the [official SweetHome3D website](http://www.sweethome3d.com/).

## License

This add-on is licensed under the GPL-2.0 license, same as SweetHome3D.

SweetHome3D is Copyright (c) 2024 Space Mushrooms.
