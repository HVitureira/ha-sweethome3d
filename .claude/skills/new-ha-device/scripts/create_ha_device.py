#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
create_ha_device.py - Add a new HA smart device to SweetHome3D.

Usage:
  python create_ha_device.py \
    --name ha-co2-sensor \
    --display-name "CO2 Sensor" \
    --catalog-id ha_co2_sensor \
    --category "Smart Sensors" \
    --color "80,200,120" \
    --width 5 --depth 5 --height 8 \
    --elevation 150 \
    --project-root "C:/path/to/SweetHome3DJS-7.5.2" \
    [--device-type co2_sensor] \
    [--particle-color "0.4,0.9,0.4,0.5"] \
    [--tags "CO2, Air Quality"]

Files produced:
  <models-dir>/ha-{name}.zip  (OBJ + MTL cube inside temp-ha-{name}/)
  <models-dir>/ha-{name}.png  (64×64 solid-color icon)
  DefaultFurnitureCatalog.json  (14 new properties appended at next free #N)
  unity-export-utils.js  (optional: getDeviceType if-block + getParticleSettings case)
"""

import argparse
import json
import os
import re
import struct
import sys
import zlib
import zipfile

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
if sys.platform == "win32":
    import io as _io
    sys.stdout = _io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = _io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

VALID_CATEGORIES = [
    "Smart Sensors",
    "Smart Lights",
    "Smart Switches",
    "Smart Thermostats",
    "Smart Cameras",
]

# ---------------------------------------------------------------------------
# Geometry
# ---------------------------------------------------------------------------

def make_mtl(name, r, g, b):
    """MTL material file for a solid-color cube."""
    r_f, g_f, b_f = r / 255.0, g / 255.0, b / 255.0
    return (
        f"# Material for {name}\n"
        f"newmtl device_mat\n"
        f"Ka 0.200000 0.200000 0.200000\n"
        f"Kd {r_f:.6f} {g_f:.6f} {b_f:.6f}\n"
        f"Ks 0.100000 0.100000 0.100000\n"
        f"Ns 10.000000\n"
        f"d 1.000000\n"
    )


def make_obj(name, w, h, d):
    """
    OBJ cube with dimensions W × H × D (SweetHome3D units = cm).
    Faces have outward normals (CCW winding).
    Vertices:
      1=(0,0,0) 2=(W,0,0) 3=(W,H,0) 4=(0,H,0)
      5=(0,0,D) 6=(W,0,D) 7=(W,H,D) 8=(0,H,D)
    """
    lines = [
        f"# HA device model: {name}",
        f"mtllib {name}.mtl",
        "",
        "# 8 corners (x=width, y=height, z=depth)",
        f"v 0.000000 0.000000 0.000000",
        f"v {w:.6f} 0.000000 0.000000",
        f"v {w:.6f} {h:.6f} 0.000000",
        f"v 0.000000 {h:.6f} 0.000000",
        f"v 0.000000 0.000000 {d:.6f}",
        f"v {w:.6f} 0.000000 {d:.6f}",
        f"v {w:.6f} {h:.6f} {d:.6f}",
        f"v 0.000000 {h:.6f} {d:.6f}",
        "",
        "usemtl device_mat",
        "",
        "# Faces (quad, CCW from outside)",
        "f 1 4 3 2",   # front  (z=0, normal -z)
        "f 5 6 7 8",   # back   (z=D, normal +z)
        "f 1 2 6 5",   # bottom (y=0, normal -y)
        "f 4 8 7 3",   # top    (y=H, normal +y)
        "f 1 5 8 4",   # left   (x=0, normal -x)
        "f 2 3 7 6",   # right  (x=W, normal +x)
        "",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# PNG (pure stdlib - no Pillow / ImageMagick required)
# ---------------------------------------------------------------------------

def make_png_bytes(width, height, r, g, b):
    """Return bytes of a valid solid-color RGB PNG."""

    def write_chunk(chunk_type: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(chunk_type + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk_type + data + struct.pack(">I", crc)

    # IHDR: width(4) height(4) bit_depth(1) color_type(1=RGB=2) compress(1) filter(1) interlace(1)
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)

    # Raw image rows: filter_byte=0 followed by RGB pixels
    row = bytes([0]) + bytes([r, g, b] * width)
    raw = row * height
    compressed = zlib.compress(raw, 9)

    sig = b"\x89PNG\r\n\x1a\n"
    return (
        sig
        + write_chunk(b"IHDR", ihdr_data)
        + write_chunk(b"IDAT", compressed)
        + write_chunk(b"IEND", b"")
    )


# ---------------------------------------------------------------------------
# Catalog update
# ---------------------------------------------------------------------------

def find_next_index(catalog: dict) -> int:
    """Return max existing #N index + 1."""
    indices = []
    for key in catalog:
        m = re.search(r"#(\d+)$", key)
        if m:
            indices.append(int(m.group(1)))
    return max(indices) + 1 if indices else 1


def build_catalog_entries(n, name, display_name, catalog_id, category,
                           w, d, h, elevation, tags, model_size_bytes):
    """Return OrderedDict of the 14 new catalog properties."""
    entries = {}
    model_path = f"lib/resources/models/{name}.zip!/temp-{name}/{name}.obj"
    icon_path  = f"lib/resources/models/{name}.png"
    tag_str    = f"HA, IoT, Smart Home" + (f", {tags}" if tags else "")

    entries[f"model#{n}"]          = model_path
    entries[f"catalogId#{n}"]      = catalog_id
    entries[f"name#{n}"]           = display_name
    entries[f"icon#{n}"]           = icon_path
    entries[f"category#{n}"]       = category
    entries[f"width#{n}"]          = str(w)
    entries[f"depth#{n}"]          = str(d)
    entries[f"height#{n}"]         = str(h)
    entries[f"elevation#{n}"]      = str(elevation)
    entries[f"movable#{n}"]        = "true"
    entries[f"doorOrWindow#{n}"]   = "false"
    entries[f"tags#{n}"]           = tag_str
    entries[f"creator#{n}"]        = "HA"
    entries[f"modelSize#{n}"]      = str(model_size_bytes)
    return entries


# ---------------------------------------------------------------------------
# unity-export-utils.js patching
# ---------------------------------------------------------------------------

def patch_get_device_type(js_text: str, device_type: str, keyword: str) -> str:
    """Insert an if-block for keyword → device_type before return 'unknown'."""
    insert_str = (
        f"    if (combined.includes('{keyword}')) {{\n"
        f"      return '{device_type}';\n"
        f"    }}\n"
        f"    "
    )
    # Find "    return 'unknown';" and insert before it
    pattern = r"(    return 'unknown';)"
    if not re.search(pattern, js_text):
        raise ValueError("Could not find `return 'unknown';` anchor in getDeviceType()")
    return re.sub(pattern, insert_str + r"\1", js_text, count=1)


def patch_get_particle_settings(js_text: str, device_type: str, pr, pg, pb, pa) -> str:
    """Insert a new case in the getParticleSettings() switch before its closing brace."""
    new_case = (
        f"\n      case '{device_type}':\n"
        f"        settings.color = {{ r: {pr}, g: {pg}, b: {pb}, a: {pa} }};\n"
        f"        settings.emissionRate = 10;\n"
        f"        break;\n"
    )
    # Find the last 'break;' in the switch, then the closing brace after it.
    # Pattern: match the last case's break line and the switch's closing brace + return.
    pattern = r"(        break;\n    \}\n    \n    return settings;)"
    if not re.search(pattern, js_text):
        # Try without the blank line variant
        pattern = r"(        break;\n    \}\n\n    return settings;)"
    if not re.search(pattern, js_text):
        raise ValueError("Could not find switch closing brace anchor in getParticleSettings()")
    replacement = r"        break;" + new_case + r"    }" + "\n    \n    return settings;"
    return re.sub(pattern, replacement, js_text, count=1)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="Create a new HA device for SweetHome3D")
    p.add_argument("--name", required=True,
                   help="kebab-case slug, e.g. co2-sensor (ha- prefix auto-added)")
    p.add_argument("--display-name", required=True,
                   help='Human-readable name, e.g. "CO2 Sensor"')
    p.add_argument("--catalog-id", required=True,
                   help="Catalog ID, e.g. ha_co2_sensor (ha_ prefix auto-added)")
    p.add_argument("--category", required=True,
                   help=f"One of: {', '.join(VALID_CATEGORIES)}")
    p.add_argument("--color", required=True,
                   help="RGB 0-255 as R,G,B e.g. 80,200,120")
    p.add_argument("--width",  required=True, type=float, help="Width in cm")
    p.add_argument("--depth",  required=True, type=float, help="Depth in cm")
    p.add_argument("--height", required=True, type=float, help="Height in cm")
    p.add_argument("--elevation", default=0, type=float,
                   help="Floor-to-bottom distance in cm (default: 0)")
    p.add_argument("--tags", default="",
                   help="Extra catalog tags, comma-separated")
    p.add_argument("--device-type", default="",
                   help="If set, patches unity-export-utils.js getDeviceType()")
    p.add_argument("--particle-color", default="",
                   help="RGBA 0-1 as R,G,B,A for getParticleSettings() (requires --device-type)")
    p.add_argument("--project-root", required=True,
                   help="Path to SweetHome3DJS-7.5.2 root")
    return p.parse_args()


