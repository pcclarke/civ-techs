"""
Civilization 6 data scraper.

Reads Firaxis XML from ./data/{base,expansion1,expansion2} and emits
civdata.json in the shape consumed by src/initWheelData.js:

    {
      "technologies": [ { "id", "name", "cost", "era", "requires"? }, ... ],
      "civics":       [ { "id", "name", "cost", "era", "requires"? }, ... ]
    }

The ./data subtree holds the raw game asset dumps and is gitignored — only
the scripts in this directory are tracked.

Game variants:
    --game base   -> civ6/civdata.json   (base game only)
    --game rf     -> civ6rf/civdata.json (base + Rise & Fall)
    --game gs     -> civ6gs/civdata.json (base + Rise & Fall + Gathering Storm)
    --all         -> all three

Layered loading: each expansion's tech/civic XML is applied as a delta on
top of base. Within a layer, <Row> in <Technologies>/<Civics> is an upsert
(Firaxis uses one for TECH_FUTURE_TECH in GS to wholesale re-define it),
<Update><Where><Set/></Update> is a field-level patch, <Row> in *Prereqs is
an edge insert, and <Delete> in *Prereqs removes one specific edge.
Expansion text files use <EnglishText>; base uses <BaseGameText>.

Ignored on purpose:
  - <Technologies_XP2> / <Civics_XP2> (just metadata flagging the random-
    prereq mechanic; the actual prereq edges still come from *Prereqs)
  - <TechnologyRandomCosts> / <CivicRandomCosts> (the wheel only renders one
    cost per node; the static Cost on the row is a fine canonical value)

Run from this directory:
    python3 scraper.py --game base
    python3 scraper.py --game rf
    python3 scraper.py --game gs
    python3 scraper.py --all
"""

import argparse
import json
import os
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, 'data')
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))

# Per-package layout. Each package contributes one tech XML and one civic
# XML (which may be empty for that package), plus matching text files.
PACKAGES: Dict[str, dict] = {
    'base': {
        'pkg': 'base',
        'tech_xml': 'Technologies.xml',
        'civic_xml': 'Civics.xml',
        # Multiple text files contribute to one map; load all of these.
        # Types_Text holds the canonical short names ('Pottery', etc.)
        # used by both trees, so it stays in the list for every layer.
        'text_files': ['Types_Text.xml', 'Civics_Text.xml', 'Technologies_Text.xml'],
        'text_parent': 'BaseGameText',
    },
    'rf': {
        'pkg': 'expansion1',
        'tech_xml': 'Expansion1_Technologies.xml',
        'civic_xml': 'Expansion1_Civics.xml',
        'text_files': ['Expansion1_Technologies_Text.xml', 'Expansion1_Civics_Text.xml'],
        'text_parent': 'EnglishText',
    },
    'gs': {
        'pkg': 'expansion2',
        'tech_xml': 'Expansion2_Technologies.xml',
        'civic_xml': 'Expansion2_Civics.xml',
        'text_files': ['Expansion2_Technologies_Text.xml', 'Expansion2_Civics_Text.xml'],
        'text_parent': 'EnglishText',
    },
}

# Game variant -> (layered packages in order, output JSON path).
GAMES: Dict[str, Tuple[List[str], str]] = {
    'base': (['base'],              'civ6/civdata.json'),
    'rf':   (['base', 'rf'],        'civ6rf/civdata.json'),
    'gs':   (['base', 'rf', 'gs'],  'civ6gs/civdata.json'),
}

# What we pull off each <Row> in <Technologies>/<Civics> (and what <Update>
# may patch). Skipping fields the wheel doesn't render keeps the JSON small
# and stable when Firaxis adds unrelated columns.
NODE_FIELDS_INT = ['Cost']
NODE_FIELDS_STR = ['EraType', 'Name']


# --------------------------- XML helpers ---------------------------

def parse_xml(pkg: str, filename: str) -> Optional[ET.Element]:
    """Return the root element of data/<pkg>/<filename>, or None if absent."""
    path = os.path.join(DATA_DIR, pkg, filename)
    try:
        return ET.parse(path).getroot()
    except FileNotFoundError:
        return None
    except ET.ParseError as e:
        raise RuntimeError(f'parse error in {path}: {e}') from e


