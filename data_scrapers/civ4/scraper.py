"""
Civilization 4 data scraper.

Reads Firaxis XML from data_scrapers/civ4/{base,war,bts}/XML and emits the
`technologies` and `civics` arrays into the matching civ4*/civdata.json files
in the shape consumed by src/initWheelData.js:

    {
      "technologies": [ {"id", "name", "cost", "era", "requires"?, "optional"?}, ... ],
      "civics":       [ {"id", "name", "requires"?}, ... ],
      ...everything else preserved from the existing civdata.json
    }

This script intentionally only rewrites the `technologies` and `civics`
top-level keys. The original Processing scraper (`civxml_to_json/`) emits
many other arrays (units, buildings, religions, resources, projects,
promotions, civilizations, build) — those stay as they are unless the user
re-runs the original. That means we add the era field without losing any
existing data.

Civ 4 prereq layout: each tech has <AndPreReqs> (all required) and
<OrPreReqs> (any-of). We map them to `requires` and `optional` respectively,
with the same special case the Processing scraper used: a single OrPreReq is
collapsed into `requires` because "any one of {x}" is just "x".

Run from this directory:
    python3 scraper.py --game base
    python3 scraper.py --game war
    python3 scraper.py --game bts
    python3 scraper.py --all          # do all three at once
"""

import argparse
import json
import os
import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple

# Game variant -> (xml subfolder, output civdata.json path relative to repo root)
PACKAGES = {
    'base': ('base', 'civ4/civdata.json'),
    'war':  ('war',  'civ4war/civdata.json'),
    'bts':  ('bts',  'civ4bts/civdata.json'),
}

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))


# --------------------------- XML helpers ---------------------------

# The Civ 4 XMLs declare a fake xmlns ("x-schema:..."), which makes ET prefix
# every tag with `{x-schema:...}`. Strip it so we can write `el.find('Type')`
# instead of `el.find('{x-schema:...}Type')` everywhere.
_NS_RE = re.compile(r'\{[^}]+\}')

def _strip_ns(elem: ET.Element) -> None:
    for el in elem.iter():
        el.tag = _NS_RE.sub('', el.tag)


def parse_xml(xml_path: str) -> Optional[ET.Element]:
    """Return root element of `xml_path` with namespaces stripped, or None."""
    try:
        root = ET.parse(xml_path).getroot()
    except FileNotFoundError:
        return None
    except ET.ParseError as e:
        raise RuntimeError(f'parse error in {xml_path}: {e}') from e
    _strip_ns(root)
    return root


def _text(el: Optional[ET.Element]) -> str:
    """Return el.text or empty string. Forgiving for missing tags."""
    if el is None or el.text is None:
        return ''
    return el.text


# --------------------------- Text resolution ---------------------------

# Civ 4 text XMLs are deeply translated. The English string can show up two
# ways:
#   <Tag>TXT_KEY_FOO</Tag><English>Foo</English>
#   <Tag>TXT_KEY_FOO</Tag><English><Text>Foo</Text>...</English>
# We merge every text file we can find into a single map at scraper start.

def parse_text_file(xml_path: str) -> Dict[str, str]:
    out: Dict[str, str] = {}
    root = parse_xml(xml_path)
    if root is None:
        return out
    for entry in root.findall('TEXT'):
        tag_el = entry.find('Tag')
        eng_el = entry.find('English')
        if tag_el is None or tag_el.text is None or eng_el is None:
            continue
        # The variants are: plain text inside <English>, or a <Text> child
        # (with sibling <Gender>/<Plural>). Try the child first.
        child_text = eng_el.find('Text')
        if child_text is not None and child_text.text is not None:
            out[tag_el.text] = child_text.text
        elif eng_el.text is not None:
            out[tag_el.text] = eng_el.text
    return out


def collect_text_map(pkg_dir: str) -> Dict[str, str]:
    """Collect every English LOC tag from base + (optionally) the expansion's
    text folder. We always merge in base/Text because expansions reference
    base tags; expansion text wins on key collisions (so renamed strings
    pick up the new copy)."""
    text_map: Dict[str, str] = {}

    base_text_dir = os.path.join(HERE, 'base', 'XML', 'Text')
    if os.path.isdir(base_text_dir):
        for fn in sorted(os.listdir(base_text_dir)):
            if fn.endswith('.xml'):
                text_map.update(parse_text_file(os.path.join(base_text_dir, fn)))

    if pkg_dir != 'base':
        ex_text_dir = os.path.join(HERE, pkg_dir, 'XML', 'Text')
        if os.path.isdir(ex_text_dir):
            for fn in sorted(os.listdir(ex_text_dir)):
                if fn.endswith('.xml'):
                    text_map.update(parse_text_file(os.path.join(ex_text_dir, fn)))

    return text_map


# --------------------------- Technologies ---------------------------

