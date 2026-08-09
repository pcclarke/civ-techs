"""
Crop tech / civic / unlock icons out of the Civ 6 SDK atlas DDS files.

The SDK ships several sized atlases per icon family (Tech30/38/42/128/160,
Buildings32/38/50/80/128/256, etc.). For each kind we pick the smallest
atlas size at-or-above OUTPUT_SIZE — minimises both upscale blur and
downscale work — and resize to OUTPUT_SIZE so the wheel renders all icons
at a uniform pixel dimension. All source atlases are plain uncompressed
RGBA8; no BCn decode needed.

Game variants (which icon layers to load):
    --game base   -> civ6/img/{kind}/      (base atlases only)
    --game rf     -> civ6rf/img/{kind}/    (base + Rise & Fall atlases)
    --game gs     -> civ6gs/img/{kind}/    (base + RF + Gathering Storm)

Kinds (--kind):
    tech, civic, building, wonder, district, unit, improvement,
    project, policy, government

Layered loading: each layer contributes its own Icons_*.xml file (which
declares <IconTextureAtlases> + <IconDefinitions>) plus the matching DDS
files. A later layer's icon definitions override earlier ones on name
collision; in practice each atlas name is unique across base/XP1/XP2.

Quirk: base improvements live in the UnitActions atlas (Civ 6 originally
treated them as worker actions). The expansion improvements use dedicated
Improvements atlases. The script handles this by letting each layer point
at a different icons XML for the "improvement" kind.

Inputs (under ./data/, gitignored):
    Base icon defs:   data/Assets/Base/Assets/UI/Icons/Icons_*.xml
    Base textures:    data/sdk/Civ6/pantry/Textures/*.dds
    XP1 icon defs:    data/expansion1/Expansion1_Icons_*.xml
    XP1 textures:     data/sdk/Civ6/DLC/Expansion1/pantry/Textures/*.dds
    XP2 icon defs:    data/expansion2/Expansion2_Icons_*.xml
    XP2 textures:     data/sdk/Civ6/DLC/Expansion2/pantry/Textures/*.dds

Run from this directory:
    python3 atlas_to_png.py                                  # base techs
    python3 atlas_to_png.py --kind civic                     # base civics
    python3 atlas_to_png.py --game gs --kind building        # GS buildings
    python3 atlas_to_png.py --game gs --all-kinds            # GS everything
    python3 atlas_to_png.py --game gs --kind tech --dry-run  # plan only
"""

import argparse
import json
import os
import struct
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..'))
# Game data and icons live under public/ (see the site's vite.config.js).
PUBLIC = os.path.join(REPO, 'public')
DATA_DIR = os.path.join(HERE, 'data')

# All output PNGs are normalised to this size — picked to match the existing
# tech icons on disk and the wheel's icon ring sizing.
OUTPUT_SIZE = 128

# Per-layer paths. Each layer has an icons-XML directory (declarations of
# atlas filenames and per-icon name -> (atlas, index) mappings) and a list
# of texture directories (the actual DDS files). XP1 has its content
# atlases distributed inconsistently — most live under DLC/Shared/ (alongside
# textures shared between expansions) while a small subset lives directly
# under DLC/Expansion1/; the lookup tries each dir in order, first hit wins.
LAYERS: Dict[str, Dict] = {
    'base': {
        'icons_dir':     os.path.join(DATA_DIR, 'Assets', 'Base', 'Assets', 'UI', 'Icons'),
        'textures_dirs': [os.path.join(DATA_DIR, 'sdk', 'Civ6', 'pantry', 'Textures')],
        'icons_prefix':  '',  # files named Icons_<Kind>.xml
    },
    'xp1': {
        'icons_dir':     os.path.join(DATA_DIR, 'expansion1'),
        'textures_dirs': [
            os.path.join(DATA_DIR, 'sdk', 'Civ6', 'DLC', 'Shared',     'pantry', 'Textures'),
            os.path.join(DATA_DIR, 'sdk', 'Civ6', 'DLC', 'Expansion1', 'pantry', 'Textures'),
        ],
        'icons_prefix':  'Expansion1_',  # files named Expansion1_Icons_<Kind>.xml
    },
    'xp2': {
        'icons_dir':     os.path.join(DATA_DIR, 'expansion2'),
        'textures_dirs': [
            os.path.join(DATA_DIR, 'sdk', 'Civ6', 'DLC', 'Expansion2', 'pantry', 'Textures'),
            os.path.join(DATA_DIR, 'sdk', 'Civ6', 'DLC', 'Shared',     'pantry', 'Textures'),
        ],
        'icons_prefix':  'Expansion2_',
    },
}


