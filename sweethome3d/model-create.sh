#!/bin/bash
# Complete script to create all Home Assistant device icons and models
# Run from project root directory

set -e

echo "🏠 Home Assistant Device Creation Script"
echo "========================================"
echo ""

# Check location
if [ ! -d "sweethome3d/www/lib/resources/models" ]; then
    echo "❌ Error: Run this from project root (where sweethome3d folder is)"
    exit 1
fi

cd sweethome3d/www/lib/resources/models

echo "📍 Working in: $(pwd)"
echo ""

# ============================================
# PART 1: CREATE PNG ICONS
# ============================================

echo "🎨 Creating PNG icons..."

# Check for ImageMagick (try magick command first, then convert)
if command -v magick &> /dev/null; then
    echo "  Using ImageMagick (magick command)..."
    
    magick -size 64x64 xc:"#FF4500" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "T" ha-sensor-temp.png
    echo "  ✓ ha-sensor-temp.png"
    
    magick -size 64x64 xc:"#2196F3" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "H" ha-sensor-humidity.png
    echo "  ✓ ha-sensor-humidity.png"
    
    magick -size 64x64 xc:"#9C27B0" -gravity center -pointsize 20 -fill white -font Arial-Bold -annotate +0+0 "T+H" ha-sensor-temp-humidity.png
    echo "  ✓ ha-sensor-temp-humidity.png"
    
    magick -size 64x64 xc:"#FFD700" -gravity center -pointsize 24 -fill black -font Arial-Bold -annotate +0+0 "M" ha-sensor-motion.png
    echo "  ✓ ha-sensor-motion.png"
    
    magick -size 64x64 xc:"#FFC800" -gravity center -pointsize 24 -fill black -font Arial-Bold -annotate +0+0 "L" ha-sensor-light.png
    echo "  ✓ ha-sensor-light.png"
    
    magick -size 64x64 xc:"#FFD700" -gravity center -pointsize 18 -fill black -font Arial-Bold -annotate +0+0 "M+L" ha-sensor-motion-light.png
    echo "  ✓ ha-sensor-motion-light.png"
    
    magick -size 64x64 xc:"#FFFF00" -gravity center -pointsize 24 -fill black -font Arial-Bold -annotate +0+0 "L" ha-light-bulb.png
    echo "  ✓ ha-light-bulb.png"
    
    magick -size 64x64 xc:"#FFA500" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "D" ha-light-dimmer.png
    echo "  ✓ ha-light-dimmer.png"
    
    magick -size 64x64 xc:"#4CAF50" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "P" ha-switch-plug.png
    echo "  ✓ ha-switch-plug.png"

elif command -v convert &> /dev/null && magick -version 2>/dev/null | grep -i imagemagick &> /dev/null; then
    echo "  Using ImageMagick (convert command)..."
    
    magick -size 64x64 xc:"#FF4500" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "T" ha-sensor-temp.png
    echo "  ✓ ha-sensor-temp.png"
    
    magick -size 64x64 xc:"#2196F3" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "H" ha-sensor-humidity.png
    echo "  ✓ ha-sensor-humidity.png"
    
    magick -size 64x64 xc:"#9C27B0" -gravity center -pointsize 20 -fill white -font Arial-Bold -annotate +0+0 "T+H" ha-sensor-temp-humidity.png
    echo "  ✓ ha-sensor-temp-humidity.png"
    
    magick -size 64x64 xc:"#FFD700" -gravity center -pointsize 24 -fill black -font Arial-Bold -annotate +0+0 "M" ha-sensor-motion.png
    echo "  ✓ ha-sensor-motion.png"
    
    magick -size 64x64 xc:"#FFC800" -gravity center -pointsize 24 -fill black -font Arial-Bold -annotate +0+0 "L" ha-sensor-light.png
    echo "  ✓ ha-sensor-light.png"
    
    magick -size 64x64 xc:"#FFD700" -gravity center -pointsize 18 -fill black -font Arial-Bold -annotate +0+0 "M+L" ha-sensor-motion-light.png
    echo "  ✓ ha-sensor-motion-light.png"
    
    magick -size 64x64 xc:"#FFFF00" -gravity center -pointsize 24 -fill black -font Arial-Bold -annotate +0+0 "L" ha-light-bulb.png
    echo "  ✓ ha-light-bulb.png"
    
    magick -size 64x64 xc:"#FFA500" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "D" ha-light-dimmer.png
    echo "  ✓ ha-light-dimmer.png"
    
    magick -size 64x64 xc:"#4CAF50" -gravity center -pointsize 24 -fill white -font Arial-Bold -annotate +0+0 "P" ha-switch-plug.png
    echo "  ✓ ha-switch-plug.png"
    
else
    echo "  ⚠️  ImageMagick not found - creating solid color icons..."
    
    # Fallback: create solid color 64x64 PNGs (requires Python/PIL)
    if command -v python3 &> /dev/null; then
        python3 << 'PYTHON_EOF'