def prep_technologies(pkg_dir: str, text_map: Dict[str, str]) -> List[dict]:
    xml_path = os.path.join(HERE, pkg_dir, 'XML', 'Technologies', 'CIV4TechInfos.xml')
    root = parse_xml(xml_path)
    if root is None:
        raise FileNotFoundError(xml_path)

    container = root.find('TechInfos')
    if container is None:
        raise RuntimeError(f'{xml_path}: no <TechInfos> child')

    techs: List[dict] = []
    for ti in container.findall('TechInfo'):
        tid = _text(ti.find('Type'))
        if not tid:
            continue

        tech: dict = {'id': tid}

        # Name from text map; fall back to a humanized id rather than skip.
        desc_key = _text(ti.find('Description'))
        if desc_key in text_map:
            tech['name'] = text_map[desc_key]
        else:
            tech['name'] = tid.replace('TECH_', '').replace('_', ' ').title()

        # Cost
        cost_str = _text(ti.find('iCost'))
        if cost_str:
            try:
                tech['cost'] = int(cost_str)
            except ValueError:
                tech['cost'] = cost_str

        # Era — the whole reason this scraper exists.
        era = _text(ti.find('Era'))
        if era:
            tech['era'] = era

        # Prereqs. AndPreReqs -> requires, OrPreReqs -> optional. Match the
        # Processing scraper's quirk: one OrPreReq is really just a single
        # required prereq, so collapse it into requires.
        requires: List[str] = []
        optional: List[str] = []

        and_el = ti.find('AndPreReqs')
        if and_el is not None:
            for p in and_el.findall('PrereqTech'):
                if p.text:
                    requires.append(p.text)

        or_el = ti.find('OrPreReqs')
        if or_el is not None:
            or_list = [p.text for p in or_el.findall('PrereqTech') if p.text]
            if len(or_list) == 1:
                requires.append(or_list[0])
            elif len(or_list) > 1:
                optional.extend(or_list)

        if requires:
            tech['requires'] = requires
        if optional:
            tech['optional'] = optional

        techs.append(tech)

    return techs


# --------------------------- Civics ---------------------------

def prep_civics(pkg_dir: str, text_map: Dict[str, str]) -> List[dict]:
    """Civ 4 civics aren't a tree among themselves — each one has a single
    TechPrereq. We mirror the Processing scraper: skip civics with no
    prereq (Despotism, Tribalism, etc.) and emit `requires: [TECH_*]`."""
    xml_path = os.path.join(HERE, pkg_dir, 'XML', 'GameInfo', 'CIV4CivicInfos.xml')
    root = parse_xml(xml_path)
    if root is None:
        return []  # War lacks some files; civics still come from base anyway

    container = root.find('CivicInfos')
    if container is None:
        return []

    civics: List[dict] = []
    for ci in container.findall('CivicInfo'):
        prereq = _text(ci.find('TechPrereq'))
        if prereq == 'NONE' or not prereq:
            continue

        cid = _text(ci.find('Type'))
        if not cid:
            continue

        civic: dict = {'id': cid, 'requires': [prereq]}

        desc_key = _text(ci.find('Description'))
        if desc_key in text_map:
            civic['name'] = text_map[desc_key]
        else:
            civic['name'] = cid.replace('CIVIC_', '').replace('_', ' ').title()

        civics.append(civic)

    return civics


# --------------------------- Output: merge with existing JSON ---------------------------

def update_civdata(out_path: str, techs: List[dict], civics: List[dict],
                   indent: int) -> Tuple[int, int, bool]:
    """Replace `technologies` and `civics` in an existing civdata.json,
    leaving everything else (units, buildings, etc.) untouched. Creates the
    file with just those two arrays if it doesn't exist yet.

    Returns (tech_count, civic_count, merged_into_existing).
    """
    existing: dict = {}
    merged = False
    if os.path.exists(out_path):
        try:
            with open(out_path) as f:
                existing = json.load(f)
            merged = True
        except (OSError, json.JSONDecodeError):
            existing = {}

    existing['technologies'] = techs
    existing['civics'] = civics

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(existing, f, indent=indent if indent else None)

    return len(techs), len(civics), merged


# --------------------------- Driver ---------------------------

def run_one(game: str, indent: int) -> None:
    if game not in PACKAGES:
        raise ValueError(f'unknown --game {game!r}; expected {list(PACKAGES)}')
    pkg_dir, rel_out = PACKAGES[game]
    text_map = collect_text_map(pkg_dir)

    techs = prep_technologies(pkg_dir, text_map)
    civics = prep_civics(pkg_dir, text_map)

    out_path = os.path.join(REPO_ROOT, rel_out)
    n_t, n_c, merged = update_civdata(out_path, techs, civics, indent)
    note = '(merged into existing JSON)' if merged else '(created new JSON)'
    eras = sorted({t['era'] for t in techs if 'era' in t})
    print(f'[{game}] {n_t} techs, {n_c} civics -> {rel_out} {note}')
    print(f'        eras: {", ".join(eras) if eras else "none"}')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-g', '--game', choices=list(PACKAGES),
                    help='which game variant to scrape')
    ap.add_argument('--all', action='store_true',
                    help='scrape all three variants (base, war, bts)')
    ap.add_argument('--indent', type=int, default=2,
                    help='JSON indent; pass 0 for compact (default: 2)')
    args = ap.parse_args()

    if args.all:
        for g in PACKAGES:
            run_one(g, args.indent)
    elif args.game:
        run_one(args.game, args.indent)
    else:
        ap.error('pass --game {base|war|bts} or --all')


if __name__ == '__main__':
    main()
