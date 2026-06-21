"""
Civilization 5 data scraper.

Reads Firaxis XML from data_scrapers/civ5/{base,gnk,bnw}/XML/ and emits
civdata.json in the shape consumed by src/initWheelData.js:

    {
      "technologies": [ { "id", "name", "cost", "era", "requires"? }, ... ],
      "promotions":   [ { "id", "name", "requires" }, ... ],
      "projects":     [ { "id", "requires" }, ... ],
      "build":        [ { "id", "name", "requires" }, ... ],
      "buildings":    [ { "id", "requires", "CIVILIZATION_*": {id, name} }, ... ],
      "resources":    [ { "id", "name", "requires" }, ... ],
      "units":        [ { "id", "requires", "CIVILIZATION_*": {id, name} }, ... ],
      "civilizations":[ { "id", "name" }, ... ]
    }

Game variants:
    --game base  -> civ5/civdata.json     (vanilla)
    --game gnk   -> civ5gnk/civdata.json  (Gods & Kings)
    --game bnw   -> civ5bnw/civdata.json  (Brave New World)
    --all                                 (all three)

Each variant layers its own XML on top of the previous (BNW reads base +
Inherited_Expansion2 overrides + Expansion2 additions; GnK reads base +
Expansion overrides). The package layout under data_scrapers/civ5/ tracks
the shape Firaxis ships in the SDK.

Layout of one package, e.g. base/:
    base/XML/Buildings/        CIV5Buildings.xml, CIV5BuildingClasses.xml, ...
    base/XML/Civilizations/    CIV5Civilizations.xml
    base/XML/GameInfo/         CIV5Projects.xml
    base/XML/Technologies/     CIV5Technologies.xml
    base/XML/Terrain/          CIV5Resources.xml
    base/XML/Units/            CIV5Units.xml, CIV5UnitClasses.xml, CIV5UnitPromotions.xml, CIV5Builds.xml
    base/XML/NewText/EN_US/    CIV5GameTextInfos_*.xml      (note capitalisation; gnk/bnw use Text/en_US/)

Run from this directory:
    python3 scraper.py --game base
    python3 scraper.py --game gnk
    python3 scraper.py --game bnw
    python3 scraper.py --all
"""

import argparse
import json
import os
import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

# Per-variant config:
#   text_dir: relative path under <package>/XML/ that holds the LOC files
#             (capitalisation differs between base and the expansions)
#   out_rel:  output JSON path relative to repo root
PACKAGES = {
    'base': {
        'text_dir': 'NewText/EN_US',
        'out_rel':  'civ5/civdata.json',
    },
    'gnk': {
        'text_dir': 'Text/en_US',
        'out_rel':  'civ5gnk/civdata.json',
    },
    'bnw': {
        'text_dir': 'Text/en_US',
        'out_rel':  'civ5bnw/civdata.json',
    },
}

DATA_KEYS = [
    'technologies', 'promotions', 'projects', 'build',
    'buildings', 'resources', 'units', 'civilizations',
]


# --------------------------- XML helpers ---------------------------

def get_root(pkg: str, subdir: str, filename: str) -> Optional[ET.Element]:
    """Return the root element of <pkg>/XML/<subdir>/<filename>.xml, or None."""
    path = os.path.join(HERE, pkg, 'XML', subdir, f'{filename}.xml')
    try:
        return ET.parse(path).getroot()
    except FileNotFoundError:
        print(f'  missing: {os.path.relpath(path, HERE)}')
        return None
    except ET.ParseError as e:
        raise RuntimeError(f'parse error in {path}: {e}') from e


