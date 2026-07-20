"""
Civilization 6 data scraper.

Reads Firaxis XML from ./data/{base,expansion1,expansion2} and emits
civdata.json in the shape consumed by src/initWheelData.js:

    {
      "technologies": [ { "id", "name", "cost", "era", "requires"? }, ... ],
      "civics":       [ ... same shape ... ],
      "buildings":    [ { "id", "name", "cost"?, "requires"? }, ... ],
      "wonders":      [ ... same shape, only IsWonder buildings ... ],
      "units":        [ ... ],
      "districts":    [ ... ],
      "improvements": [ ... ],
      "projects":     [ ... ],
      "policies":     [ ... ],
      "governments":  [ ... ],
      "civilizations": [ { "id", "name" }, ... ],
    }

Civ/leader-unique items get the wrapped shape the older games' data uses
(see fold_uniques): a base item grows `CIVILIZATION_ALL` plus
CIVILIZATION_*/LEADER_*-keyed sub-objects for its unique replacements,
and base-less uniques carry a single owner-keyed sub-object. The site's
buildUnlockIndex.js renders these as inline "unique:" variant chips in
the tooltip; `civilizations` provides owner display names (leaders
included).

The ./data subtree holds the raw game asset dumps and is gitignored — only
the scripts in this directory are tracked.

Game variants:
    --game base   -> civ6/civdata.json   (base game only)
    --game rf     -> civ6rf/civdata.json (base + Rise & Fall)
    --game gs     -> civ6gs/civdata.json (base + Rise & Fall + Gathering Storm)
    --all         -> all three

Layered loading: each expansion's XML is applied as a delta on top of
base. There are two table shapes:

  Tech / civic — main rows in one table, prereq EDGES in a sibling table:
      <Technologies>     <Row id_attr=..>...
      <TechnologyPrereqs> <Row Technology=.. PrereqTech=..>
                          <Delete Technology=.. PrereqTech=..>

  Unlocks (buildings, units, districts, etc.) — main rows carry their
  prereqs INLINE as PrereqTech / PrereqCivic columns, no edge table:
      <Buildings>        <Row BuildingType=.. PrereqTech=.. PrereqCivic=..>

Both shapes accept <Row> (upsert), <Update><Where/><Set/></Update>
(field patch); the prereq-edge shape additionally honours <Delete>.

Ignored on purpose:
  - <Technologies_XP2> / <Civics_XP2> / <Buildings_XP2> / <Units_XP2> /
    <Districts_XP2> (metadata flagging the random-prereq mechanic; actual
    prereq edges still come from the main table or *Prereqs side-table)
  - <TechnologyRandomCosts> / <CivicRandomCosts> (the wheel renders one
    cost per node; the static Cost on the row is a fine canonical value)
  - District / building / project chain prereqs (PrereqDistrict on a
    building, PrereqBuilding via the BuildingPrereqs side-table, etc.) —
    the wheel only cares about tech/civic gates, not in-tree dependency
    chains within a single category

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

# Per-package layout. Each package contributes XML files for several
# categories (tech/civic + unlock tables) plus matching text files.
# `unlock_files` maps category-key -> list of XMLs to apply in order
# (some expansions split a category across base + _Major files).
PACKAGES: Dict[str, dict] = {
    'base': {
        'pkg': 'base',
        'tech_xml': 'Technologies.xml',
        'civic_xml': 'Civics.xml',
        'unlock_files': {
            'building':    ['Buildings.xml'],
            'unit':        ['Units.xml'],
            'district':    ['Districts.xml'],
            'improvement': ['Improvements.xml'],
            'project':     ['Projects.xml'],
            'policy':      ['Policies.xml'],
            'government':  ['Governments.xml'],
        },
        # Multiple text files contribute to one map; load all of these.
        # Types_Text holds the canonical short names for *most* nodes
        # (techs, civics, districts, units, etc., and civilization names);
        # the per-category Buildings_Text / Civics_Text / Technologies_Text
        # files top it up with civilopedia entries, and Leaders_Text has
        # the leader display names used for leader-unique attribution.
        'text_files': ['Types_Text.xml', 'Civics_Text.xml', 'Technologies_Text.xml',
                       'Leaders_Text.xml'],
        'text_parent': 'BaseGameText',
        # Ownership tables for civ/leader-unique attribution: who owns
        # which TRAIT_* (CivilizationTraits / LeaderTraits) and what the
        # owner's display name is.
        'civ_files':    ['Civilizations.xml'],
        'leader_files': ['Leaders.xml'],
    },
    'rf': {
        'pkg': 'expansion1',
        'tech_xml': 'Expansion1_Technologies.xml',
        'civic_xml': 'Expansion1_Civics.xml',
        'unlock_files': {
            # Most expansion categories ship two files: base name (for the
            # delta-style patches) and `_Major` (for new full-row inserts).
            'building':    ['Expansion1_Buildings.xml', 'Expansion1_Buildings_Major.xml'],
            'unit':        ['Expansion1_Units.xml',     'Expansion1_Units_Major.xml'],
            'district':    ['Expansion1_Districts.xml', 'Expansion1_Districts_Major.xml'],
            'improvement': ['Expansion1_Improvements.xml', 'Expansion1_Improvements_Major.xml'],
            'project':     ['Expansion1_Projects.xml'],
            'policy':      ['Expansion1_Policies.xml'],
            'government':  ['Expansion1_Governments.xml'],
        },
        'text_files': [
            'Expansion1_Technologies_Text.xml',
            'Expansion1_Civics_Text.xml',
            'Expansion1_Buildings_Text.xml',
            'Expansion1_Districts_Text.xml',
            'Expansion1_Units_Text.xml',
            'Expansion1_Leaders_Text.xml',
            # New civs' display names (Georgia et al.) live in ConfigText.
            'Expansion1_ConfigText.xml',
        ],
        'text_parent': 'EnglishText',
        'civ_files':    ['Expansion1_Civilizations.xml',
                         'Expansion1_Civilizations_Major.xml'],
        'leader_files': ['Expansion1_Leaders.xml',
                         'Expansion1_Leaders_Major.xml'],
    },
    'gs': {
        'pkg': 'expansion2',
        'tech_xml': 'Expansion2_Technologies.xml',
        'civic_xml': 'Expansion2_Civics.xml',
        'unlock_files': {
            'building':    ['Expansion2_Buildings.xml',     'Expansion2_Buildings_Major.xml'],
            'unit':        ['Expansion2_Units.xml',         'Expansion2_Units_Major.xml'],
            'district':    ['Expansion2_Districts.xml',     'Expansion2_Districts_Major.xml'],
            'improvement': ['Expansion2_Improvements.xml',  'Expansion2_Improvements_Major.xml'],
            'project':     ['Expansion2_Projects.xml'],
            'policy':      ['Expansion2_Policies.xml'],
            'government':  ['Expansion2_Governments.xml'],
        },
        'text_files': [
            'Expansion2_Technologies_Text.xml',
            'Expansion2_Civics_Text.xml',
            'Expansion2_Buildings_Text.xml',
            'Expansion2_Districts_Text.xml',
            'Expansion2_Improvements_Text.xml',
            'Expansion2_Units_Text.xml',
            'Expansion1_Leaders_Text.xml',
            'Expansion2_Leaders_Text.xml',
            'Expansion2_ConfigText.xml',
        ],
        'text_parent': 'EnglishText',
        # The expansion2 dir re-ships updated Expansion1 civ/leader files
        # alongside its own; load both so the GS layering matches the way
        # Firaxis stacks them.
        'civ_files':    ['Expansion1_Civilizations.xml',
                         'Expansion2_Civilizations.xml',
                         'Expansion2_Civilizations_Major.xml'],
        'leader_files': ['Expansion1_Leaders.xml',
                         'Expansion2_Leaders.xml',
                         'Expansion2_Leaders_Major.xml'],
    },
}

# Game variant -> (layered packages in order, output JSON path).
GAMES: Dict[str, Tuple[List[str], str]] = {
    'base': (['base'],              'civ6/civdata.json'),
    'rf':   (['base', 'rf'],        'civ6rf/civdata.json'),
    'gs':   (['base', 'rf', 'gs'],  'civ6gs/civdata.json'),
}

# Tech / civic node fields. Skipping fields the wheel doesn't render keeps
# the JSON compact and stable when Firaxis adds unrelated columns.
NODE_FIELDS_INT = ['Cost']
NODE_FIELDS_STR = ['EraType', 'Name']

# Inline-prereq columns we lift onto every unlock node's `requires` list.
# Both fields can be set on the same row; both go into requires together.
INLINE_PREREQ_FIELDS = ['PrereqTech', 'PrereqCivic']

# Per-category exclusion list — ids dropped from the output entirely, even
# if they have a real prereq and would otherwise show up in the wheel's
# tooltip. Use sparingly; the right home for an item Firaxis ships but we
# don't want is "remove via this list" rather than "let it render".
#
# DISTRICT_WATER_STREET_CARNIVAL is Brazil's coastal twin of their unique
# Street Carnival district. It's redundant alongside the regular Street
# Carnival in the wheel UI — same flavour, just placed on water tiles —
# and Firaxis's icon for it is just an alias to the standard Water Park
# icon (no distinct art). Dropped here so a fresh scrape doesn't bring it
# back.
EXCLUDE_IDS: Dict[str, set] = {
    'districts': {'DISTRICT_WATER_STREET_CARNIVAL'},
}

# Per-category configuration for the inline-unlock extractor. file_key is
# the lookup into PACKAGES[*]['unlock_files']. is_wonder_split routes
# IsWonder=true rows into a separate output array.
UNLOCK_CATEGORIES: Dict[str, dict] = {
    'buildings': {
        'file_key':         'building',
        'table_name':       'Buildings',
        'id_attr':          'BuildingType',
        'id_strip_prefix':  'BUILDING_',
        'is_wonder_split':  True,
        'replaces_table':       'BuildingReplaces',
        'replaces_unique_attr': 'CivUniqueBuildingType',
        'replaces_base_attr':   'ReplacesBuildingType',
    },
    'units': {
        'file_key':         'unit',
        'table_name':       'Units',
        'id_attr':          'UnitType',
        'id_strip_prefix':  'UNIT_',
        'replaces_table':       'UnitReplaces',
        'replaces_unique_attr': 'CivUniqueUnitType',
        'replaces_base_attr':   'ReplacesUnitType',
    },
    'districts': {
        'file_key':         'district',
        'table_name':       'Districts',
        'id_attr':          'DistrictType',
        'id_strip_prefix':  'DISTRICT_',
        'replaces_table':       'DistrictReplaces',
        'replaces_unique_attr': 'CivUniqueDistrictType',
        'replaces_base_attr':   'ReplacesDistrictType',
    },
    'improvements': {
        'file_key':         'improvement',
        'table_name':       'Improvements',
        'id_attr':          'ImprovementType',
        'id_strip_prefix':  'IMPROVEMENT_',
    },
    'projects': {
        'file_key':         'project',
        'table_name':       'Projects',
        'id_attr':          'ProjectType',
        'id_strip_prefix':  'PROJECT_',
    },
    'policies': {
        'file_key':         'policy',
        'table_name':       'Policies',
        'id_attr':          'PolicyType',
        'id_strip_prefix':  'POLICY_',
    },
    'governments': {
        'file_key':         'government',
        'table_name':       'Governments',
        'id_attr':          'GovernmentType',
        'id_strip_prefix':  'GOVERNMENT_',
    },
}


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


# --------------------------- Tech/civic main-table apply ---------------------------

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


# --------------------------- Inline-unlock apply ---------------------------

def _apply_inline_attrs(entry: dict, attrs: Dict[str, str], *,
                        text_map: Dict[str, str], id_strip_prefix: str) -> None:
    """Apply a flat attrs dict (from a <Row> attribute set or an Update's
    <Set> children) onto an unlock node. Resolves Name, ints Cost, appends
    PrereqTech/PrereqCivic onto `requires`, and tags wonders for later split.
    """
    if 'Name' in attrs:
        name_key = attrs['Name']
        if name_key in text_map:
            entry['name'] = text_map[name_key]
        else:
            entry.setdefault(
                'name',
                entry.get('id', name_key).replace(id_strip_prefix, '').replace('_', ' ').title(),
            )

    if 'Cost' in attrs and attrs['Cost'] is not None:
        try:
            entry['cost'] = int(attrs['Cost'])
        except (ValueError, TypeError):
            entry['cost'] = attrs['Cost']

    requires = entry.get('requires', [])
    for fld in INLINE_PREREQ_FIELDS:
        v = attrs.get(fld)
        if v and v not in requires:
            requires.append(v)
    if requires:
        entry['requires'] = requires

    if attrs.get('IsWonder') == 'true':
        entry['_is_wonder'] = True

    # Trait marker for civ/leader-unique attribution. Resolved to an owner
    # (and stripped) by fold_uniques after the whole category is built.
    if attrs.get('TraitType'):
        entry['_trait'] = attrs['TraitType']


def _apply_inline_unlock_layer(
    items: Dict[str, dict],
    layer_root: ET.Element,
    *,
    cfg: dict,
    text_map: Dict[str, str],
) -> None:
    """Apply one layer's main unlock table (Buildings / Units / etc).

    Same Row/Update grammar as _apply_node_layer, except prereqs live as
    inline columns on the row rather than in a sibling edge table.
    """
    table = layer_root.find(cfg['table_name'])
    if table is None:
        return

    id_attr = cfg['id_attr']
    id_strip_prefix = cfg['id_strip_prefix']

    for child in list(table):
        if child.tag == 'Row':
            iid = child.get(id_attr)
            if not iid:
                continue
            entry = items.setdefault(iid, {'id': iid})
            _apply_inline_attrs(entry, child.attrib,
                                text_map=text_map, id_strip_prefix=id_strip_prefix)
            # Always synthesise a fallback name if nothing landed.
            if 'name' not in entry:
                entry['name'] = iid.replace(id_strip_prefix, '').replace('_', ' ').title()

        elif child.tag == 'Update':
            where = child.find('Where')
            sset = child.find('Set')
            if where is None or sset is None:
                continue
            iid = where.get(id_attr)
            if not iid or iid not in items:
                continue
            # Build a flat attrs dict from <Set>'s children (each child's
            # tag is the column name and its text is the new value).
            set_attrs: Dict[str, str] = {}
            for sc in list(sset):
                set_attrs[sc.tag] = sc.text or ''
            _apply_inline_attrs(items[iid], set_attrs,
                                text_map=text_map, id_strip_prefix=id_strip_prefix)


def build_unlocks_for_category(
    pkg_keys: List[str],
    cfg: dict,
    text_map: Dict[str, str],
) -> Tuple[List[dict], List[dict]]:
    """Walk every package layer for one unlock category, returning a list
    of node dicts (and, for buildings, a separate wonders list).

    Wonder split: if cfg has is_wonder_split=True, items tagged _is_wonder
    are pulled out into the second return list. The marker field itself is
    stripped from the output.
    """
    items: Dict[str, dict] = {}
    for key in pkg_keys:
        info = PACKAGES[key]
        for filename in info.get('unlock_files', {}).get(cfg['file_key'], []):
            root = parse_xml(info['pkg'], filename)
            if root is None:
                continue
            _apply_inline_unlock_layer(items, root, cfg=cfg, text_map=text_map)

    main: List[dict] = []
    wonders: List[dict] = []
    split = cfg.get('is_wonder_split', False)
    for entry in items.values():
        is_wonder = entry.pop('_is_wonder', False)
        if split and is_wonder:
            wonders.append(entry)
        else:
            main.append(entry)
    return main, wonders


# --------------------------- Civ/leader uniques ---------------------------

# Owners whose "uniques" aren't player-facing content. Barbarian rows are
# implementation detail; LEADER_DEFAULT is the shared major-civ template.
IGNORED_OWNERS = {'CIVILIZATION_BARBARIAN', 'LEADER_BARBARIAN', 'LEADER_DEFAULT'}


def _prettify_owner(owner_id: str) -> str:
    return (owner_id
            .replace('CIVILIZATION_', '')
            .replace('LEADER_', '')
            .replace('_', ' ')
            .title())


def collect_unique_owners(pkg_keys: List[str], text_map: Dict[str, str],
                          ) -> Tuple[Dict[str, str], Dict[str, str]]:
    """Walk the civilization and leader files for every layered package and
    return (trait -> owner id, owner id -> display name). Owners are
    CIVILIZATION_* or LEADER_* ids; traits come from CivilizationTraits /
    LeaderTraits. Later layers win, matching the game's stacking."""
    trait_owner: Dict[str, str] = {}
    owner_name: Dict[str, str] = {}

    tables = (
        ('civ_files',    'Civilizations', 'CivilizationType', 'CivilizationTraits'),
        ('leader_files', 'Leaders',       'LeaderType',       'LeaderTraits'),
    )
    for key in pkg_keys:
        info = PACKAGES[key]
        for files_key, main_table, id_attr, traits_table in tables:
            for fn in info.get(files_key, []):
                root = parse_xml(info['pkg'], fn)
                if root is None:
                    continue
                main = root.find(main_table)
                if main is not None:
                    for row in main.findall('Row'):
                        oid, name_key = row.get(id_attr), row.get('Name')
                        if oid and name_key:
                            owner_name[oid] = text_map.get(name_key) or _prettify_owner(oid)
                traits = root.find(traits_table)
                if traits is not None:
                    for row in traits.findall('Row'):
                        oid, trait = row.get(id_attr), row.get('TraitType')
                        if oid and trait:
                            trait_owner[trait] = oid
    return trait_owner, owner_name


