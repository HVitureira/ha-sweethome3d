# SweetHome3D Home Assistant Add-on

![Supports aarch64 Architecture][aarch64-shield] ![Supports amd64 Architecture][amd64-shield] ![Supports armhf Architecture][armhf-shield] ![Supports armv7 Architecture][armv7-shield] ![Supports i386 Architecture][i386-shield]

[aarch64-shield]: https://img.shields.io/badge/aarch64-yes-green.svg
[amd64-shield]: https://img.shields.io/badge/amd64-yes-green.svg
[armhf-shield]: https://img.shields.io/badge/armhf-yes-green.svg
[armv7-shield]: https://img.shields.io/badge/armv7-yes-green.svg
[i386-shield]: https://img.shields.io/badge/i386-yes-green.svg

## About

SweetHome3D is a free interior design application that helps you place your furniture on a house 2D plan, with a 3D preview. This add-on brings the JavaScript version of SweetHome3D directly to your Home Assistant installation.

## Features

- Complete SweetHome3D JS application
- Web-based 3D home design interface
- Save and load your home designs
- Integrated with Home Assistant sidebar
- Support for furniture catalogs and textures
- PHP backend for file operations

## Installation

1. Add this repository to your Home Assistant add-on store
2. Install the SweetHome3D add-on
3. Start the add-on
4. A **SweetHome3D** entry appears in the Home Assistant sidebar — click it to open the editor inline inside Home Assistant (via Ingress). No host port or external URL is exposed.

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

1. Once the add-on is running, click **SweetHome3D** in the Home Assistant sidebar — the editor loads inline inside Home Assistant
2. Create new home designs or load existing ones from the editor
3. Your designs are automatically saved to the add-on's data directory

## Support

For issues related to this add-on, please open an issue on the [GitHub repository](https://github.com/HVitureira/ha-sweethome3d).

For SweetHome3D application issues, visit the [official SweetHome3D website](http://www.sweethome3d.com/).

## License

This add-on is licensed under the GPL-2.0 license, same as SweetHome3D.

SweetHome3D is Copyright (c) 2024 Space Mushrooms.