def map_text(pkg: str, text_dir: str, filename: str) -> Dict[str, str]:
    """Return {LOC tag -> English string} from <pkg>/XML/<text_dir>/<filename>.xml.

    Civ 5 text XML is shaped like:
        <GameData>
          <Language_en_US>
            <Row Tag="TXT_KEY_TECH_AGRICULTURE"><Text>Agriculture</Text></Row>
            ...
    """
    path = os.path.join(HERE, pkg, 'XML', text_dir, f'{filename}.xml')
    out: Dict[str, str] = {}
    try:
        root = ET.parse(path).getroot()
    except FileNotFoundError:
        return out
    container = root.find('Language_en_US')
    if container is None:
        return out
    for row in container:
        tag = row.get('Tag')
        text_el = row.find('Text')
        if tag and text_el is not None and text_el.text is not None:
            out[tag] = text_el.text
    return out


def lookup(text_maps: List[Dict[str, str]], key: Optional[str]) -> Optional[str]:
    """Search a list of text maps in order for `key` and return the first
    English string found. Returns None when no map has the key — callers
    decide whether that's an error or a soft-skip."""
    if not key:
        return None
    for m in text_maps:
        if key in m:
            return m[key]
    return None


# --------------------------- Per-table extractors ---------------------------

def prep_technologies(pkg: str, text_maps: List[Dict[str, str]]) -> List[dict]:
    """Tech tree itself: id, cost, era, name, requires."""
    root = get_root(pkg, 'Technologies', 'CIV5Technologies')
    if root is None:
        return []

    techs: Dict[str, dict] = {}
    for tech in root.find('Technologies'):
        tid = tech.find('Type').text
        techs[tid] = {
            'id':    tid,
            'cost':  int(tech.find('Cost').text),
            'era':   tech.find('Era').text,
            'name':  lookup(text_maps, tech.find('Description').text) or tid,
        }

    # Prereqs come from a sibling table that lists (TechType, PrereqTech) edges.
    pre = root.find('Technology_PrereqTechs')
    if pre is not None:
        for row in pre:
            tid = row.find('TechType').text
            parent = row.find('PrereqTech').text
            if tid in techs:
                techs[tid].setdefault('requires', []).append(parent)

    return list(techs.values())


def prep_promotions(pkg: str, text_maps: List[Dict[str, str]]) -> List[dict]:
    """Unit promotions that gate on a tech. The Description is a LOC tag —
    resolve it through the unit text maps before storing.

    The previous version of this function copied the LOC tag directly into
    `name`, which left strings like TXT_KEY_PROMOTION_AMBUSH_1 visible in
    the tooltip. Resolving here closes that bug.
    """
    root = get_root(pkg, 'Units', 'CIV5UnitPromotions')
    if root is None:
        return []

    out: List[dict] = []
    for promo in root.find('UnitPromotions'):
        prereq = promo.find('TechPrereq')
        if prereq is None:
            continue
        pid = promo.find('Type').text
        desc_key = promo.find('Description').text
        out.append({
            'id':       pid,
            'requires': [prereq.text],
            'name':     lookup(text_maps, desc_key) or pid,
        })
    return out


def prep_projects(pkg: str) -> List[dict]:
    """Wonders / national projects that gate on a tech. Names live elsewhere
    in the data files and aren't worth threading text maps through for —
    the wheel's tooltip uses the id as the name when no name is set."""
    root = get_root(pkg, 'GameInfo', 'CIV5Projects')
    if root is None:
        return []
    out: List[dict] = []
    for proj in root.find('Projects'):
        prereq = proj.find('TechPrereq')
        if prereq is not None:
            out.append({
                'id':       proj.find('Type').text,
                'requires': [prereq.text],
            })
    return out