def parse_text_file(pkg: str, filename: str, parent_tag: str) -> Dict[str, str]:
    """Return a dict of LOC_* tag -> English string from data/<pkg>/Text/en_US/<filename>.

    The XML shape is:
        <GameData>
          <BaseGameText> | <EnglishText>
            <Row Tag="LOC_TECH_POTTERY_NAME"><Text>Pottery</Text></Row>
    """
    path = os.path.join(DATA_DIR, pkg, 'Text', 'en_US', filename)
    out: Dict[str, str] = {}
    try:
        root = ET.parse(path).getroot()
    except FileNotFoundError:
        return out

    # The named container is the common case; fall back to all top-level
    # children so a Firaxis rename doesn't silently drop strings.
    container = root.find(parent_tag)
    containers = [container] if container is not None else list(root)

    for c in containers:
        for row in c.findall('Row'):
            tag = row.get('Tag')
            text_el = row.find('Text')
            if tag and text_el is not None and text_el.text is not None:
                out[tag] = text_el.text
    return out


def collect_text_map(pkg_keys: List[str]) -> Dict[str, str]:
    """Merge text from every package's text files into one map. Later layers
    win on key collision, matching Firaxis's expansion-overrides-base
    behaviour (e.g. CIVIC_FUTURE_CIVIC's description gets rewritten in GS)."""
    text_map: Dict[str, str] = {}
    for key in pkg_keys:
        info = PACKAGES[key]
        for fn in info['text_files']:
            text_map.update(parse_text_file(info['pkg'], fn, info['text_parent']))
    return text_map


# --------------------------- Per-layer apply ---------------------------

def _coerce_field(name: str, raw: str):
    """Normalise a field value. Costs are ints; everything else stays a string."""
    if name in NODE_FIELDS_INT:
        try:
            return int(raw)
        except (ValueError, TypeError):
            return raw
    return raw


def _set_node_field(node: dict, attr: str, raw_value: str, *, id_strip_prefix: str,
                    text_map: Dict[str, str]) -> None:
    """Apply one column update to a node dict. Maps Firaxis column names onto
    our JSON shape (cost/era/name). 'Name' is a LOC tag — resolve it to
    English here so consumers don't need the text map."""
    if attr == 'Cost':
        node['cost'] = _coerce_field('Cost', raw_value)
    elif attr == 'EraType':
        if raw_value:
            node['era'] = raw_value
    elif attr == 'Name':
        if raw_value in text_map:
            node['name'] = text_map[raw_value]
        else:
            # Keep whatever we already had if the new tag is missing; only
            # synthesise a fallback if the node has no name at all.
            node.setdefault('name',
                            node.get('id', raw_value).replace(id_strip_prefix, '').replace('_', ' ').title())


def _apply_node_layer(
    nodes: Dict[str, dict],
    layer_root: ET.Element,
    *,
    nodes_table: str,
    id_attr: str,
    id_strip_prefix: str,
    text_map: Dict[str, str],
) -> None:
    """Apply one layer's <Technologies>/<Civics> section to `nodes`.

    Handles three element types inside the table:
      - <Row id_attr="..."> : upsert. New nodes get a fresh dict; existing
        nodes have their fields overwritten by anything the row specifies.
      - <Update><Where id_attr="..."/><Set>...</Set></Update> : field patch.
      - Anything else (Quote rows etc.) is ignored.
    """
    table = layer_root.find(nodes_table)
    if table is None:
        return

    for child in list(table):
        if child.tag == 'Row':
            nid = child.get(id_attr)
            if not nid:
                continue
            node = nodes.setdefault(nid, {'id': nid})
            for attr in NODE_FIELDS_INT + NODE_FIELDS_STR:
                if child.get(attr) is not None:
                    _set_node_field(node, attr, child.get(attr),
                                    id_strip_prefix=id_strip_prefix, text_map=text_map)
            # Ensure every node has *some* name even when the row doesn't
            # supply one (rare but happens on certain new-row flavours).
            if 'name' not in node:
                node['name'] = nid.replace(id_strip_prefix, '').replace('_', ' ').title()

        elif child.tag == 'Update':
            where = child.find('Where')
            sset = child.find('Set')
            if where is None or sset is None:
                continue
            nid = where.get(id_attr)
            if not nid or nid not in nodes:
                # Update on something we never loaded — silently skip; this
                # can happen if Firaxis ships a stub that touches a deleted
                # base node.
                continue
            for set_child in list(sset):
                if set_child.tag in (NODE_FIELDS_INT + NODE_FIELDS_STR):
                    val = set_child.text or ''
                    _set_node_field(nodes[nid], set_child.tag, val,
                                    id_strip_prefix=id_strip_prefix,
                                    text_map=text_map)