def collect_replaces(pkg_keys: List[str], cfg: dict) -> Dict[str, str]:
    """Unique-id -> base-id map from the category's *Replaces table (which
    lives in the same XML files as the main unlock table). Empty for
    categories without one (improvements etc. — their uniques have no
    shared base version)."""
    replaces: Dict[str, str] = {}
    table = cfg.get('replaces_table')
    if not table:
        return replaces
    for key in pkg_keys:
        info = PACKAGES[key]
        for filename in info.get('unlock_files', {}).get(cfg['file_key'], []):
            root = parse_xml(info['pkg'], filename)
            if root is None:
                continue
            t = root.find(table)
            if t is None:
                continue
            for row in t.findall('Row'):
                u = row.get(cfg['replaces_unique_attr'])
                b = row.get(cfg['replaces_base_attr'])
                if u and b:
                    replaces[u] = b
    return replaces


def fold_uniques(items: List[dict], replaces: Dict[str, str],
                 trait_owner: Dict[str, str], owner_name: Dict[str, str],
                 used_owners: set) -> List[dict]:
    """Restructure a category so civ/leader uniques ride on their base item,
    matching the wrapped shape the Civ 3/4/5 data (and the tooltip's
    unique-variant rendering) already uses:

        replaced unique  -> base entry grows CIVILIZATION_ALL + owner-keyed
                            sub-objects; the unique's own flat entry is
                            dropped (its unlock now renders as a variant
                            chip on the base item, under the base item's
                            prereq — per-unique prereq differences are
                            collapsed, same as the older games' data)
        base-less unique -> stays its own entry, name moved into an
                            owner-keyed sub-object so the tooltip tags it
                            with its owner (Great Wall (China), Rough
                            Rider (Teddy Roosevelt))

    Entries whose trait has no known owner (or an IGNORED_OWNERS one, like
    barbarians) just lose the marker and stay flat."""
    by_id = {e['id']: e for e in items}
    removed: set = set()

    for entry in items:
        trait = entry.pop('_trait', None)
        if not trait:
            continue
        owner = trait_owner.get(trait)
        if not owner or owner in IGNORED_OWNERS:
            continue

        used_owners.add(owner)
        base = by_id.get(replaces.get(entry['id'], ''))
        if base is not None and base is not entry:
            if 'CIVILIZATION_ALL' not in base:
                base['CIVILIZATION_ALL'] = {'id': base['id'], 'name': base.pop('name')}
            base[owner] = {'id': entry['id'], 'name': entry['name']}
            removed.add(entry['id'])
        else:
            entry[owner] = {'id': entry['id'], 'name': entry.pop('name')}

    return [e for e in items if e['id'] not in removed]


