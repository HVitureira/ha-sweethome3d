#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ADDON_APP_ROOT="$REPO_ROOT/sweethome3d"

echo "Verifying Add-on Directory Structure..."

ERROR_COUNT=0

function check_file {
	if [ ! -f "$ADDON_APP_ROOT/$1" ]; then
		echo "❌ Missing file: $1"
		((ERROR_COUNT++))
	else
		echo "✅ Found: $1"
	fi
}

function check_dir {
	if [ ! -d "$ADDON_APP_ROOT/$1" ]; then
		echo "❌ Missing directory: $1"
		((ERROR_COUNT++))
	else
		echo "✅ Found: $1"
	fi
}

echo ""
echo "[Core Configuration]"
check_file "config.yaml"
check_file "Dockerfile"
check_file "build.yaml"
check_file "start.sh"

echo ""
echo "[s6-overlay Rootfs]"
check_dir "rootfs"
check_dir "rootfs/etc/cont-init.d"
check_dir "rootfs/etc/services.d/nginx"
check_dir "rootfs/etc/services.d/php-fpm"
check_file "rootfs/etc/services.d/nginx/run"
check_file "rootfs/etc/services.d/php-fpm/run"

echo ""
echo "[Web Assets]"
check_dir "www"
check_file "www/index.html"
check_file "www/listHomes.php"
check_file "www/writeData.php"
check_file "www/deleteHome.php"
check_dir "www/assets"
check_dir "www/lib"

# Check if hashed JS/CSS assets exist
JS_ASSET=$(find "$ADDON_APP_ROOT/www/assets" -name "index-*.js" 2>/dev/null | head -n 1)
CSS_ASSET=$(find "$ADDON_APP_ROOT/www/assets" -name "index-*.css" 2>/dev/null | head -n 1)

if [ -z "$JS_ASSET" ]; then
	echo "❌ Missing hashed JS asset in www/assets/"
	((ERROR_COUNT++))
else
	echo "✅ Found hashed JS asset: $(basename "$JS_ASSET")"
fi

if [ -z "$CSS_ASSET" ]; then
	echo "❌ Missing hashed CSS asset in www/assets/"
	((ERROR_COUNT++))
else
	echo "✅ Found hashed CSS asset: $(basename "$CSS_ASSET")"
fi

echo ""
echo "[Unity WebGL Integration]"
check_dir "www/unity-visualizer"
check_dir "www/unity-visualizer/Build"
check_dir "www/unity-visualizer/StreamingAssets"
check_file "www/unity-visualizer/index.html"

echo ""
if [ $ERROR_COUNT -eq 0 ]; then
	echo "🎉 Verification passed! The addon is ready to run or deploy."
	exit 0
else
	echo "⚠️  Verification failed with $ERROR_COUNT errors."
	echo "Run scripts/setup.sh to build and sync the required assets."
	exit 1
fi