def prep_improvements(root: Optional[ET.Element], text_maps: List[Dict[str, str]]) -> List[dict]:
    """Worker builds (Build a Road, Chop Forest, etc.). The Description text
    has bracketed tokens like '[ICON_BUILD_FARM] Farm' — strip them so the
    tooltip shows just the human-readable name."""
    if root is None:
        return []
    out: List[dict] = []
    for build in root.find('Builds'):
        prereq = build.find('PrereqTech')
        if prereq is None:
            continue
        # Skip the dummy entry the AI uses internally.
        bid = build.find('Type').text
        if bid == 'BUILD_FISHING_BOATS_NO_KILL':
            continue
        desc_key = build.find('Description').text
        name = lookup(text_maps, desc_key) or bid
        # Strip [ICON_*] markup that Firaxis embeds in some build labels.
        name = re.sub(r'\[[^\]]*\]', '', name).strip()
        out.append({
            'id':       bid,
            'requires': [prereq.text],
            'name':     name,
        })
    return out


def prep_buildings(building_files: List[Optional[ET.Element]],
                   class_files: List[Optional[ET.Element]],
                   civ_files: List[Optional[ET.Element]],
                   text_maps: List[Dict[str, str]]) -> List[dict]:
    """City improvements + wonders, keyed by BuildingClass so per-civ
    uniques attach to the same node. Each class ends up with a CIVILIZATION_ALL
    entry plus optional CIVILIZATION_<CIV> entries for uniques.
    """
    classes: Dict[str, dict] = {}
    for cf in class_files:
        if cf is None:
            continue
        for bc in cf.find('BuildingClasses'):
            if bc.tag == 'Delete':
                continue
            ctype = bc.find('Type').text
            classes[ctype] = {'id': ctype}

    overrides: Dict[str, str] = {}
    for civf in civ_files:
        if civf is None:
            continue
        node = civf.find('Civilization_BuildingClassOverrides')
        if node is None:
            continue
        for ov in node:
            bt = ov.find('BuildingType')
            ct = ov.find('CivilizationType')
            if bt is not None and ct is not None and bt.text and ct.text:
                overrides[bt.text] = ct.text

    for bf in building_files:
        if bf is None:
            continue
        for b in bf.find('Buildings'):
            bclass_el = b.find('BuildingClass')
            if bclass_el is None:
                continue
            bclass = bclass_el.text
            if bclass not in classes:
                continue
            prereq = b.find('PrereqTech')
            if prereq is not None:
                requires = classes[bclass].setdefault('requires', [])
                if prereq.text not in requires:
                    requires.append(prereq.text)
            btype = b.find('Type').text
            desc_key = b.find('Description').text
            entry = {
                'id':   btype,
                'name': lookup(text_maps, desc_key) or btype,
            }
            civ_key = overrides.get(btype, 'CIVILIZATION_ALL')
            classes[bclass][civ_key] = entry

    return list(classes.values())


def prep_resources(pkg: str, text_maps: List[Dict[str, str]]) -> List[dict]:
    """Bonuses/strategics/luxuries that get revealed by a tech."""
    root = get_root(pkg, 'Terrain', 'CIV5Resources')
    if root is None:
        return []
    out: List[dict] = []
    for r in root.find('Resources'):
        reveal = r.find('TechReveal')
        if reveal is None:
            continue
        out.append({
            'id':       r.find('Type').text,
            'requires': [reveal.text],
            'name':     lookup(text_maps, r.find('Description').text) or r.find('Type').text,
        })
    return out


