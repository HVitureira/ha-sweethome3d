#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ADDON_APP_ROOT="$REPO_ROOT/sweethome3d"

echo "Setting up SweetHome3D Home Assistant Add-on..."

if [ ! -d "$ADDON_APP_ROOT" ]; then
	echo "❌ Could not find expected add-on path at: $ADDON_APP_ROOT"
	exit 1
fi

# Make all scripts executable
chmod +x "$ADDON_APP_ROOT"/rootfs/etc/cont-init.d/* 2>/dev/null || true
chmod +x "$ADDON_APP_ROOT"/rootfs/etc/services.d/*/run 2>/dev/null || true
chmod +x "$ADDON_APP_ROOT"/rootfs/etc/services.d/*/finish 2>/dev/null || true
chmod +x "$ADDON_APP_ROOT"/start.sh 2>/dev/null || true

echo "✅ File permissions set"

# Create data directory in www if it doesn't exist
mkdir -p "$ADDON_APP_ROOT"/www/data
mkdir -p "$REPO_ROOT"/test-data

echo "✅ Data directories created"

# Build Vue frontend and package web assets for addon runtime
echo "🧱 Building and packaging frontend assets..."

if [ ! -d "$REPO_ROOT/www-vue" ]; then
	echo "❌ Missing Vue app directory: $REPO_ROOT/www-vue"
	exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
	echo "❌ npm is required to build the Vue frontend but was not found in PATH"
	exit 1
fi

pushd "$REPO_ROOT/www-vue" >/dev/null

if [ ! -d node_modules ]; then
	echo "📦 Installing Vue dependencies..."
	npm install
fi

echo "⚙️  Running Vue build..."
npm run build

if [ ! -f dist/index.html ]; then
	echo "❌ Vue build did not produce dist/index.html"
	popd >/dev/null
	exit 1
fi

popd >/dev/null

# Overlay built Vue app into addon web root
echo "📁 Syncing Vue dist into addon web root..."
cp -a "$REPO_ROOT/www-vue/dist/." "$ADDON_APP_ROOT/www/"

# Package Unity WebGL files under a served subpath
if [ -d "$REPO_ROOT/unity-build" ]; then
	echo "🧩 Syncing Unity build into addon web root..."
	rm -rf "$ADDON_APP_ROOT/www/unity-visualizer"
	cp -a "$REPO_ROOT/unity-build" "$ADDON_APP_ROOT/www/unity-visualizer"
else
	echo "⚠️  Unity build folder not found at $REPO_ROOT/unity-build"
	echo "    Unity view tab will not load until this folder exists."
fi

echo "✅ Frontend packaging complete"

# Verification step
bash "$SCRIPT_DIR/verify.sh"

echo ""
echo "🎉 Setup complete! You can now run 'docker-compose up --build' from the repo root."