def find_texture(layer_name: str, dds_basename: str) -> Optional[str]:
    """Walk the layer's texture dirs, return the first existing path for
    `dds_basename`, or None."""
    for d in LAYERS[layer_name]['textures_dirs']:
        path = os.path.join(d, dds_basename)
        if os.path.isfile(path):
            return path
    return None

# Per-kind metadata. The icons-XML basename is usually <Kind>.xml (with
# the layer prefix prepended), but base improvements live in UnitActions
# — `base_xml_basename` overrides for that one case.
KINDS: Dict[str, Dict] = {
    'tech': {
        'civdata_key':    'technologies',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_TECH_',
        'subdir':         'technologies',
        'xml_basename':   'Icons_Tech.xml',
    },
    'civic': {
        'civdata_key':    'civics',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_CIVIC_',
        'subdir':         'civics',
        'xml_basename':   'Icons_Civics.xml',
    },
    'building': {
        'civdata_key':    'buildings',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_BUILDING_',
        'subdir':         'buildings',
        'xml_basename':   'Icons_Buildings.xml',
        # Expansion buildings split district-buildings into a separate
        # icons XML; the two expansions even disagree on whether to
        # underscore the name.
        'extra_xml_basenames': {
            'xp1': ['Icons_District_Buildings.xml'],
            'xp2': ['Icons_DistrictBuildings.xml'],
        },
    },
    'wonder': {
        'civdata_key':    'wonders',
        'icon_prefix':    'ICON_',
        # Wonder ids start with BUILDING_ (Firaxis stores wonders as a
        # subset of buildings) — the icon name follows suit.
        'name_prefix':    'ICON_BUILDING_',
        'subdir':         'wonders',
        'xml_basename':   'Icons_Wonders.xml',
    },
    'district': {
        'civdata_key':    'districts',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_DISTRICT_',
        'subdir':         'districts',
        'xml_basename':   'Icons_Districts.xml',
    },
    'unit': {
        'civdata_key':    'units',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_UNIT_',
        # The default Units atlas (Units256.dds etc.) holds the in-game
        # combat-circle silhouettes — grayscale outlines meant to overlay
        # the green/red unit-flag chrome. They look wrong on a white
        # tooltip background. UnitPortraits256_*.dds carries the colour
        # portrait art (the bust shown in the unit info panel), which is
        # what we want here. Lookups use the _PORTRAIT name suffix.
        'name_suffix':    '_PORTRAIT',
        'subdir':         'units',
        'xml_basename':   'Icons_UnitPortraits.xml',
    },
    'improvement': {
        'civdata_key':    'improvements',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_IMPROVEMENT_',
        'subdir':         'improvements',
        # Base game keeps improvement icons inside the UnitActions atlas;
        # XP1 split them into its own Improvements file; XP2 then
        # backtracked and tucks some new improvements (Seastead, Wind
        # Farm, Geothermal, etc.) back into UnitActions while putting
        # others in its Improvements file. So XP2 needs to load both.
        'xml_basename':   'Icons_Improvements.xml',
        'base_xml_basename': 'Icons_UnitActions.xml',
        'extra_xml_basenames': {
            'xp2': ['Icons_UnitActions.xml'],
        },
    },
    'project': {
        'civdata_key':    'projects',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_PROJECT_',
        'subdir':         'projects',
        'xml_basename':   'Icons_Projects.xml',
    },
    'policy': {
        'civdata_key':    'policies',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_POLICY_',
        'subdir':         'policies',
        'xml_basename':   'Icons_Policies.xml',
    },
    'government': {
        'civdata_key':    'governments',
        'icon_prefix':    'ICON_',
        'name_prefix':    'ICON_GOVERNMENT_',
        'subdir':         'governments',
        'xml_basename':   'Icons_Governments.xml',
    },
}

# Per-game variant: which folders to read civdata from / write PNGs into,
# and which icon layers to load.
GAMES: Dict[str, Dict] = {
    'base': {
        'civdata_path': os.path.join(PUBLIC, 'civ6', 'civdata.json'),
        'outdir_base':  os.path.join(PUBLIC, 'civ6', 'img'),
        'icon_layers':  ['base'],
    },
    'rf': {
        'civdata_path': os.path.join(PUBLIC, 'civ6rf', 'civdata.json'),
        'outdir_base':  os.path.join(PUBLIC, 'civ6rf', 'img'),
        'icon_layers':  ['base', 'xp1'],
    },
    'gs': {
        'civdata_path': os.path.join(PUBLIC, 'civ6gs', 'civdata.json'),
        'outdir_base':  os.path.join(PUBLIC, 'civ6gs', 'img'),
        'icon_layers':  ['base', 'xp1', 'xp2'],
    },
}


