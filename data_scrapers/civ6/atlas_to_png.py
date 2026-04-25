"""
Crop tech icons out of the Civ 6 SDK Tech atlas DDS files.

The SDK ships several sized atlases (Tech30/38/42/128/160) plus _2 overflow
atlases. We use the 128px atlas because it matches the wheel's display size
and is plain RGBA8 (no BCn decode needed).

Inputs (under ./data/, which is gitignored):
    civ6/civdata.json
    data_scrapers/civ6/data/Assets/Base/Assets/UI/Icons/Icons_Tech.xml
    data_scrapers/civ6/data/sdk/Civ6/pantry/Textures/Tech128.dds
    data_scrapers/civ6/data/sdk/Civ6/pantry/Textures/Tech128_2.dds

Output:
    civ6/img/technologies/{TECH_ID}.png

Run from this directory:
    python3 atlas_to_png.py
"""

import argparse
import json
import os
import struct
import xml.etree.ElementTree as ET
from typing import Dict, Tuple

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DATA_DIR = os.path.join(HERE, 'data')

ICONS_XML = os.path.join(DATA_DIR, 'Assets', 'Base', 'Assets', 'UI', 'Icons', 'Icons_Tech.xml')
TEXTURES = os.path.join(DATA_DIR, 'sdk', 'Civ6', 'pantry', 'Textures')
CIVDATA = os.path.join(REPO, 'civ6', 'civdata.json')
OUTDIR = os.path.join(REPO, 'civ6', 'img', 'technologies')

# We use the 128 atlas. Other sizes (Tech30/38/42/160) follow the same
# layout, so adapting later is just a matter of changing these.
ATLAS_SIZE = 128
ATLAS_FILES = {
    'ICON_ATLAS_TECH':   os.path.join(TEXTURES, f'Tech{ATLAS_SIZE}.dds'),
    'ICON_ATLAS_TECH_2': os.path.join(TEXTURES, f'Tech{ATLAS_SIZE}_2.dds'),
}


def load_rgba8_dds(path: str) -> Image.Image:
    """Load a DDS that's plain uncompressed BGRA8 / RGBA8 into a PIL image.

    The Civ 6 SDK Tech atlases are 1024x1024 RGBA8 with a standard 128-byte
    DDS header (DDPF_RGB | DDPF_ALPHAPIXELS, 32 bpp, masks B/G/R/A).
    Everything before the pixel data is skipped.
    """
    with open(path, 'rb') as f:
        magic = f.read(4)
        if magic != b'DDS ':
            raise ValueError(f'{path}: not a DDS file ({magic!r})')
        header = f.read(124)  # rest of DDS_HEADER
        height = struct.unpack_from('<I', header, 8)[0]
        width = struct.unpack_from('<I', header, 12)[0]
        # DDS_PIXELFORMAT lives at file offset 0x4c. With the 4-byte magic
        # already consumed, that's header offset 0x48. dwRGBBitCount is at
        # +12 within the pixelformat (offset 0x54 in header).
        bpp = struct.unpack_from('<I', header, 0x54)[0]
        rmask, gmask, bmask, amask = struct.unpack_from('<IIII', header, 0x58)
        if bpp != 32:
            raise ValueError(f'{path}: expected 32 bpp, got {bpp}')
        # Standard SDK encoding: B R G in the low->high bytes with A on top.
        # Pillow reads via raw "BGRA" mode for that layout; verify the masks
        # so we fail loud if a future atlas swaps channels on us.
        expected = (0x000000FF, 0x0000FF00, 0x00FF0000, 0xFF000000)
        if (rmask, gmask, bmask, amask) != expected:
            raise ValueError(
                f'{path}: unexpected channel masks '
                f'R=0x{rmask:08x} G=0x{gmask:08x} B=0x{bmask:08x} A=0x{amask:08x}'
            )
        pixels = f.read(width * height * 4)
    # Masks above are R=low, A=high → that's PIL "RGBA" raw mode.
    return Image.frombytes('RGBA', (width, height), pixels, 'raw', 'RGBA')


def load_icon_map() -> Dict[str, Tuple[str, int]]:
    """Return ICON_TECH_* → (atlas_name, index), filtering out _FOW variants."""
    root = ET.parse(ICONS_XML).getroot()
    defs = root.find('IconDefinitions')
    out: Dict[str, Tuple[str, int]] = {}
    for row in defs.findall('Row'):
        name = row.get('Name', '')
        if not name.startswith('ICON_TECH_'):
            continue
        if name.endswith('_FOW'):
            continue
        out[name] = (row.get('Atlas'), int(row.get('Index')))
    return out


def crop_tile(atlas: Image.Image, index: int, size: int) -> Image.Image:
    """Crop the (row, col) tile for atlas index, where idx = row*8 + col."""
    cols = atlas.width // size
    row, col = divmod(index, cols)
    box = (col * size, row * size, (col + 1) * size, (row + 1) * size)
    return atlas.crop(box)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--dry-run', action='store_true',
                    help='print what would be written without creating files')
    args = ap.parse_args()

    icons = load_icon_map()
    techs = json.load(open(CIVDATA))['technologies']

    atlases = {name: load_rgba8_dds(path) for name, path in ATLAS_FILES.items()}

    if not args.dry_run:
        os.makedirs(OUTDIR, exist_ok=True)

    written = 0
    skipped = []
    for t in techs:
        key = 'ICON_' + t['id']
        if key not in icons:
            skipped.append((t['id'], 'no icon definition'))
            continue
        atlas_name, idx = icons[key]
        if atlas_name not in atlases:
            skipped.append((t['id'], f'unknown atlas {atlas_name}'))
            continue
        tile = crop_tile(atlases[atlas_name], idx, ATLAS_SIZE)
        out_path = os.path.join(OUTDIR, f"{t['id']}.png")
        if args.dry_run:
            print(f'  would write {out_path}  ({atlas_name} idx={idx})')
        else:
            tile.save(out_path, 'PNG', optimize=True)
        written += 1

    print(f'Wrote {written} icons to {OUTDIR}')
    if skipped:
        print(f'Skipped {len(skipped)}:')
        for tid, why in skipped:
            print(f'  {tid}: {why}')


if __name__ == '__main__':
    main()
