# Changelog

All notable changes to this project will be documented in this file.

## [1.1.0] - 2026-04-29

### Changed
- Addon is now ingress-only and embeds in the Home Assistant sidebar.
  Removed the public `8099/tcp` port mapping and the external `webui`
  URL — SweetHome3D is reached exclusively through the HA sidebar entry
  via Home Assistant Ingress.

## [1.0.0] - 2025-10-15

### Added
- Initial release of SweetHome3D Home Assistant Add-on
- Complete SweetHome3D JS application integration
- PHP backend support for file operations
- Nginx web server configuration
- Home Assistant sidebar integration
- Configurable PHP settings (memory limit, execution time, file upload sizes)
- Support for all Home Assistant architectures (amd64, aarch64, armv7, armhf, i386)
- Automatic data directory creation with proper permissions
- Save and load functionality for home designs
- Complete furniture and texture catalogs

### Features
- Web-based 3D home design interface
- Real-time 2D plan editing with 3D preview
- Furniture placement and arrangement
- Texture and material application
- File import/export capabilities
- Multi-language support