def prep_units(unit_files: List[Optional[ET.Element]],
               class_files: List[Optional[ET.Element]],
               civ_files: List[Optional[ET.Element]],
               text_maps: List[Dict[str, str]]) -> List[dict]:
    """Units, keyed by UnitClass with per-civ uniques attached the same way
    buildings are."""
    classes: Dict[str, dict] = {}
    for cf in class_files:
        if cf is None:
            continue
        for uc in cf.find('UnitClasses'):
            ctype = uc.find('Type').text
            classes[ctype] = {'id': ctype}

    overrides: Dict[str, str] = {}
    for civf in civ_files:
        if civf is None:
            continue
        node = civf.find('Civilization_UnitClassOverrides')
        if node is None:
            continue
        for ov in node:
            ut = ov.find('UnitType')
            ct = ov.find('CivilizationType')
            if ut is None or ct is None:
                continue
            if ct.text in ('CIVILIZATION_BARBARIAN', 'CIVILIZATION_MINOR'):
                continue
            overrides[ut.text] = ct.text

    for uf in unit_files:
        if uf is None:
            continue
        for u in uf.find('Units'):
            type_el = u.find('Type')
            if type_el is None or type_el.text is None or 'UNIT_BARBARIAN' in type_el.text:
                continue
            uclass = u.find('Class').text
            if uclass not in classes:
                continue
            prereq = u.find('PrereqTech')
            if prereq is not None:
                requires = classes[uclass].setdefault('requires', [])
                if prereq.text not in requires:
                    requires.append(prereq.text)
            utype = type_el.text
            desc_key = u.find('Description').text
            entry = {
                'id':   utype,
                'name': lookup(text_maps, desc_key) or utype,
            }
            civ_key = overrides.get(utype, 'CIVILIZATION_ALL')
            classes[uclass][civ_key] = entry

    return list(classes.values())


def prep_civilizations(civ_files: List[Optional[ET.Element]],
                       text_maps: List[Dict[str, str]]) -> List[dict]:
    """Real civilizations only — exclude barbarians and city-states."""
    out: List[dict] = []
    seen = set()
    for cf in civ_files:
        if cf is None:
            continue
        for civ in cf.find('Civilizations'):
            ctype = civ.find('Type').text
            if ctype in ('CIVILIZATION_BARBARIAN', 'CIVILIZATION_MINOR'):
                continue
            if ctype in seen:
                continue
            seen.add(ctype)
            desc_el = civ.find('Description')
            if desc_el is None or desc_el.text is None:
                continue
            out.append({
                'id':   ctype,
                'name': lookup(text_maps, desc_el.text) or ctype,
            })
    return out


# --------------------------- Driver ---------------------------