# --------------------------- DDS loader ---------------------------

def load_rgba8_dds(path: str) -> Image.Image:
    """Load an uncompressed RGBA8 DDS into a PIL image.

    The Civ 6 SDK atlases are square or rectangular RGBA8 with a standard
    128-byte DDS header (DDPF_RGB | DDPF_ALPHAPIXELS, 32 bpp, masks B/G/R/A
    in the SDK's standard layout). Everything before the pixel payload is
    skipped.
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


# --------------------------- Icons-XML parsing ---------------------------

def _icons_xml_paths(layer_name: str, kind_cfg: Dict) -> List[str]:
    """Resolve every icons XML for one (layer, kind) pair. Returns a list
    because some kinds split their icon definitions across multiple files
    in a layer — buildings get District_Buildings on XP1 / DistrictBuildings
    on XP2, in addition to the main Icons_Buildings.xml.

    Honours the base-improvements quirk where the base layer's improvements
    are tucked inside the UnitActions atlas, not a dedicated file.
    """
    layer = LAYERS[layer_name]
    prefix = layer['icons_prefix']
    if layer_name == 'base' and 'base_xml_basename' in kind_cfg:
        primary = kind_cfg['base_xml_basename']
    else:
        primary = prefix + kind_cfg['xml_basename']
    paths = [os.path.join(layer['icons_dir'], primary)]

    extras = kind_cfg.get('extra_xml_basenames', {}).get(layer_name, [])
    for basename in extras:
        paths.append(os.path.join(layer['icons_dir'], prefix + basename))
    return paths


def parse_icons_xml(path: str) -> Tuple[
    Dict[str, List[Tuple[int, str]]],
    Dict[str, Tuple[str, int]],
    Dict[str, str],
]:
    """Read one Icons_*.xml.

    Returns:
        atlases:   {atlas_name: [(icon_size, dds_basename), ...]}  — the
                   IconTextureAtlases declarations. Multiple sizes per
                   atlas are common; pick one at fetch time.
        icon_defs: {icon_name: (atlas_name, index)}  — direct per-icon
                   definitions. _FOW (fog of war) variants are dropped.
        aliases:   {icon_name: other_icon_name}  — entries shaped like
                   `<Row Name="X" OtherName="Y"/>`. Firaxis uses this to
                   say "icon X reuses the art of icon Y" — extensively
                   on expansion policies that share one of the four
                   generic policy-slot frames, and on civ-unique
                   districts that mirror a base district's icon. Caller
                   is responsible for resolving these against the merged
                   icon_defs.
    """
    atlases: Dict[str, List[Tuple[int, str]]] = {}
    icon_defs: Dict[str, Tuple[str, int]] = {}
    aliases: Dict[str, str] = {}
    try:
        root = ET.parse(path).getroot()
    except FileNotFoundError:
        return atlases, icon_defs, aliases

    at_table = root.find('IconTextureAtlases')
    if at_table is not None:
        for row in at_table.findall('Row'):
            name = row.get('Name')
            size = row.get('IconSize')
            fn = row.get('Filename')
            if not name or not size or not fn:
                continue
            if name.endswith('_FOW'):
                continue
            # The Wonders icons XML omits the .dds suffix on filenames;
            # pad it on so the textures dir lookup works.
            if not fn.lower().endswith('.dds'):
                fn = fn + '.dds'
            atlases.setdefault(name, []).append((int(size), fn))

    # Direct definitions live in <IconDefinitions>; explicit aliases
    # live in a sibling <IconAliases> section (split out so the game can
    # process them in two passes). Both shapes can also appear in the
    # other section in practice, so walk both and dispatch by which
    # attributes the row carries.
    for container_tag in ('IconDefinitions', 'IconAliases'):
        container = root.find(container_tag)
        if container is None:
            continue
        for row in container.findall('Row'):
            name = row.get('Name', '')
            if not name or name.endswith('_FOW'):
                continue
            atlas = row.get('Atlas')
            idx = row.get('Index')
            other = row.get('OtherName')
            if atlas and idx is not None:
                icon_defs[name] = (atlas, int(idx))
            elif other:
                aliases[name] = other

    return atlases, icon_defs, aliases


def resolve_aliases(icon_defs: Dict[str, Tuple[str, int]],
                    aliases: Dict[str, str]) -> None:
    """Mutate `icon_defs` in place to add resolved alias entries.

    Walks each alias to its eventual target through the chain (an alias
    may point at another alias). Cycles and dangling targets are silently
    skipped — those icons just don't get resolved and the caller treats
    them as missing.
    """
    for name, target in aliases.items():
        if name in icon_defs:
            continue
        # Walk the chain with a small cycle guard.
        seen = {name}
        cur = target
        while cur not in icon_defs and cur in aliases and cur not in seen:
            seen.add(cur)
            cur = aliases[cur]
        if cur in icon_defs:
            icon_defs[name] = icon_defs[cur]


def best_atlas_choice(sizes: List[Tuple[int, str]], target: int) -> Optional[Tuple[int, str]]:
    """Pick the largest atlas available — always downscale from the master
    texture rather than picking the smallest size at-or-above target.

    Originally this preferred the smallest size at-or-above target on the
    theory that it minimised both upscale blur and downscale work. That
    backfired because Firaxis ships at least one atlas with a buggy
    downsized mipmap: XP1_Wonders128.dds is missing the Casa de
    Contratación tile (index 7 is fully transparent), while
    XP1_Wonders256.dds has it. Sourcing from the largest available size
    avoids the whole class of mipmap-export bugs and the Lanczos
    downscale cost is negligible.

    `target` is unused now but kept in the signature so the caller side
    is unchanged — future logic might want it again for very-small-only
    atlases (Governments tops out at 32, etc.).
    """
    if not sizes:
        return None
    return max(sizes, key=lambda s: s[0])


# --------------------------- Layer collation ---------------------------

def gather_layers(layers_to_use: List[str], kind_cfg: Dict) -> Tuple[
    Dict[str, Tuple[str, int]],         # icon_defs: ICON_<NAME> -> (atlas, index)
    Dict[str, Tuple[int, str, str]],    # atlas_choice: atlas_name -> (chosen_size, dds_path, layer_name)
]:
    """Walk requested layers, building (a) a merged ICON_NAME -> (atlas, index)
    map and (b) per-atlas best-size + on-disk DDS path. Later layers override
    earlier ones on icon-name collision.
    """
    icon_defs: Dict[str, Tuple[str, int]] = {}
    # atlas_name -> (size, dds_path, originating_layer_name) so we can
    # re-resolve later if a higher layer redeclared the same atlas with
    # different sizes. The dds_path resolves to whichever textures dir in
    # the layer's list actually has the file (Shared vs Expansion-specific).
    atlas_choice: Dict[str, Tuple[int, str, str]] = {}

    # Aliases are collected across every layer and resolved at the end —
    # an alias in XP1 may target a direct def in base, so we can't resolve
    # until all layers have been merged.
    all_aliases: Dict[str, str] = {}

    for layer_name in layers_to_use:
        # Each layer may declare its icons across several XML files; merge
        # them before resolving atlas paths so a single atlas declared in
        # the primary file can be used by icons in an extras file too.
        atlases: Dict[str, List[Tuple[int, str]]] = {}
        defs: Dict[str, Tuple[str, int]] = {}
        layer_aliases: Dict[str, str] = {}
        for xml_path in _icons_xml_paths(layer_name, kind_cfg):
            a, d, ali = parse_icons_xml(xml_path)
            atlases.update(a)
            defs.update(d)
            layer_aliases.update(ali)
        if not atlases and not defs and not layer_aliases:
            continue
        all_aliases.update(layer_aliases)

        for atlas_name, sizes in atlases.items():
            # Prefer atlas sizes whose DDS actually exists on disk. The
            # XML may declare a size we don't have a file for (the SDK
            # extract is often partial); skipping those at this stage
            # lets us fall back to the next-best size instead of crashing
            # later. Walk sizes largest-first; best_atlas_choice will
            # pick from what's left.
            available: List[Tuple[int, str, str]] = []
            for size, dds_basename in sizes:
                path = find_texture(layer_name, dds_basename)
                if path:
                    available.append((size, dds_basename, path))
            if not available:
                continue
            best = best_atlas_choice(
                [(s, b) for s, b, _ in available], OUTPUT_SIZE,
            )
            size, dds_basename = best
            # Find the matching resolved path
            dds_path = next(p for s, b, p in available if s == size and b == dds_basename)
            atlas_choice[atlas_name] = (size, dds_path, layer_name)

        # icon_defs are simple last-wins
        icon_defs.update(defs)

    # Now that every layer has contributed direct defs, resolve aliases
    # against the merged map. A late layer's alias may target an early
    # layer's direct def (e.g. an XP1 policy aliases ICON_POLICY_MILITARY
    # defined in base).
    resolve_aliases(icon_defs, all_aliases)

    return icon_defs, atlas_choice


def crop_tile(atlas: Image.Image, index: int, tile_size: int) -> Image.Image:
    """Crop the (row, col) tile for atlas index, where idx = row*cols + col."""
    cols = atlas.width // tile_size
    if cols == 0:
        raise ValueError(f'atlas width {atlas.width} < tile_size {tile_size}')
    row, col = divmod(index, cols)
    box = (col * tile_size, row * tile_size, (col + 1) * tile_size, (row + 1) * tile_size)
    return atlas.crop(box)


# --------------------------- Driver ---------------------------

def run_kind(game_cfg: Dict, kind_cfg: Dict, kind_name: str, *,
             force: bool, dry_run: bool) -> None:
    """Crop one (kind) for one (game variant)."""
    civdata = json.load(open(game_cfg['civdata_path']))
    items = civdata.get(kind_cfg['civdata_key'], [])
    if not items:
        print(f'[{kind_name}] civdata has no {kind_cfg["civdata_key"]} — nothing to do')
        return

    icon_defs, atlas_choice = gather_layers(game_cfg['icon_layers'], kind_cfg)
    outdir = os.path.join(game_cfg['outdir_base'], kind_cfg['subdir'])
    if not dry_run:
        os.makedirs(outdir, exist_ok=True)

    # Cache loaded DDS images so we only decode each atlas once per run.
    atlas_images: Dict[str, Image.Image] = {}

    name_suffix = kind_cfg.get('name_suffix', '')

    written = 0
    skipped: List[Tuple[str, str]] = []
    for it in items:
        item_id = it['id']
        # `_PORTRAIT` suffix on units because Icons_UnitPortraits.xml keys
        # entries as ICON_UNIT_<NAME>_PORTRAIT. Other kinds leave it empty.
        key = kind_cfg['icon_prefix'] + item_id + name_suffix
        if key not in icon_defs:
            skipped.append((item_id, 'no icon definition'))
            continue
        atlas_name, idx = icon_defs[key]
        choice = atlas_choice.get(atlas_name)
        if not choice:
            skipped.append((item_id, f'unknown atlas {atlas_name}'))
            continue
        size, dds_path, _layer = choice

        out_path = os.path.join(outdir, f'{item_id}.png')
        if os.path.exists(out_path) and not force:
            continue

        if dry_run:
            print(f'  would crop {os.path.relpath(dds_path, DATA_DIR)} idx={idx} size={size}'
                  f' -> {os.path.relpath(out_path, REPO)}')
            written += 1
            continue

        if atlas_name not in atlas_images:
            try:
                atlas_images[atlas_name] = load_rgba8_dds(dds_path)
            except FileNotFoundError:
                skipped.append((item_id, f'missing atlas file {dds_path}'))
                continue

        tile = crop_tile(atlas_images[atlas_name], idx, size)
        if tile.size != (OUTPUT_SIZE, OUTPUT_SIZE):
            tile = tile.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)
        tile.save(out_path, 'PNG', optimize=True)
        written += 1

    where = os.path.relpath(outdir, REPO)
    print(f'[{kind_name:12s}] wrote {written:3d} / {len(items):3d} icons to {where}')
    if skipped:
        print(f'             skipped {len(skipped)}:')
        for item_id, why in skipped[:8]:
            print(f'               {item_id}: {why}')
        if len(skipped) > 8:
            print(f'               ... and {len(skipped) - 8} more')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-g', '--game', choices=list(GAMES), default='base',
                    help='which game variant to extract for (default: base)')
    ap.add_argument('--kind', choices=list(KINDS), default='tech',
                    help='which icon family to extract (default: tech)')
    ap.add_argument('--all-kinds', action='store_true',
                    help='extract every kind for the chosen game')
    ap.add_argument('--force', action='store_true',
                    help='re-crop icons that already exist on disk')
    ap.add_argument('--dry-run', action='store_true',
                    help='print plan without writing files')
    args = ap.parse_args()

    game_cfg = GAMES[args.game]
    kind_names = list(KINDS) if args.all_kinds else [args.kind]
    for kn in kind_names:
        run_kind(game_cfg, KINDS[kn], kn, force=args.force, dry_run=args.dry_run)


if __name__ == '__main__':
    main()
