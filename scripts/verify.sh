#!/usr/bin/env bash
# Verify SweetHome3D HA Add-on structure, LF line endings, Unity index.html sync, and AI setup.
# Compatible with macOS Bash 3.2+ and Linux.
# Usage: ./scripts/verify.sh [--full]  (--full also runs Vue type-check)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ADDON_APP_ROOT="$REPO_ROOT/sweethome3d"
RUN_FULL=0

for arg in "$@"; do
  case "$arg" in
    --full) RUN_FULL=1 ;;
  esac
done

echo "Verifying Add-on Directory Structure..."
ERROR_COUNT=0

check_file() {
  if [ ! -f "$ADDON_APP_ROOT/$1" ]; then
    echo "❌ Missing file: $1"
    ERROR_COUNT=$((ERROR_COUNT + 1))
  else
    echo "✅ Found: $1"
  fi
}

check_dir() {
  if [ ! -d "$ADDON_APP_ROOT/$1" ]; then
    echo "❌ Missing directory: $1"
    ERROR_COUNT=$((ERROR_COUNT + 1))
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

JS_ASSET="$(find "$ADDON_APP_ROOT/www/assets" -maxdepth 1 -name "index-*.js" 2>/dev/null | head -n 1 || true)"
CSS_ASSET="$(find "$ADDON_APP_ROOT/www/assets" -maxdepth 1 -name "index-*.css" 2>/dev/null | head -n 1 || true)"

if [ -z "$JS_ASSET" ]; then
  echo "❌ Missing hashed JS asset in www/assets/"
  ERROR_COUNT=$((ERROR_COUNT + 1))
else
  echo "✅ Found hashed JS asset: $(basename "$JS_ASSET")"
fi

if [ -z "$CSS_ASSET" ]; then
  echo "❌ Missing hashed CSS asset in www/assets/"
  ERROR_COUNT=$((ERROR_COUNT + 1))
else
  echo "✅ Found hashed CSS asset: $(basename "$CSS_ASSET")"
fi

echo ""
echo "[Unity WebGL Integration]"
check_dir "www/unity-visualizer"
check_dir "www/unity-visualizer/Build"
check_dir "www/unity-visualizer/StreamingAssets"
check_file "www/unity-visualizer/index.html"

if [ -f "$REPO_ROOT/unity-build/index.html" ] && [ -f "$ADDON_APP_ROOT/www/unity-visualizer/index.html" ]; then
  if ! cmp -s "$REPO_ROOT/unity-build/index.html" "$ADDON_APP_ROOT/www/unity-visualizer/index.html"; then
    echo "⚠️  Drift detected: unity-build/index.html differs from sweethome3d/www/unity-visualizer/index.html (run scripts/setup.sh to sync)"
  else
    echo "✅ Unity index.html synced between unity-build/ and sweethome3d/www/unity-visualizer/"
  fi
fi

echo ""
echo "[Container Script Line Endings (LF)]"
CRLF_FOUND=0
for f in \
  "$ADDON_APP_ROOT/start.sh" \
  "$ADDON_APP_ROOT"/rootfs/etc/cont-init.d/* \
  "$ADDON_APP_ROOT"/rootfs/etc/services.d/*/run \
  "$ADDON_APP_ROOT"/rootfs/etc/services.d/*/finish; do
  [ -f "$f" ] || continue
  if LC_ALL=C grep -q $'\r' "$f" 2>/dev/null; then
    echo "❌ CRLF found in container script: ${f#$REPO_ROOT/}"
    CRLF_FOUND=$((CRLF_FOUND + 1))
    ERROR_COUNT=$((ERROR_COUNT + 1))
  fi
done
if [ "$CRLF_FOUND" -eq 0 ]; then
  echo "✅ All container scripts use LF endings"
fi

if [ "$RUN_FULL" -eq 1 ] && [ -d "$REPO_ROOT/www-vue/node_modules" ]; then
  echo ""
  echo "[Vue Type-Check]"
  (cd "$REPO_ROOT/www-vue" && npm run type-check) || ERROR_COUNT=$((ERROR_COUNT + 1))
fi

echo ""
echo "[AI Setup Audit & Thesis Impact Advisory]"
if command -v python3 >/dev/null 2>&1; then
  python3 "$SCRIPT_DIR/check-ai-setup.py" || ERROR_COUNT=$((ERROR_COUNT + 1))
  [ -f "$SCRIPT_DIR/check-thesis-impact.py" ] && python3 "$SCRIPT_DIR/check-thesis-impact.py" || true
elif command -v python >/dev/null 2>&1; then
  python "$SCRIPT_DIR/check-ai-setup.py" || ERROR_COUNT=$((ERROR_COUNT + 1))
  [ -f "$SCRIPT_DIR/check-thesis-impact.py" ] && python "$SCRIPT_DIR/check-thesis-impact.py" || true
fi

echo ""
if [ "$ERROR_COUNT" -eq 0 ]; then
  echo "🎉 Verification passed! The addon is ready to run or deploy."
  exit 0
else
  echo "⚠️  Verification failed with $ERROR_COUNT error(s)."
  exit 1
fi