def _apply_prereq_layer(
    prereqs: Dict[str, List[str]],
    layer_root: ET.Element,
    *,
    prereq_table: str,
    child_attr: str,
    parent_attr: str,
) -> None:
    """Apply one layer's <TechnologyPrereqs>/<CivicPrereqs> section.

    `prereqs` is keyed by child id with a list of parent ids — we use a list
    rather than a set so Firaxis's authoring order is preserved (it's the
    order optional-prereq buttons appear in the in-game tooltip).

    <Row> adds an edge if not already present (defensive against duplicate
    rows across layers); <Delete> removes a specific edge.
    """
    pre = layer_root.find(prereq_table)
    if pre is None:
        return

    for child in list(pre):
        c = child.get(child_attr)
        p = child.get(parent_attr)
        if not c or not p:
            continue

        if child.tag == 'Row':
            parents = prereqs.setdefault(c, [])
            if p not in parents:
                parents.append(p)
        elif child.tag == 'Delete':
            parents = prereqs.get(c, [])
            if p in parents:
                parents.remove(p)


def build_nodes_for_tree(
    pkg_keys: List[str],
    *,
    xml_attr: str,             # 'tech_xml' or 'civic_xml'
    nodes_table: str,          # 'Technologies' or 'Civics'
    id_attr: str,              # 'TechnologyType' or 'CivicType'
    prereq_table: str,         # 'TechnologyPrereqs' or 'CivicPrereqs'
    prereq_child_attr: str,    # 'Technology' or 'Civic'
    prereq_parent_attr: str,   # 'PrereqTech' or 'PrereqCivic'
    id_strip_prefix: str,      # 'TECH_' or 'CIVIC_'
    text_map: Dict[str, str],
) -> List[dict]:
    """Assemble the final node list for one tree across all packages."""
    nodes: Dict[str, dict] = {}
    prereqs: Dict[str, List[str]] = {}

    for key in pkg_keys:
        info = PACKAGES[key]
        root = parse_xml(info['pkg'], info[xml_attr])
        if root is None:
            continue
        _apply_node_layer(nodes, root, nodes_table=nodes_table, id_attr=id_attr,
                          id_strip_prefix=id_strip_prefix, text_map=text_map)
        _apply_prereq_layer(prereqs, root, prereq_table=prereq_table,
                            child_attr=prereq_child_attr,
                            parent_attr=prereq_parent_attr)

    # Stitch the resolved prereqs onto each node. Skip prereqs whose parent
    # doesn't exist in the final node set (can happen if the parent is a
    # node from a layer we didn't include).
    for child_id, parent_ids in prereqs.items():
        if child_id not in nodes:
            continue
        kept = [p for p in parent_ids if p in nodes]
        if kept:
            nodes[child_id]['requires'] = kept

    return list(nodes.values())


# --------------------------- Driver ---------------------------

def build_civdata(game: str) -> dict:
    if game not in GAMES:
        raise ValueError(f'unknown --game {game!r}; expected {list(GAMES)}')
    pkg_keys, _ = GAMES[game]

    text_map = collect_text_map(pkg_keys)

    techs = build_nodes_for_tree(
        pkg_keys,
        xml_attr='tech_xml',
        nodes_table='Technologies',
        id_attr='TechnologyType',
        prereq_table='TechnologyPrereqs',
        prereq_child_attr='Technology',
        prereq_parent_attr='PrereqTech',
        id_strip_prefix='TECH_',
        text_map=text_map,
    )
    civics = build_nodes_for_tree(
        pkg_keys,
        xml_attr='civic_xml',
        nodes_table='Civics',
        id_attr='CivicType',
        prereq_table='CivicPrereqs',
        prereq_child_attr='Civic',
        prereq_parent_attr='PrereqCivic',
        id_strip_prefix='CIVIC_',
        text_map=text_map,
    )

    return {'technologies': techs, 'civics': civics}


def write_output(out_path: str, data: dict, indent: int) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=indent if indent else None)


def run_one(game: str, indent: int) -> None:
    _, rel_out = GAMES[game]
    data = build_civdata(game)
    out_path = os.path.join(REPO_ROOT, rel_out)
    write_output(out_path, data, indent)
    techs = data['technologies']
    civics = data['civics']
    eras = sorted({n.get('era') for n in techs + civics if n.get('era')})
    print(f'[{game}] {len(techs)} techs, {len(civics)} civics -> {rel_out}')
    print(f'        eras: {", ".join(eras) if eras else "none"}')


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('-g', '--game', choices=list(GAMES),
                    help='which game variant to scrape')
    ap.add_argument('--all', action='store_true',
                    help='scrape all three variants (base, rf, gs)')
    ap.add_argument('--indent', type=int, default=2,
                    help='JSON indent; pass 0 for compact (default: 2)')
    args = ap.parse_args()

    if args.all:
        for g in GAMES:
            run_one(g, args.indent)
    elif args.game:
        run_one(args.game, args.indent)
    else:
        ap.error('pass --game {base|rf|gs} or --all')


if __name__ == '__main__':
    main()