from PIL import Image
icons = [
    ('ha-sensor-temp.png', '#FF4500'),
    ('ha-sensor-humidity.png', '#2196F3'),
    ('ha-sensor-temp-humidity.png', '#9C27B0'),
    ('ha-sensor-motion.png', '#FFD700'),
    ('ha-sensor-light.png', '#FFC800'),
    ('ha-sensor-motion-light.png', '#FFD700'),
    ('ha-light-bulb.png', '#FFFF00'),
    ('ha-light-dimmer.png', '#FFA500'),
    ('ha-switch-plug.png', '#4CAF50'),
]
for name, color in icons:
    img = Image.new('RGB', (64, 64), color=color)
    img.save(name)
    print(f"  ✓ {name}")
PYTHON_EOF
    else
        echo "  ❌ Neither ImageMagick nor Python found - create icons manually"
    fi
fi

echo ""

# ============================================
# PART 2: CREATE OBJ MODELS + ZIP
# ============================================

echo "🎲 Creating 3D models..."

# Function to create a simple cube model
create_model() {
    local name=$1
    local width=$2
    local height=$3
    local depth=$4
    local color_r=$5
    local color_g=$6
    local color_b=$7
    local material=$8
    
    local half_w=$(awk "BEGIN {print $width / 2}")
    local half_d=$(awk "BEGIN {print $depth / 2}")
    
    mkdir -p "temp-$name"
    cd "temp-$name"
    
    # Create OBJ
    cat > "$name.obj" << EOF
# $name
mtllib $name.mtl

o ${material}

v -$half_w 0.0 -$half_d
v $half_w 0.0 -$half_d
v $half_w 0.0 $half_d
v -$half_w 0.0 $half_d
v -$half_w $height -$half_d
v $half_w $height -$half_d
v $half_w $height $half_d
v -$half_w $height $half_d

usemtl ${material}

f 1 2 6 5
f 2 3 7 6
f 3 4 8 7
f 4 1 5 8
f 1 4 3 2
f 5 6 7 8
EOF
    
    # Create MTL
    cat > "$name.mtl" << EOF
# $name Material
newmtl ${material}
Ka $color_r $color_g $color_b
Kd $color_r $color_g $color_b
Ks 0.5 0.5 0.5
Ns 32
d 1.0
illum 2
EOF
    
    cd ..
    zip -q -r "$name.zip" "temp-$name/"
    rm -rf "temp-$name"
    
    echo "  ✓ $name.zip"
}

# Create all 9 models
create_model "ha-sensor-temp" 5 5 5 1.0 0.3 0.1 "TempSensor"
create_model "ha-sensor-humidity" 5 5 5 0.13 0.59 0.95 "HumiditySensor"
create_model "ha-sensor-temp-humidity" 6 5 6 0.6 0.15 0.69 "ComboSensor"
create_model "ha-sensor-motion" 5 5 5 1.0 0.84 0.0 "MotionSensor"
create_model "ha-sensor-light" 5 1 5 1.0 0.78 0.0 "LightSensor"
create_model "ha-sensor-motion-light" 6 5 6 1.0 0.84 0.0 "MotionLightSensor"
create_model "ha-light-bulb" 8 12 8 1.0 1.0 0.5 "LightBulb"
create_model "ha-light-dimmer" 8 1 4 1.0 0.65 0.0 "Dimmer"
create_model "ha-switch-plug" 7 8 7 0.3 0.69 0.31 "SmartPlug"

echo ""

# ============================================
# VERIFICATION
# ============================================

echo "📋 Verifying files..."
echo ""

PNG_COUNT=$(ls ha-*.png 2>/dev/null | wc -l)
ZIP_COUNT=$(ls ha-*.zip 2>/dev/null | wc -l)

echo "PNG Icons: $PNG_COUNT/9"
echo "ZIP Models: $ZIP_COUNT/9"
echo ""

if [ "$PNG_COUNT" -eq 9 ] && [ "$ZIP_COUNT" -eq 9 ]; then
    echo "✅ Success! All 18 files created."
    echo ""
    echo "Files created:"
    ls -lh ha-*.png ha-*.zip | awk '{print "  " $9 " (" $5 ")"}'
else
    echo "⚠️  Some files may be missing. Check output above."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📝 Next Steps:"
echo ""
echo "1. Review files in: $(pwd)"
echo ""
echo "2. Create HADeviceCatalog.json in parent directory"
echo "   cd ../.. "
echo "   nano HADeviceCatalog.json"
echo ""
echo "3. Add exportForUnity.php to www/"
echo ""
echo "4. Modify index.html to add HA integration"
echo ""
echo "5. Rebuild and test:"
echo "   docker-compose down && docker-compose up --build"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"