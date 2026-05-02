"""
Crop tech / civic icons out of the Civ 6 SDK atlas DDS files.

The SDK ships several sized atlases per icon family (Tech30/38/42/128/160,
Civics38/42/160). We use the 128px Tech atlas and the 160px Civics atlas
(no Civics128 ships in base) and downscale civics to 128 so the output PNGs
are uniform across families. All source atlases are plain uncompressed
RGBA8 — no BCn decode needed.

Game variants — pick which civdata.json to read and where to write PNGs:
    --game base   -> civ6/civdata.json    -> civ6/img/{technologies,civics}/
    --game gs     -> civ6gs/civdata.json  -> civ6gs/img/{technologies,civics}/

GS uses base Icon Definitions plus expansion2's Expansion2_Icons_*.xml,
which point at separate XP2_*.dds atlases the expansion ships under
sdk/Civ6/DLC/Expansion2. Layering the icon-definition tables means a base
icon resolves to a base atlas and an XP2-only icon resolves to an XP2
atlas — the script doesn't have to know which is which up front.

Inputs (under ./data/, gitignored):
    Base icon defs:   data/Assets/Base/Assets/UI/Icons/Icons_{Tech,Civics}.xml
    Base textures:    data/sdk/Civ6/pantry/Textures/{Tech128,Tech128_2,Civics160}.dds
    Expansion 2 icon defs: data/expansion2/Expansion2_Icons_{Tech,Civics}.xml
    Expansion 2 textures:  data/sdk/Civ6/DLC/Expansion2/pantry/Textures/{XP2_Tech128,XP2_Civics128}.dds

Run from this directory:
    python3 atlas_to_png.py                            # base techs
    python3 atlas_to_png.py --kind civic               # base civics
    python3 atlas_to_png.py --game gs                  # GS techs
    python3 atlas_to_png.py --game gs --kind civic     # GS civics
"""

import argparse
import json
import os
import struct
import xml.etree.ElementTree as ET
from typing import Dict, List, Tuple

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
DATA_DIR = os.path.join(HERE, 'data')

BASE_ICONS_DIR = os.path.join(DATA_DIR, 'Assets', 'Base', 'Assets', 'UI', 'Icons')
BASE_TEXTURES = os.path.join(DATA_DIR, 'sdk', 'Civ6', 'pantry', 'Textures')
XP2_ICONS_DIR = os.path.join(DATA_DIR, 'expansion2')
XP2_TEXTURES = os.path.join(DATA_DIR, 'sdk', 'Civ6', 'DLC', 'Expansion2', 'pantry', 'Textures')

# All output PNGs are normalised to this size. Civics160 is the only base
# atlas that ships at a different size — it gets downscaled to match.
OUTPUT_SIZE = 128

# Per-kind config. `layers` is a list of (icons_xml_path, atlas_files) tuples
# where atlas_files maps the Atlas name in the XML to the on-disk DDS path.
# Layers are applied in order — later layers overwrite earlier on icon-name
# collision (matches Firaxis's XP-overrides-base pattern), though in practice
# each Atlas name is unique across base and expansions.
KINDS = {
    'tech': {
        'civdata_key': 'technologies',
        'icon_prefix': 'ICON_',
        'name_prefix': 'ICON_TECH_',
        'atlas_size_per_atlas': {
            'ICON_ATLAS_TECH':              128,
            'ICON_ATLAS_TECH_2':            128,
            'ICON_ATLAS_EXPANSION_2_TECH':  128,
        },
        'base_layer': {
            'icons_xml': os.path.join(BASE_ICONS_DIR, 'Icons_Tech.xml'),
            'atlas_files': {
                'ICON_ATLAS_TECH':   os.path.join(BASE_TEXTURES, 'Tech128.dds'),
                'ICON_ATLAS_TECH_2': os.path.join(BASE_TEXTURES, 'Tech128_2.dds'),
            },
        },
        'gs_layer': {
            'icons_xml': os.path.join(XP2_ICONS_DIR, 'Expansion2_Icons_Tech.xml'),
            'atlas_files': {
                'ICON_ATLAS_EXPANSION_2_TECH': os.path.join(XP2_TEXTURES, 'XP2_Tech128.dds'),
            },
        },
        'subdir': 'technologies',
    },
    'civic': {
        'civdata_key': 'civics',
        'icon_prefix': 'ICON_',
        'name_prefix': 'ICON_CIVIC_',
        'atlas_size_per_atlas': {
            'ICON_ATLAS_CIVICS':              160,
            'ICON_ATLAS_EXPANSION_2_CIVICS':  128,
        },
        'base_layer': {
            'icons_xml': os.path.join(BASE_ICONS_DIR, 'Icons_Civics.xml'),
            'atlas_files': {
                'ICON_ATLAS_CIVICS': os.path.join(BASE_TEXTURES, 'Civics160.dds'),
            },
        },
        'gs_layer': {
            'icons_xml': os.path.join(XP2_ICONS_DIR, 'Expansion2_Icons_Civics.xml'),
            'atlas_files': {
                'ICON_ATLAS_EXPANSION_2_CIVICS': os.path.join(XP2_TEXTURES, 'XP2_Civics128.dds'),
            },
        },
        'subdir': 'civics',
    },
}