def main():
    args = parse_args()

    # ---- Normalize inputs ------------------------------------------------
    name = args.name
    if not name.startswith("ha-"):
        name = "ha-" + name

    catalog_id = args.catalog_id
    if not catalog_id.startswith("ha_"):
        catalog_id = "ha_" + catalog_id

    if args.category not in VALID_CATEGORIES:
        print(f"ERROR: category must be one of: {', '.join(VALID_CATEGORIES)}", file=sys.stderr)
        sys.exit(1)

    color_parts = [int(x.strip()) for x in args.color.split(",")]
    if len(color_parts) != 3 or not all(0 <= c <= 255 for c in color_parts):
        print("ERROR: --color must be R,G,B with values 0-255", file=sys.stderr)
        sys.exit(1)
    r, g, b = color_parts

    project_root = os.path.abspath(args.project_root)
    if not os.path.isdir(project_root):
        print(f"ERROR: --project-root does not exist: {project_root}", file=sys.stderr)
        sys.exit(1)

    # Resolve paths within the project
    ha_root    = os.path.join(project_root, "ha-sweethome3d", "sweethome3d", "www", "lib")
    models_dir = os.path.join(ha_root, "resources", "models")
    catalog_path = os.path.join(ha_root, "resources", "DefaultFurnitureCatalog.json")
    unity_js_path = os.path.join(ha_root, "unity-export-utils.js")

    for path in [models_dir, catalog_path]:
        if not os.path.exists(path):
            print(f"ERROR: Expected path not found: {path}", file=sys.stderr)
            sys.exit(1)

    # Check for name collision
    zip_path = os.path.join(models_dir, f"{name}.zip")
    png_path = os.path.join(models_dir, f"{name}.png")
    if os.path.exists(zip_path):
        print(f"ERROR: {zip_path} already exists. Choose a different name.", file=sys.stderr)
        sys.exit(1)

    # ---- Step 1: Generate OBJ + MTL content ------------------------------
    print(f"[1/7] Generating OBJ + MTL geometry for '{name}'...")
    obj_content = make_obj(name, args.width, args.height, args.depth)
    mtl_content = make_mtl(name, r, g, b)

    # ---- Step 2: Generate PNG icon (pure Python) -------------------------
    print("[2/7] Generating 64x64 PNG icon...")
    png_bytes = make_png_bytes(64, 64, r, g, b)

    # ---- Step 3: Write ZIP with correct internal structure ---------------
    # Path inside ZIP: temp-{name}/{name}.obj and temp-{name}/{name}.mtl
    print(f"[3/7] Creating {name}.zip...")
    inner_dir = f"temp-{name}"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(f"{inner_dir}/{name}.obj", obj_content)
        zf.writestr(f"{inner_dir}/{name}.mtl", mtl_content)
    zip_size = os.path.getsize(zip_path)
    print(f"       -> {zip_path} ({zip_size} bytes)")

    # ---- Step 4: Write PNG icon ------------------------------------------
    print(f"[4/7] Writing {name}.png...")
    with open(png_path, "wb") as f:
        f.write(png_bytes)
    print(f"       -> {png_path}")

    # ---- Step 5: Find next free catalog index ----------------------------
    print(f"[5/7] Reading catalog to find next index...")
    with open(catalog_path, "r", encoding="utf-8") as f:
        catalog = json.load(f)
    next_n = find_next_index(catalog)
    print(f"       -> Next index: #{next_n}")

    # ---- Step 6: Append catalog entries ----------------------------------
    print(f"[6/7] Appending catalog entry #{next_n}...")
    new_entries = build_catalog_entries(
        next_n, name, args.display_name, catalog_id, args.category,
        args.width, args.depth, args.height, args.elevation,
        args.tags, zip_size
    )
    catalog.update(new_entries)
    with open(catalog_path, "w", encoding="utf-8", newline="\n") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"       -> Added {len(new_entries)} properties to catalog")

    # ---- Step 7: Patch unity-export-utils.js (optional) -----------------
    if args.device_type:
        print(f"[7/7] Patching unity-export-utils.js for device type '{args.device_type}'...")
        if not os.path.isfile(unity_js_path):
            print(f"       WARNING: {unity_js_path} not found - skipping JS patch", file=sys.stderr)
        else:
            with open(unity_js_path, "r", encoding="utf-8") as f:
                js = f.read()

            # Derive keyword from device_type (replace _ with space, use first word)
            keyword = args.device_type.replace("_", " ").split()[0]

            try:
                js = patch_get_device_type(js, args.device_type, keyword)
            except ValueError as e:
                print(f"       WARNING: getDeviceType patch failed: {e}", file=sys.stderr)

            if args.particle_color:
                pc_parts = [float(x.strip()) for x in args.particle_color.split(",")]
                if len(pc_parts) == 4:
                    pr, pg_v, pb_v, pa = pc_parts
                    try:
                        js = patch_get_particle_settings(js, args.device_type, pr, pg_v, pb_v, pa)
                    except ValueError as e:
                        print(f"       WARNING: getParticleSettings patch failed: {e}", file=sys.stderr)
                else:
                    print("       WARNING: --particle-color needs R,G,B,A - skipping particle patch",
                          file=sys.stderr)

            with open(unity_js_path, "w", encoding="utf-8", newline="\n") as f:
                f.write(js)
            print(f"       -> {unity_js_path} patched")
    else:
        print("[7/7] Skipping unity-export-utils.js patch (no --device-type given)")

    # ---- Done ------------------------------------------------------------
    print()
    print("=" * 60)
    print(f"  Device '{args.display_name}' created successfully!")
    print(f"  Catalog ID : {catalog_id}")
    print(f"  Index      : #{next_n}")
    print(f"  Category   : {args.category}")
    print(f"  Dimensions : {args.width} x {args.depth} x {args.height} cm")
    print(f"  Elevation  : {args.elevation} cm")
    print(f"  Color      : rgb({r},{g},{b})")
    print(f"  ZIP        : {name}.zip ({zip_size} bytes)")
    print("=" * 60)


if __name__ == "__main__":
    main()
