"""
Civilization 6 data scraper.

Reads Firaxis XML from ./data/base, ./data/expansion1, ./data/expansion2 and
emits civdata.json in the shape consumed by src/initWheelData.js:

    {
      "technologies": [ { "id", "name", "cost", "era", "requires"? }, ... ],
      "civics":       [ { "id", "name", "cost", "era", "requires"? }, ... ]
    }

The ./data subtree holds the raw game asset dumps and is gitignored — only
the scripts in this directory are tracked.

Current scope: base-game technology + civics trees. Expansion deltas are
TODO (see notes at bottom).

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


# --------------------------- Generic node/prereq prep ---------------------------

def prep_nodes(
    pkg: str,
    xml_file: str,
    *,
    nodes_table: str,
    id_attr: str,
    prereq_table: str,
    prereq_node_attr: str,
    prereq_attr: str,
    id_strip_prefix: str,
    text_map: Dict[str, str],
) -> List[dict]:
    """Scrape a tech-tree-shaped table out of <pkg>/<xml_file>.

    Both Technologies and Civics share the same shape: a primary table with
    {id, name (LOC tag), cost, era} and a prereq side-table with {child, parent}.
    The attribute names differ — this helper takes them as arguments so the
    same code handles both.

    Args:
        nodes_table:        e.g. 'Technologies' or 'Civics'
        id_attr:            primary-key column on each node row
                            ('TechnologyType' / 'CivicType')
        prereq_table:       e.g. 'TechnologyPrereqs' or 'CivicPrereqs'
        prereq_node_attr:   FK column referencing the child node ('Technology' / 'Civic')
        prereq_attr:        column with the parent node id ('PrereqTech' / 'PrereqCivic')
        id_strip_prefix:    prefix to strip when synthesizing a fallback name
                            ('TECH_' / 'CIVIC_')
    """
    root = parse_xml(pkg, xml_file)
    if root is None:
        raise FileNotFoundError(f'{pkg}/{xml_file} not found')

    nodes: Dict[str, dict] = {}

    # 1. Basic rows: id, cost, era, name (resolved via text_map)
    table = root.find(nodes_table)
    if table is not None:
        for row in table.findall('Row'):
            nid = row.get(id_attr)
            if not nid:
                continue
            name_key = row.get('Name', '')
            node: dict = {'id': nid}
            if row.get('Cost') is not None:
                try:
                    node['cost'] = int(row.get('Cost'))
                except ValueError:
                    node['cost'] = row.get('Cost')
            if row.get('EraType'):
                node['era'] = row.get('EraType')
            if name_key in text_map:
                node['name'] = text_map[name_key]
            else:
                # Fall back to a humanized form of the id rather than dropping the row
                node['name'] = nid.replace(id_strip_prefix, '').replace('_', ' ').title()
            nodes[nid] = node

    # 2. Prereqs: append each parent onto child's `requires`
    pre_table = root.find(prereq_table)
    if pre_table is not None:
        for row in pre_table.findall('Row'):
            child = row.get(prereq_node_attr)
            parent = row.get(prereq_attr)
            if not child or not parent:
                continue
            if child not in nodes:
                # Prereq references a node not in this file's primary table
                # (can happen in expansion files referencing base nodes); skip.
                continue
            nodes[child].setdefault('requires', []).append(parent)

    return list(nodes.values())


def prep_technologies(pkg: str, tech_file: str, text_map: Dict[str, str]) -> List[dict]:
    """Scrape the technology tree from <pkg>/<tech_file>."""
    return prep_nodes(
        pkg, tech_file,
        nodes_table='Technologies',
        id_attr='TechnologyType',
        prereq_table='TechnologyPrereqs',
        prereq_node_attr='Technology',
        prereq_attr='PrereqTech',
        id_strip_prefix='TECH_',
        text_map=text_map,
    )


def prep_civics(pkg: str, civics_file: str, text_map: Dict[str, str]) -> List[dict]:
    """Scrape the civics tree from <pkg>/<civics_file>."""
    return prep_nodes(
        pkg, civics_file,
        nodes_table='Civics',
        id_attr='CivicType',
        prereq_table='CivicPrereqs',
        prereq_node_attr='Civic',
        prereq_attr='PrereqCivic',
        id_strip_prefix='CIVIC_',
        text_map=text_map,
    )


# --------------------------- Driver ---------------------------

def build_civdata(game: str) -> dict:
    """Assemble civdata.json contents for the given game variant."""
    data: dict = {}

    if game == 'base':
        # Tech and civic display names live in different text files in the
        # base package. Merge into a single lookup so we don't have to thread
        # two maps through.
        text_map: Dict[str, str] = {}
        text_map.update(parse_text_file('base', 'Types_Text.xml', 'BaseGameText'))
        text_map.update(parse_text_file('base', 'Civics_Text.xml', 'BaseGameText'))
        data['technologies'] = prep_technologies('base', 'Technologies.xml', text_map)
        data['civics']       = prep_civics('base', 'Civics.xml', text_map)
    elif game in ('rf', 'gs'):
        # Not yet supported: would need to layer expansion rows on top of base,
        # honor Technologies_XP2 / Civics_XP2 (hidden-until-prereq, random costs),
        # and merge expansion text.
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
    civics = data.get('civics', [])
    print(f'Wrote {len(techs)} technologies and {len(civics)} civics to {args.out}')


if __name__ == '__main__':
    main()


# ----------------------------------------------------------------------
# Deferred work:
#   - Expansion deltas: Expansion2 adds 10 techs + overrides + Technologies_XP2,
#     and similar for civics (Civics_XP2). Same hidden-until-prereq +
#     random-cost mechanics on both sides.
#   - Unlocks: buildings/units/improvements with PrereqTech and governments
#     /policies/wonders with PrereqCivic; the svelted scraper in git history
#     has a reasonable starting point for techs.
# ----------------------------------------------------------------------