def build_civdata(game: str) -> dict:
    if game not in PACKAGES:
        raise ValueError(f'unknown --game {game!r}; expected {list(PACKAGES)}')

    # Load every text file we know about. Layered later-wins lookup means a
    # rename in an expansion overrides the base entry. Promotions / units
    # share the unit_text family; tech names live in tech_text; buildings/civs
    # have their own families. `objects` carries miscellany.
    base_td = PACKAGES['base']['text_dir']
    gnk_td = PACKAGES['gnk']['text_dir']
    bnw_td = PACKAGES['bnw']['text_dir']

    building_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Buildings')
    building_text_gnk  = map_text('gnk',  gnk_td,  'CIV5GameTextInfos_Buildings_Expansion')
    building_text_inh  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Buildings_Inherited_Expansion2')
    building_text_bnw  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Buildings_Expansion2')

    civilizations_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Civilizations')
    civilizations_text_gnk  = map_text('gnk',  gnk_td,  'CIV5GameTextInfos_Civilizations_Expansion')
    civilizations_text_inh  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Civilizations_Inherited_Expansion2')
    civilizations_text_bnw  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Civilizations_Expansion2')

    civilopedia_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Civilopedia')
    civilopedia_text_gnk  = map_text('gnk',  gnk_td,  'CIV5GameTextInfos_Civilopedia_Expansion')

    objects_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Objects')
    objects_text_bnw  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Objects_Expansion2')

    # Jon = Jon Shafer's catch-all text bucket; Firaxis seems to have stuck
    # most worker-builds and similar in there.
    jon_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Jon')
    jon_text_gnk  = map_text('gnk',  gnk_td,  'CIV5GameTextInfos_Jon_Expansion')
    jon_text_inh  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Jon_Inherited_Expansion2')
    jon_text_bnw  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Jon_Expansion2')

    unit_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Units')
    unit_text_gnk  = map_text('gnk',  gnk_td,  'CIV5GameTextInfos_Units_Expansion')
    unit_text_inh  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Units_Inherited_Expansion2')
    unit_text_bnw  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Units_Expansion2')

    tech_text_base = map_text('base', base_td, 'CIV5GameTextInfos_Techs')
    tech_text_gnk  = map_text('gnk',  gnk_td,  'CIV5GameTextInfos_Techs_Expansion')
    tech_text_bnw  = map_text('bnw',  bnw_td,  'CIV5GameTextInfos_Techs_Expansion2')

    civilizations_root_base = get_root('base', 'Civilizations', 'CIV5Civilizations')
    civilizations_root_gnk  = get_root('gnk',  'Civilizations', 'CIV5Civilizations_Expansion')
    civilizations_root_inh  = get_root('bnw',  'Civilizations', 'CIV5Civilizations_Inherited_Expansion2')
    civilizations_root_bnw  = get_root('bnw',  'Civilizations', 'CIV5Civilizations_Expansion2')

    civ_data = {k: [] for k in DATA_KEYS}

    # Tech tree, promotions, projects, base resources are present in every
    # variant — same prep regardless of game, with text maps from all
    # available layers so an expansion-renamed tech still resolves.
    tech_maps = [tech_text_bnw, tech_text_gnk, tech_text_base]
    civ_data['technologies'] = prep_technologies(game, tech_maps)
    civ_data['promotions']   = prep_promotions(game, [unit_text_bnw, unit_text_inh, unit_text_gnk, unit_text_base])
    civ_data['projects']     = prep_projects('base')
    civ_data['resources']    = prep_resources(game, [objects_text_bnw, objects_text_base])

    # Worker builds, buildings, units, civilizations layer differently per
    # variant: GnK adds Expansion files, BNW adds Inherited_Expansion2 +
    # Expansion2 on top of base.
    if game == 'base':
        civ_data['build'] = prep_improvements(
            get_root('base', 'Units', 'CIV5Builds'),
            [jon_text_base],
        )
        civ_data['buildings'] = prep_buildings(
            [get_root('base', 'Buildings', 'CIV5Buildings')],
            [get_root('base', 'Buildings', 'CIV5BuildingClasses')],
            [civilizations_root_base],
            [building_text_base, objects_text_base],
        )
        civ_data['units'] = prep_units(
            [get_root('base', 'Units', 'CIV5Units')],
            [get_root('base', 'Units', 'CIV5UnitClasses')],
            [civilizations_root_base],
            [unit_text_base, objects_text_base, civilopedia_text_base],
        )
        civ_data['civilizations'] = prep_civilizations(
            [civilizations_root_base],
            [civilizations_text_base],
        )
    elif game == 'gnk':
        civ_data['build'] = (
            prep_improvements(get_root('gnk', 'Units', 'CIV5Builds'),           [jon_text_base]) +
            prep_improvements(get_root('gnk', 'Units', 'CIV5Builds_Expansion'), [jon_text_gnk])
        )
        civ_data['buildings'] = prep_buildings(
            [get_root('gnk', 'Buildings', 'CIV5Buildings'),
             get_root('gnk', 'Buildings', 'CIV5Buildings_Expansion')],
            [get_root('gnk', 'Buildings', 'CIV5BuildingClasses'),
             get_root('gnk', 'Buildings', 'CIV5BuildingClasses_Expansion')],
            [civilizations_root_base, civilizations_root_gnk],
            [building_text_gnk, building_text_base, objects_text_base],
        )
        civ_data['units'] = prep_units(
            [get_root('gnk', 'Units', 'CIV5Units'),
             get_root('gnk', 'Units', 'CIV5Units_Expansion')],
            [get_root('gnk', 'Units', 'CIV5UnitClasses'),
             get_root('gnk', 'Units', 'CIV5UnitClasses_Expansion')],
            [civilizations_root_base, civilizations_root_gnk],
            [unit_text_gnk, unit_text_base, objects_text_base, civilopedia_text_base],
        )
        civ_data['civilizations'] = prep_civilizations(
            [civilizations_root_base, civilizations_root_gnk],
            [civilizations_text_gnk, civilizations_text_base],
        )
    elif game == 'bnw':
        civ_data['build'] = (
            prep_improvements(get_root('bnw', 'Units', 'CIV5Builds'),                       [jon_text_base]) +
            prep_improvements(get_root('bnw', 'Units', 'CIV5Builds_Inherited_Expansion2'),  [jon_text_inh]) +
            prep_improvements(get_root('bnw', 'Units', 'CIV5Builds_Expansion2'),            [jon_text_bnw, objects_text_bnw])
        )
        civ_data['buildings'] = prep_buildings(
            [get_root('bnw', 'Buildings', 'CIV5Buildings'),
             get_root('bnw', 'Buildings', 'CIV5Buildings_Inherited_Expansion2'),
             get_root('bnw', 'Buildings', 'CIV5Buildings_Expansion2')],
            [get_root('bnw', 'Buildings', 'CIV5BuildingClasses'),
             get_root('bnw', 'Buildings', 'CIV5BuildingClasses_Inherited_Expansion2'),
             get_root('bnw', 'Buildings', 'CIV5BuildingClasses_Expansion2')],
            [civilizations_root_base, civilizations_root_inh, civilizations_root_bnw],
            [building_text_bnw, building_text_inh, building_text_base, objects_text_base],
        )
        # Note the original scraper has a quirk here — it loads the GnK
        # UnitClasses file via get_root('gnk', ...) instead of from bnw.
        # Faithfully preserved: BNW's unit class additions go through the
        # Inherited / Expansion2 layers below, and pulling base UnitClasses
        # from gnk is functionally identical to pulling them from bnw.
        civ_data['units'] = prep_units(
            [get_root('bnw', 'Units', 'CIV5Units'),
             get_root('bnw', 'Units', 'CIV5Units_Inherited_Expansion2'),
             get_root('bnw', 'Units', 'CIV5Units_Expansion2')],
            [get_root('gnk', 'Units', 'CIV5UnitClasses'),
             get_root('bnw', 'Units', 'CIV5UnitClasses_Inherited_Expansion2'),
             get_root('bnw', 'Units', 'CIV5UnitClasses_Expansion2')],
            [civilizations_root_base, civilizations_root_inh, civilizations_root_bnw],
            [unit_text_bnw, unit_text_inh, unit_text_base, objects_text_base, civilopedia_text_base],
        )
        civ_data['civilizations'] = prep_civilizations(
            [civilizations_root_base, civilizations_root_inh, civilizations_root_bnw],
            [civilizations_text_bnw, civilizations_text_inh, civilizations_text_base],
        )

    return civ_data


def write_output(out_path: str, data: dict, indent: int) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=indent if indent else None)


def run_one(game: str, indent: int) -> None:
    out_rel = PACKAGES[game]['out_rel']
    print(f'== {game} ==')
    data = build_civdata(game)
    out_path = os.path.join(REPO_ROOT, out_rel)
    write_output(out_path, data, indent)
    counts = ', '.join(f'{len(data[k])} {k}' for k in DATA_KEYS if data.get(k))
    print(f'   wrote {out_rel}: {counts}')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-g', '--game', choices=list(PACKAGES),
                    help='which game variant to scrape')
    ap.add_argument('--all', action='store_true',
                    help='scrape all three variants (base, gnk, bnw)')
    ap.add_argument('--indent', type=int, default=2,
                    help='JSON indent; pass 0 for compact (default: 2)')
    args = ap.parse_args()

    if args.all:
        for g in PACKAGES:
            run_one(g, args.indent)
    elif args.game:
        run_one(args.game, args.indent)
    else:
        ap.error('pass --game {base|gnk|bnw} or --all')


if __name__ == '__main__':
    main()