# Per-game variant: which folders to read civdata from / write PNGs into,
# and which icon layers to load. RF doesn't add tech/civic icons, so it
# doesn't have its own variant — copy from base if you need it.
GAMES = {
    'base': {
        'civdata_path':  os.path.join(REPO, 'civ6', 'civdata.json'),
        'outdir_base':   os.path.join(REPO, 'civ6', 'img'),
        'icon_layers':   ['base_layer'],
    },
    'gs': {
        'civdata_path':  os.path.join(REPO, 'civ6gs', 'civdata.json'),
        'outdir_base':   os.path.join(REPO, 'civ6gs', 'img'),
        'icon_layers':   ['base_layer', 'gs_layer'],
    },
}


def load_rgba8_dds(path: str) -> Image.Image:
    """Load a DDS that's plain uncompressed BGRA8 / RGBA8 into a PIL image.

    The Civ 6 SDK atlases are square RGBA8 with a standard 128-byte DDS
    header (DDPF_RGB | DDPF_ALPHAPIXELS, 32 bpp, masks B/G/R/A). Everything
    before the pixel data is skipped.
    """
    with open(path, 'rb') as f:
        magic = f.read(4)
        if magic != b'DDS ':
            raise ValueError(f'{path}: not a DDS file ({magic!r})')
        header = f.read(124)
        height = struct.unpack_from('<I', header, 8)[0]
        width = struct.unpack_from('<I', header, 12)[0]
        bpp = struct.unpack_from('<I', header, 0x54)[0]
        rmask, gmask, bmask, amask = struct.unpack_from('<IIII', header, 0x58)
        if bpp != 32:
            raise ValueError(f'{path}: expected 32 bpp, got {bpp}')
        # Standard SDK encoding: R in low byte, A in high byte → PIL "RGBA".
        expected = (0x000000FF, 0x0000FF00, 0x00FF0000, 0xFF000000)
        if (rmask, gmask, bmask, amask) != expected:
            raise ValueError(
                f'{path}: unexpected channel masks '
                f'R=0x{rmask:08x} G=0x{gmask:08x} B=0x{bmask:08x} A=0x{amask:08x}'
            )
        pixels = f.read(width * height * 4)
    return Image.frombytes('RGBA', (width, height), pixels, 'raw', 'RGBA')


def load_icon_map(icons_xml_path: str, name_prefix: str) -> Dict[str, Tuple[str, int]]:
    """Return ICON_<NAME> → (atlas_name, index), filtering out _FOW variants."""
    root = ET.parse(icons_xml_path).getroot()
    defs = root.find('IconDefinitions')
    out: Dict[str, Tuple[str, int]] = {}
    if defs is None:
        return out
    for row in defs.findall('Row'):
        name = row.get('Name', '')
        if not name.startswith(name_prefix):
            continue
        if name.endswith('_FOW'):
            continue
        out[name] = (row.get('Atlas'), int(row.get('Index')))
    return out


def crop_tile(atlas: Image.Image, index: int, size: int) -> Image.Image:
    """Crop the (row, col) tile for atlas index, where idx = row*cols + col."""
    cols = atlas.width // size
    row, col = divmod(index, cols)
    box = (col * size, row * size, (col + 1) * size, (row + 1) * size)
    return atlas.crop(box)


def gather_layers(cfg: dict, layer_keys: List[str]) -> Tuple[Dict[str, Tuple[str, int]], Dict[str, Image.Image]]:
    """Walk the requested layers, returning a merged icon-definition map and
    a merged atlas-image map. Later layers win on any name collision."""
    icons: Dict[str, Tuple[str, int]] = {}
    atlases: Dict[str, Image.Image] = {}
    for key in layer_keys:
        layer = cfg[key]
        icons.update(load_icon_map(layer['icons_xml'], cfg['name_prefix']))
        for atlas_name, dds_path in layer['atlas_files'].items():
            atlases[atlas_name] = load_rgba8_dds(dds_path)
    return icons, atlases


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-g', '--game', choices=list(GAMES), default='base',
                    help='which game variant to extract for (default: base)')
    ap.add_argument('--kind', choices=list(KINDS), default='tech',
                    help='which icon family to extract (default: tech)')
    ap.add_argument('--dry-run', action='store_true',
                    help='print what would be written without creating files')
    args = ap.parse_args()

    cfg = KINDS[args.kind]
    game = GAMES[args.game]

    icons, atlases = gather_layers(cfg, game['icon_layers'])
    items = json.load(open(game['civdata_path']))[cfg['civdata_key']]
    outdir = os.path.join(game['outdir_base'], cfg['subdir'])

    if not args.dry_run:
        os.makedirs(outdir, exist_ok=True)

    written = 0
    skipped = []
    for it in items:
        key = cfg['icon_prefix'] + it['id']
        if key not in icons:
            skipped.append((it['id'], 'no icon definition'))
            continue
        atlas_name, idx = icons[key]
        if atlas_name not in atlases:
            skipped.append((it['id'], f'unknown atlas {atlas_name}'))
            continue
        atlas_size = cfg['atlas_size_per_atlas'].get(atlas_name)
        if atlas_size is None:
            skipped.append((it['id'], f'unknown atlas size for {atlas_name}'))
            continue
        tile = crop_tile(atlases[atlas_name], idx, atlas_size)
        if tile.size != (OUTPUT_SIZE, OUTPUT_SIZE):
            tile = tile.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)
        out_path = os.path.join(outdir, f"{it['id']}.png")
        if args.dry_run:
            print(f'  would write {out_path}  ({atlas_name} idx={idx})')
        else:
            tile.save(out_path, 'PNG', optimize=True)
        written += 1

    print(f'Wrote {written} {args.kind} icons to {outdir}')
    if skipped:
        print(f'Skipped {len(skipped)}:')
        for tid, why in skipped:
            print(f'  {tid}: {why}')


if __name__ == '__main__':
    main()
