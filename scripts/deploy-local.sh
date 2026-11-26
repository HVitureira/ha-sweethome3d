#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
ADDON_APP_ROOT="$REPO_ROOT/sweethome3d"

# Read HA Host from .env
ENV_FILE="$REPO_ROOT/.env"
HA_HOST="homeassistant.local"

if [ -f "$ENV_FILE" ]; then
    echo "Reading .env file..."
    source "$ENV_FILE"
else
    echo "⚠️  No .env file found. Using default HA_HOST: $HA_HOST"
fi

echo "🚀 Starting Local Addon Deployment"
echo "Target Host: $HA_HOST"
echo ""

# Run setup first
bash "$SCRIPT_DIR/setup.sh"

echo ""
echo "5. Copying addon files to Home Assistant..."

# Mount samba and copy (requires smbclient or cifs-utils)
# For macOS, typically mounted under /Volumes/addons
# For Linux, depends on user setup. We'll try to use smbclient if available.

if command -v smbclient >/dev/null 2>&1; then
    echo "Using smbclient to transfer files..."
    
    # Create the directory if it doesn't exist (ignore errors if it does)
    smbclient "//$HA_HOST/addons" -N -c "mkdir sweethome3d" 2>/dev/null || true
    
    # Transfer files
    cd "$ADDON_APP_ROOT"
    
    # Use tar pipeline over smbclient for recursive directory upload
    tar cf - . | smbclient "//$HA_HOST/addons" -N -c "cd sweethome3d; tar cx"
    
    echo "✅ Transfer complete"
elif [ -d "/Volumes/addons" ]; then
    # macOS typical mount point
    echo "Using macOS Samba mount point at /Volumes/addons..."
    mkdir -p "/Volumes/addons/sweethome3d"
    cp -R "$ADDON_APP_ROOT/"* "/Volumes/addons/sweethome3d/"
    echo "✅ Transfer complete"
else
    echo "❌ Neither 'smbclient' nor macOS '/Volumes/addons' found."
    echo "Please mount smb://$HA_HOST/addons manually and copy the '$ADDON_APP_ROOT' directory to it."
    exit 1
fi

echo ""
echo "🎉 Deployment to Samba share complete!"
echo "--------------------------------------------------------"
echo "Next steps in the Home Assistant UI:"
echo "1. Go to Settings -> Add-ons -> Add-on Store"
echo "2. Click the three dots (top right) -> Check for updates"
echo "3. Find 'HASweetHome3D' under Local Add-ons"
echo "4. Click Install (or Rebuild if already installed)"
echo "5. Click Start"
echo "--------------------------------------------------------"
