"""
Civilization 6 data scraper.

Reads Firaxis XML from ./data/base, ./data/expansion1, ./data/expansion2 and
emits civdata.json in the shape consumed by src/initWheelData.js:

    { "technologies": [ { "id", "name", "cost", "era", "requires"? }, ... ] }

The ./data subtree holds the raw game asset dumps and is gitignored — only
the scripts in this directory are tracked.

Current scope: base-game technology tree only. Civics and expansion
deltas are TODO (see notes at bottom).

Run from this directory:
    python3 scraper.py --game base --out ../../civ6/civdata.json
"""

import argparse
import json
import os
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional

# Package layout under data/. Maps our --game argument to a folder name.
PACKAGES = {
    'base': 'base',
    'rf':   'expansion1',   # Rise & Fall (adds civics/boosts, no new techs)
    'gs':   'expansion2',   # Gathering Storm
}

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')


# --------------------------- XML helpers ---------------------------

def parse_xml(pkg: str, filename: str) -> Optional[ET.Element]:
    """Return the root element of data_scrapers/civ6/data/<pkg>/<filename>, or None."""
    path = os.path.join(DATA_DIR, pkg, filename)
    try:
        return ET.parse(path).getroot()
    except FileNotFoundError:
        return None
    except ET.ParseError as e:
        raise RuntimeError(f'parse error in {path}: {e}') from e


def parse_text_file(pkg: str, filename: str, parent_tag: str = 'BaseGameText') -> Dict[str, str]:
    """Return a dict mapping LOC_* tags to their English strings.

    Civ 6 text XML is shaped like:
        <GameData>
          <BaseGameText>  (or EnglishText in expansions)
            <Row Tag="LOC_TECH_POTTERY_NAME"><Text>Pottery</Text></Row>
            ...
    """
    path = os.path.join(DATA_DIR, pkg, 'Text', 'en_US', filename)
    out: Dict[str, str] = {}
    try:
        root = ET.parse(path).getroot()
    except FileNotFoundError:
        return out

    container = root.find(parent_tag)
    if container is None:
        # Fall back: walk all top-level children looking for <Row Tag="..."><Text>...</Text></Row>
        containers = list(root)
    else:
        containers = [container]

    for c in containers:
        for row in c.findall('Row'):
            tag = row.get('Tag')
            text_el = row.find('Text')
            if tag and text_el is not None and text_el.text is not None:
                out[tag] = text_el.text
    return out


# --------------------------- Tech tree ---------------------------

def prep_technologies(pkg: str, tech_file: str, text_map: Dict[str, str]) -> List[dict]:
    """Scrape the technology tree from <pkg>/<tech_file>, resolving names via text_map."""
    root = parse_xml(pkg, tech_file)
    if root is None:
        raise FileNotFoundError(f'{pkg}/{tech_file} not found')

    techs: Dict[str, dict] = {}

    # 1. Basic tech rows: id, cost, era, name (resolved via text_map)
    techs_table = root.find('Technologies')
    if techs_table is not None:
        for row in techs_table.findall('Row'):
            tid = row.get('TechnologyType')
            if not tid:
                continue
            name_key = row.get('Name', '')
            tech: dict = {'id': tid}
            # cost as int for consistency with civ4 data; coerce when present
            if row.get('Cost') is not None:
                try:
                    tech['cost'] = int(row.get('Cost'))
                except ValueError:
                    tech['cost'] = row.get('Cost')
            if row.get('EraType'):
                tech['era'] = row.get('EraType')
            if name_key in text_map:
                tech['name'] = text_map[name_key]
            else:
                # Fall back to a humanized form of the id rather than dropping the tech
                tech['name'] = tid.replace('TECH_', '').replace('_', ' ').title()
            techs[tid] = tech

    # 2. Prereqs: append each PrereqTech onto `requires`
    prereqs_table = root.find('TechnologyPrereqs')
    if prereqs_table is not None:
        for row in prereqs_table.findall('Row'):
            tid = row.get('Technology')
            preq = row.get('PrereqTech')
            if not tid or not preq:
                continue
            if tid not in techs:
                # Prereq references a tech that isn't in this file's Technologies table
                # (can happen in expansion files that reference base techs); skip.
                continue
            techs[tid].setdefault('requires', []).append(preq)

    return list(techs.values())


# --------------------------- Driver ---------------------------

def build_civdata(game: str) -> dict:
    """Assemble civdata.json contents for the given game variant."""
    data: dict = {}

    if game == 'base':
        text_map = parse_text_file('base', 'Types_Text.xml', 'BaseGameText')
        data['technologies'] = prep_technologies('base', 'Technologies.xml', text_map)
    elif game in ('rf', 'gs'):
        # Not yet supported: would need to layer expansion Technologies rows on top of base,
        # honor Technologies_XP2 (hidden-until-prereq, random costs), and merge expansion text.
        raise NotImplementedError(
            f'--game {game} not implemented yet; only "base" is supported this round'
        )
    else:
        raise ValueError(f'unknown --game {game!r}; expected one of {list(PACKAGES)}')

    return data


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('-g', '--game', default='base', choices=list(PACKAGES),
                    help='which package to scrape (default: base)')
    ap.add_argument('-o', '--out', default=os.path.join(HERE, '..', '..', 'civ6', 'civdata.json'),
                    help='output JSON path (default: ../../civ6/civdata.json)')
    ap.add_argument('--indent', type=int, default=2,
                    help='JSON indent; pass 0 for compact (default: 2)')
    args = ap.parse_args()

    data = build_civdata(args.game)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(data, f, indent=args.indent if args.indent else None)

    techs = data.get('technologies', [])
    print(f'Wrote {len(techs)} technologies to {args.out}')


if __name__ == '__main__':
    main()


# ----------------------------------------------------------------------
# Deferred work:
#   - Civics tree: parse base/Civics.xml + Civics_Text.xml; separate graph.
#   - Expansion deltas: Expansion2 adds 10 techs + overrides + Technologies_XP2.
#   - Unlocks: buildings/units/improvements with PrereqTech; the svelted
#     scraper in git history has a reasonable starting point for this.
# ----------------------------------------------------------------------