# --------------------------- Driver ---------------------------

def build_civdata(game: str) -> dict:
    if game not in GAMES:
        raise ValueError(f'unknown --game {game!r}; expected {list(GAMES)}')
    pkg_keys, _ = GAMES[game]

    text_map = collect_text_map(pkg_keys)

    out: Dict[str, list] = {}

    out['technologies'] = build_nodes_for_tree(
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
    out['civics'] = build_nodes_for_tree(
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

    # Civ/leader-unique attribution: who owns each TRAIT_*, and display
    # names for the owners. Owners actually referenced by a unique are
    # collected so the output's `civilizations` array stays minimal.
    trait_owner, owner_name = collect_unique_owners(pkg_keys, text_map)
    used_owners: set = set()

    for category, cfg in UNLOCK_CATEGORIES.items():
        main, wonders = build_unlocks_for_category(pkg_keys, cfg, text_map)
        # Strip excluded ids from both the main and wonders lists.
        # Wonders share their source key with buildings, so apply the
        # `buildings` exclusion to both halves of the split. Exclusion
        # runs before the unique fold so an excluded unique doesn't come
        # back as a variant chip on its base item.
        excl_main = EXCLUDE_IDS.get(category, set())
        excl_won = EXCLUDE_IDS.get('wonders' if category == 'buildings' else category, set())
        replaces = collect_replaces(pkg_keys, cfg)
        out[category] = fold_uniques(
            [n for n in main if n['id'] not in excl_main],
            replaces, trait_owner, owner_name, used_owners)
        if cfg.get('is_wonder_split'):
            out['wonders'] = fold_uniques(
                [n for n in wonders if n['id'] not in excl_won],
                replaces, trait_owner, owner_name, used_owners)

    out['civilizations'] = [
        {'id': oid, 'name': owner_name.get(oid) or _prettify_owner(oid)}
        for oid in sorted(used_owners)
    ]

    return out


def write_output(out_path: str, data: dict, indent: int) -> None:
    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    with open(out_path, 'w') as f:
        json.dump(data, f, indent=indent if indent else None)


def run_one(game: str, indent: int) -> None:
    _, rel_out = GAMES[game]
    data = build_civdata(game)
    out_path = os.path.join(REPO_ROOT, rel_out)
    write_output(out_path, data, indent)
    counts = ', '.join(f'{len(data[k])} {k}' for k in data if isinstance(data[k], list) and data[k])
    print(f'[{game}] -> {rel_out}')
    print(f'         {counts}')


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
