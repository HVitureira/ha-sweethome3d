# SweetHome3D Home Assistant Add-ons Repository

This repository contains Home Assistant add-ons for SweetHome3D integration.

## Add-ons

### SweetHome3D

SweetHome3D is a free interior design application that helps you place your furniture on a house 2D plan, with a 3D preview. This add-on brings the JavaScript version of SweetHome3D directly to your Home Assistant installation.

## Installation

1. In Home Assistant, go to **Supervisor** > **Add-on Store**
2. Click the three dots menu (⋮) in the top right
3. Select **Repositories**
4. Add this repository URL: `https://github.com/HVitureira/ha-sweethome3d`
5. Click **Add**
6. Find "SweetHome3D" in the add-on store and click **Install**

## Usage

After installation:
1. Start the SweetHome3D add-on
2. Click "SweetHome3D" in the Home Assistant sidebar
3. Begin designing your home interior

## Development

### Prerequisites

- Node.js 18+
- Docker (for local container testing)

### Project Structure

```
ha-sweethome3d/
├── www-vue/                  # Vue 3 frontend source (TypeScript)
│   ├── src/                  # Components, stores, services
│   ├── dist/                 # Build output (generated)
│   └── package.json
├── sweethome3d/
│   ├── www/                  # Served by the container (SH3D + built Vue assets)
│   │   ├── assets/           # ← Vue build output goes here
│   │   ├── index.html        # Main HTML (references Vue bundle)
│   │   ├── haApiProxy.php    # HA API proxy for entity selector
│   │   └── lib/              # SweetHome3D JS libraries
│   ├── Dockerfile
│   ├── config.yaml           # HA addon manifest
│   └── rootfs/               # Container filesystem (nginx, PHP, init scripts)
├── test-data/                # Local test files (.sh3x homes, device JSONs)
├── test-config.example       # Example addon options
└── docker-compose.yml        # Local Docker testing
```

### Building the Vue App

The Vue frontend must be built and its output copied to `sweethome3d/www/assets/`
before merging to master or building the Docker image.

```bash
# 1. Install dependencies (first time only)
cd www-vue
npm install

# 2. Build
npm run build

# 3. Replace old assets with new build
rm -f ../sweethome3d/www/assets/index-*.js ../sweethome3d/www/assets/index-*.css
cp dist/assets/* ../sweethome3d/www/assets/

# 4. Update the script/link tags in index.html to match the new hashed filenames.
#    Find the new filenames:
ls ../sweethome3d/www/assets/
#    Then edit sweethome3d/www/index.html lines 502-503 to reference them:
#      <script type="module" crossorigin src="./assets/index-NEWHASH.js"></script>
#      <link rel="stylesheet" crossorigin href="./assets/index-NEWHASH.css">
```

**Important:** The hashed filenames change on every build that modifies the code.
Always update the `<script>` and `<link>` tags in `sweethome3d/www/index.html`
to match the new filenames after building.

### Vite Dev Server (fast iteration)

For frontend development without Docker:

```bash
cd www-vue
npm run dev
```

This starts a Vite dev server with hot-reload. SH3D library files are served
from `sweethome3d/www/` (configured as `publicDir`), and PHP endpoints are
emulated by Vite middleware using `test-data/`.

To enable the HA entity selector in dev mode, configure your HA address and
long-lived access token in the Settings tab of the app.

### Local Docker Testing

```bash
# 1. Create local config from example
cp test-config.example test-config.local

# 2. Edit test-config.local with your HA credentials:
#    "homeassistant_address": "192.168.1.100:8123"
#    "homeassistant_token": "YOUR_LONG_LIVED_TOKEN"

# 3. Build and run
docker-compose up --build

# 4. Open http://localhost:8099
```

### Preparing a Merge to Master

Run these steps to ensure the built assets are up to date:

```bash
# From the repo root (ha-sweethome3d/)

# 1. Build the Vue frontend
cd www-vue && npm run build && cd ..

# 2. Sync built assets
rm -f sweethome3d/www/assets/index-*.js sweethome3d/www/assets/index-*.css
cp www-vue/dist/assets/* sweethome3d/www/assets/

# 3. Update index.html references (get the new filenames)
NEW_JS=$(ls sweethome3d/www/assets/index-*.js | xargs -n1 basename)
NEW_CSS=$(ls sweethome3d/www/assets/index-*.css | xargs -n1 basename)
echo "Update sweethome3d/www/index.html with:"
echo "  JS:  ./assets/$NEW_JS"
echo "  CSS: ./assets/$NEW_CSS"

# 4. Verify Docker build works
docker-compose up --build
```

After verifying locally, commit the updated files:
- `sweethome3d/www/assets/index-*.js`
- `sweethome3d/www/assets/index-*.css`
- `sweethome3d/www/index.html` (updated script/link tags)
- Any changed source files in `www-vue/src/`

## Support

For issues with these add-ons, please [open an issue](https://github.com/HVitureira/ha-sweethome3d/issues) on GitHub.

## License

This project is licensed under the GPL-2.0 License - see the [LICENSE](LICENSE) file for details.
