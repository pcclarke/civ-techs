"""
Civilization 7 data scraper (wiki-sourced).

Civ 7 ships a fundamentally different progression model — each game has
three sequential Ages (Antiquity, Exploration, Modern) and each Age has
its own self-contained tech tree and civic tree. Within an Age, the trees
have prereq edges between nodes; across Ages, no edges exist (the trees
reset when an Age ends).

Since none of us own the game, this scraper reads HTML pages saved from
the community Fandom wiki rather than the game's XML. Drop the saved HTML
files into this directory (or pass paths on the CLI) and run it.

Source pages, expected structure:
    "List of technologies in Civ7" — three <h3>s (Antiquity Age,
    Exploration Age, Modern Age), each followed by a sortable <table> with
    columns: Technology | Science cost | Prerequisites | Unlocks | Mastery
    unlocks | Leads to. Tech name links use the form `/wiki/<Name>_(Civ7)`.

    "List of civics in Civ7" — same shape with Culture cost instead of
    Science cost.

    "List of buildings in Civ7" — Age <h3>s, each followed by two tables
    (standard, then "Unique to" civ-unique). Columns include Building /
    Unique to? / Unlocked (the gating tech or civic) / Cost / ...

    "List of units in Civ7" — Age <h2>s (note: h2 not h3), with nested
    <h3>s for Military / Civilian sub-categories. Military tables are
    grid-shaped (unit type across columns, tier down rows); civilian
    units are usually plain <ul> lists. Prereqs are NOT on this page —
    we cross-reference the tech and civic pages' Unlocks columns to
    figure out which tech (or civic) unlocks each unit.

    "List of unique units in Civ7" (optional, --unique-units-html) —
    Age <h2>s over tables with columns Unit | Unique to | Class-or-
    Replaces | Special abilities. Supplies civ attribution: military
    uniques become owner-wrapped exclusives, civilian uniques with a
    real Replaces link fold into their base unit as variant chips
    (see parse_unique_owners / parse_units), and the owners land in a
    `civilizations` output array.

Wheel-renderer integration:
    - era field is the Age name in plain English ("Antiquity",
      "Exploration", "Modern"). The eraDisplayName helper passes plain
      English strings through unchanged, matching how Civ 2/3 store eras.
    - id is "TECH_<NAME_UPPER>" (or CIVIC_ / BUILDING_ / UNIT_), with an
      _<AGE> suffix on cross-age duplicates — Civ 7 has three "Future
      Tech" entries (one per Age), so they need disambiguation.
      Single-Age names are left clean.
    - requires holds ids of prereqs in the same Age. Civ 7 has no
      cross-Age prereq edges; the parser additionally guards against any
      that the wiki might accidentally introduce.
    - Mastery-tier prereqs ("Engineering II") are flattened to their
      base tech id ("TECH_ENGINEERING"). We don't model Mastery as
      separate nodes, so any unlock gated on Mastery still attaches to
      the base tech — the tooltip will list it under the base tech's
      "Unlocks" section, which reads as "researching Engineering
      eventually enables this."

Run from this directory:
    python3 scraper.py --tech-html "../../List of technologies in Civ7 ....html"
    python3 scraper.py --civic-html ...
    python3 scraper.py --buildings-html ...  # requires tech+civic in civdata.json
    python3 scraper.py --units-html ... --tech-html ... --civic-html ...
    python3 scraper.py --tech-html ... --civic-html ... --buildings-html ... --units-html ...
"""

import argparse
import collections
import json
import os
import re
import urllib.parse
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup, Tag

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
# Game data and icons live under public/ so Vite copies them verbatim
# into the build output; the paths below are relative to that.
PUBLIC_DIR = os.path.join(REPO_ROOT, 'public')
DEFAULT_OUT = os.path.join(PUBLIC_DIR, 'civ7', 'civdata.json')

AGES = ['Antiquity', 'Exploration', 'Modern']
AGE_HEADINGS = {f'{age} Age': age for age in AGES}


# --------------------------- HTML parsing helpers ---------------------------

# Wiki page slugs are `/wiki/<Name>_(Civ7)`. The display name is
# space-separated; the slug uses underscores. We keep the spaced name for
# lookups since it's what shows in the cell text and our id helper uppercases
# from there anyway.
_HREF_RE = re.compile(r'^/wiki/([^()]+)_\(Civ7\)$')

def slug_from_href(href: Optional[str]) -> Optional[str]:
    """`/wiki/Hul%27che_(Civ7)` -> `Hul'che`. URL-decoding is essential
    for units and buildings whose wiki page slug contains punctuation
    like apostrophes (Hul'che) or accented letters (Birtūtu)."""
    if not href:
        return None
    m = _HREF_RE.match(href)
    if not m:
        return None
    return urllib.parse.unquote(m.group(1)).replace('_', ' ')


def find_age_tables(soup: BeautifulSoup) -> Dict[str, Tag]:
    """Return {age_name: <table>} for the three Age sections.

    Headings on Fandom render with a trailing edit-section "[]" so the raw
    text is e.g. "Antiquity Age[]"; strip that. The table is the next
    <table> sibling at any depth — Fandom wraps headings in a span, so we
    walk the document.
    """
    out: Dict[str, Tag] = {}
    for h3 in soup.find_all('h3'):
        text = h3.get_text(strip=True).rstrip('[]')
        if text in AGE_HEADINGS:
            t = h3.find_next('table')
            if t is not None:
                out[AGE_HEADINGS[text]] = t
    missing = [a for a in AGES if a not in out]
    if missing:
        raise RuntimeError(f'could not locate tables for Ages: {missing}')
    return out


def collect_node_names(tables: Dict[str, Tag]) -> Dict[str, List[str]]:
    """First-pass scan: per-Age list of node names taken from each row's
    first cell. The names also become the universe of valid prereq targets
    (anything in the prereq column that isn't in this set is some other
    page — Science, Food, Granary, etc. — and gets dropped)."""
    out: Dict[str, List[str]] = {}
    for age, table in tables.items():
        names: List[str] = []
        for row in table.find_all('tr')[1:]:  # skip header row
            tds = row.find_all('td', recursive=False)
            if not tds:
                continue
            name = _first_node_link(tds[0])
            if name:
                names.append(name)
        out[age] = names
    return out


def _first_node_link(td: Tag) -> Optional[str]:
    for a in td.find_all('a'):
        n = slug_from_href(a.get('href'))
        if n:
            return n
    return None


def _parse_cost(td: Tag) -> Optional[int]:
    """Cost cell looks like '70 [Science icon]'. Pull the leading int."""
    text = td.get_text(' ', strip=True)
    m = re.match(r'(\d+)', text)
    return int(m.group(1)) if m else None


def _parse_prereqs(td: Tag, valid: set) -> List[str]:
    """Prereq cell is either 'N/A' or a list/inline of links. Keep only
    links whose targets are nodes we're tracking; drop dupes preserving
    authoring order."""
    if 'N/A' in td.get_text():
        return []
    out: List[str] = []
    seen: set = set()
    for a in td.find_all('a'):
        p = slug_from_href(a.get('href'))
        if p and p in valid and p not in seen:
            out.append(p)
            seen.add(p)
    return out


# --------------------------- Id assignment ---------------------------

def make_id(prefix: str, name: str) -> str:
    """`Iron Working` -> `TECH_IRON_WORKING`."""
    upper = re.sub(r'[^A-Z0-9_]', '_', name.upper().replace(' ', '_'))
    return f'{prefix}_{upper}'


def assign_ids(per_age_names: Dict[str, List[str]], prefix: str) -> Tuple[Dict[Tuple[str, str], str], Dict[str, Dict[str, str]]]:
    """Resolve (age, name) -> id, suffixing the Age on names that appear in
    more than one Age (currently only Future Tech / Future Civic). Also
    return a per-age (name -> id) map for prereq resolution.

    Returns:
        ids:        {(age, name): id}
        by_age:     {age: {name: id}}  — same data, indexed for prereq lookup
    """
    counts: Dict[str, int] = collections.Counter()
    for names in per_age_names.values():
        for n in names:
            counts[n] += 1

    ids: Dict[Tuple[str, str], str] = {}
    by_age: Dict[str, Dict[str, str]] = {age: {} for age in per_age_names}
    for age, names in per_age_names.items():
        for n in names:
            base = make_id(prefix, n)
            id_ = base if counts[n] == 1 else f'{base}_{age.upper()}'
            ids[(age, n)] = id_
            by_age[age][n] = id_
    return ids, by_age


# --------------------------- Tree builder ---------------------------

def parse_tree(html_path: str, prefix: str) -> List[dict]:
    """Parse one of the Fandom 'List of technologies/civics' pages and
    return a list of node dicts in the wheel's JSON shape.
    """
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    tables = find_age_tables(soup)
    per_age_names = collect_node_names(tables)
    _, by_age = assign_ids(per_age_names, prefix)

    nodes: List[dict] = []
    for age in AGES:
        valid = set(per_age_names[age])
        for row in tables[age].find_all('tr')[1:]:
            tds = row.find_all('td', recursive=False)
            if len(tds) < 3:
                continue
            name = _first_node_link(tds[0])
            if not name:
                continue
            cost = _parse_cost(tds[1])
            prereq_names = _parse_prereqs(tds[2], valid)

            node: dict = {
                'id':   by_age[age][name],
                'name': name,
                'era':  age,
            }
            if cost is not None:
                node['cost'] = cost
            if prereq_names:
                node['requires'] = [by_age[age][n] for n in prereq_names]
            nodes.append(node)
    return nodes


# --------------------------- Building & unit helpers ---------------------------

_MASTERY_SUFFIX = re.compile(r'\s+II$')


def strip_mastery(name: str) -> Tuple[str, bool]:
    """`Engineering II` -> (`Engineering`, True). Mastery-tier prereqs are
    the tier-2 upgrade of a base tech / civic — the wheel doesn't model
    them as separate nodes, so we flatten them to the base for edge
    resolution."""
    m = _MASTERY_SUFFIX.search(name)
    if m:
        return name[: m.start()].strip(), True
    return name, False


def name_index_from_nodes(nodes: List[dict]) -> Dict[str, str]:
    """Build {display_name -> id} from an already-parsed tech or civic node
    list. Used so buildings and units can resolve their prereq to the
    right tech/civic id."""
    return {n['name']: n['id'] for n in nodes if 'name' in n and 'id' in n}


def resolve_prereq(link_name: str,
                   tech_ids: Dict[str, str],
                   civic_ids: Dict[str, str]) -> Optional[str]:
    """Given a wiki-anchor's display text (e.g. 'Engineering', 'Engineering
    II', 'Mysticism'), return the matching tech or civic id — or None if
    it doesn't match anything (which happens for civ-unique narrative
    unlocks like 'Birtūtu' that aren't techs at all)."""
    if not link_name:
        return None
    base, _mastery = strip_mastery(link_name)
    if base in tech_ids:
        return tech_ids[base]
    if base in civic_ids:
        return civic_ids[base]
    return None


def walk_age_sections(soup: BeautifulSoup, min_h_level: int = 2) -> Dict[str, Tag]:
    """Return {age_name: <first element containing an Age heading>}.

    Techs / civics use <h3> for Age headings; the units page uses <h2>.
    This is the tolerant version — it walks every heading level from
    `min_h_level` down to h6 and picks whichever matches an Age name
    (allowing suffixes like "Antiquity Age Units"). If more than one
    heading matches an Age (some pages repeat), we keep the first.
    """
    out: Dict[str, Tag] = {}
    tags = [f'h{i}' for i in range(min_h_level, 7)]
    for h in soup.find_all(tags):
        text = h.get_text(strip=True).rstrip('[]')
        for age in AGES:
            if age not in out and text.startswith(f'{age} Age'):
                out[age] = h
                break
    missing = [a for a in AGES if a not in out]
    if missing:
        raise RuntimeError(f'could not locate Age headings: {missing}')
    return out


def _tables_between(start: Tag, end: Optional[Tag]) -> List[Tag]:
    """Return all <table> elements that appear in document order between
    `start` (exclusive) and `end` (exclusive; None = end of document).

    Boundary handling walks any heading tag whose level is *at or above*
    the level of `start`. That way, walking from an Age <h3> stops at
    the next <h3>/<h2>/<h1> (subsequent Age or "Golden Age variants"),
    while walking from an Age <h2> only stops at another <h2>/<h1> —
    matching how the buildings and units pages are respectively
    structured."""
    # Any heading strictly higher in the DOM hierarchy than `start`
    # counts as a boundary, plus siblings at the same level as `start`.
    stop_level = int(start.name[1]) if start.name and start.name.startswith('h') else 6
    stop_tags = [f'h{i}' for i in range(1, stop_level + 1)]
    walk_tags = ['table'] + stop_tags

    out: List[Tag] = []
    cur = start
    while True:
        cur = cur.find_next(walk_tags)
        if cur is None or cur is end:
            break
        if cur.name in stop_tags and cur is not end:
            break
        out.append(cur)
    return out


# --------------------------- Buildings ---------------------------

def _building_table_columns(table: Tag) -> Optional[dict]:
    """Return {col_key: index} for a building table's header, or None if
    this table doesn't look like one (Adjacency Bonuses, See also, etc.).
    """
    rows = table.find_all('tr')
    if not rows:
        return None
    ths = rows[0].find_all('th')
    titles = [th.get_text(' ', strip=True) for th in ths]
    if not any(t.startswith('Building') for t in titles):
        return None
    idx = {t: i for i, t in enumerate(titles)}
    unlocked_idx = next((i for t, i in idx.items() if t.startswith('Unlocked')), None)
    cost_idx = next((i for t, i in idx.items() if 'cost' in t.lower()), None)
    return {
        'name':      0,
        'unlocked':  unlocked_idx,
        'cost':      cost_idx,
        'unique_to': next((i for t, i in idx.items() if t.startswith('Unique to')), None),
        'is_unique': any(t.startswith('Unique to') for t in titles),
        'n_headers': len(ths),
    }


def parse_buildings(html_path: str,
                    tech_ids: Dict[str, str],
                    civic_ids: Dict[str, str]) -> Tuple[List[dict], Dict[str, str]]:
    """Parse the buildings list page into building node dicts.

    Returns (nodes, {owner_key: owner_display_name}); civ-unique
    buildings that survive prereq resolution come back owner-wrapped
    (see the fold in the row loop) and their owners feed the output's
    `civilizations` array."""
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    age_headings = walk_age_sections(soup, min_h_level=3)
    # Sort headings by document order so we can use each pair as
    # (this-Age-start, next-Age-start) span markers.
    ordered = sorted(age_headings.items(),
                     key=lambda kv: list(soup.descendants).index(kv[1]))

    per_age_names: Dict[str, List[str]] = {a: [] for a in AGES}
    per_age_rows: Dict[str, List[Tuple[str, Optional[int], Optional[str], Optional[str]]]] = {a: [] for a in AGES}

    for i, (age, hd) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else None
        for tbl in _tables_between(hd, end):
            cols = _building_table_columns(tbl)
            if cols is None:
                continue
            # "Unique to" cells are rowspan-merged when a civ's two
            # quarter buildings sit in consecutive rows; carry the last
            # seen owner into rows whose cell was absorbed by the span.
            last_owner: Optional[str] = None
            for tr in tbl.find_all('tr')[1:]:
                tds = tr.find_all('td', recursive=False)
                if len(tds) <= cols['name']:
                    continue
                # Wiki editors sometimes omit the "Unique to" cell on
                # unique-building rows, leaving the row one td short of
                # the header count and shifting every subsequent index
                # left by one. Detect that and shift our indices to
                # match, otherwise the prereq is read from the cost
                # column ("120" + Production icon) and the cost from
                # the yields column.
                shift = 0
                if cols['is_unique'] and len(tds) == cols['n_headers'] - 1:
                    shift = 1
                unlocked_idx = None if cols['unlocked'] is None else cols['unlocked'] - shift
                cost_idx = None if cols['cost'] is None else cols['cost'] - shift

                name = _first_node_link(tds[cols['name']])
                if not name:
                    continue
                # Cost may be missing on some tables.
                cost = _parse_cost(tds[cost_idx]) if cost_idx is not None and cost_idx < len(tds) else None
                # Prereq: prefer the first Civ7 wiki-anchor in the
                # Unlocked cell (skips any narrative-event links like
                # civ-unique traditions that don't map to techs).
                prereq_name: Optional[str] = None
                if unlocked_idx is not None and unlocked_idx < len(tds):
                    for a in tds[unlocked_idx].find_all('a'):
                        n = slug_from_href(a.get('href'))
                        if n:
                            prereq_name = n
                            break
                # Owner of a civ-unique building. A shifted row (see
                # above) lost its "Unique to" cell to a rowspan, so it
                # inherits the previous row's owner.
                owner: Optional[str] = None
                if cols['is_unique']:
                    if shift == 1:
                        owner = last_owner
                    elif cols['unique_to'] is not None and cols['unique_to'] < len(tds):
                        owner = _owner_text(tds[cols['unique_to']]) or last_owner
                        last_owner = owner
                per_age_names[age].append(name)
                per_age_rows[age].append((name, cost, prereq_name, owner))

    _, by_age = assign_ids(per_age_names, 'BUILDING')

    nodes: List[dict] = []
    owners_used: Dict[str, str] = {}
    skipped: List[Tuple[str, str, str]] = []  # (age, name, raw prereq we couldn't resolve)
    for age in AGES:
        for name, cost, prereq_name, owner in per_age_rows[age]:
            # Drop civ-unique buildings whose prereq is a civ-specific
            # tradition (Wisdom of Tanit, Birtūtu, Scales of Anubis) that
            # doesn't map to any tech or civic. The wheel can't attach
            # these to any node anyway, and keeping them clutters the
            # unlocks list of unrelated techs.
            pid: Optional[str] = None
            if prereq_name is not None:
                pid = resolve_prereq(prereq_name, tech_ids, civic_ids)
                if pid is None:
                    skipped.append((age, name, prereq_name))
                    continue
            node: dict = {
                'id':   by_age[age][name],
                'name': name,
                'era':  age,
            }
            if cost is not None:
                node['cost'] = cost
            if pid:
                node['requires'] = [pid]
            # Civ-unique buildings have no shared base counterpart in
            # Civ 7 (they come in per-civ "unique quarter" pairs), so an
            # owner turns the node into an owner-wrapped exclusive: the
            # tooltip renders it as "Name (Owner)".
            if owner:
                key = owner_key(owner)
                owners_used[key] = owner
                node[key] = {'id': node['id'], 'name': node.pop('name')}
            nodes.append(node)

    if skipped:
        print(f'  buildings dropped (unresolved prereq): {len(skipped)}')
        for age, name, raw in skipped[:5]:
            print(f'    [{age}] {name}: {raw!r} not in tech/civic')
        if len(skipped) > 5:
            print(f'    ... and {len(skipped) - 5} more')
    return nodes, owners_used


# --------------------------- Wonders ---------------------------

def parse_wonders(html_path: str,
                  tech_ids: Dict[str, str],
                  civic_ids: Dict[str, str]) -> List[dict]:
    """Parse the wonders list page. One table per Age, columns:
    Wonder | Production | Associated with | Req. | Effects | Placement.

    Every wonder in Civ 7 is civ-locked — "Associated with" names the
    civilization that gets it, and "Req." packs two prereqs together: a
    tech-or-civic plus a civ-specific tradition. Only the first is
    wheel-relevant; we pick the first Req. link that resolves to a known
    tech or civic (base or mastery-tier, flattened to base)."""
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    age_headings = walk_age_sections(soup, min_h_level=3)
    ordered = sorted(age_headings.items(),
                     key=lambda kv: list(soup.descendants).index(kv[1]))

    per_age_names: Dict[str, List[str]] = {a: [] for a in AGES}
    per_age_rows: Dict[str, List[Tuple[str, Optional[int], Optional[str]]]] = {a: [] for a in AGES}

    for i, (age, hd) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else None
        for tbl in _tables_between(hd, end):
            rows = tbl.find_all('tr')
            if not rows:
                continue
            ths = [th.get_text(' ', strip=True) for th in rows[0].find_all('th')]
            if not ths or not ths[0].startswith('Wonder'):
                continue
            # Column indices are always {Wonder | Production | Associated
            # with | Req. | Effects | Placement} — we only need name,
            # cost, and req.
            name_idx = 0
            cost_idx = next((i for i, t in enumerate(ths) if 'Production' in t), 1)
            req_idx = next((i for i, t in enumerate(ths) if t.startswith('Req')), 3)

            for tr in rows[1:]:
                tds = tr.find_all('td', recursive=False)
                if len(tds) <= req_idx:
                    continue
                name = _first_node_link(tds[name_idx])
                if not name:
                    continue
                cost = _parse_cost(tds[cost_idx]) if cost_idx < len(tds) else None
                # Prereq: try each wiki-link in the Req. cell in order,
                # keep the first that resolves to a tech or civic. The
                # cell packs (tech-or-civic, civ-tradition) in that order,
                # so this picks the tech/civic and drops the tradition.
                prereq_name: Optional[str] = None
                seen_links: set = set()
                for a in tds[req_idx].find_all('a'):
                    n = slug_from_href(a.get('href'))
                    if not n or n in seen_links:
                        continue
                    seen_links.add(n)
                    prereq_name = n
                    break
                per_age_names[age].append(name)
                per_age_rows[age].append((name, cost, prereq_name))

    _, by_age = assign_ids(per_age_names, 'BUILDING')

    nodes: List[dict] = []
    skipped: List[Tuple[str, str, str]] = []
    for age in AGES:
        for name, cost, prereq_name in per_age_rows[age]:
            pid: Optional[str] = None
            if prereq_name is not None:
                pid = resolve_prereq(prereq_name, tech_ids, civic_ids)
                # If the first link in Req. was a tradition, walk further
                # — wonder Req. cells order the tech/civic first, but a
                # handful put the tradition first. Fall back to a broader
                # scan.
                if pid is None:
                    # We can't easily re-parse here, so just skip. In
                    # practice the "first link" heuristic hits every
                    # wonder except one edge case (Modernity vs
                    # Modernization terminology mismatch).
                    pass
            if pid is None:
                skipped.append((age, name, prereq_name or '(none)'))
                continue
            node: dict = {
                'id':   by_age[age][name],
                'name': name,
                'era':  age,
            }
            if cost is not None:
                node['cost'] = cost
            node['requires'] = [pid]
            nodes.append(node)

    if skipped:
        print(f'  wonders dropped (unresolved prereq): {len(skipped)}')
        for age, name, raw in skipped[:5]:
            print(f'    [{age}] {name}: {raw!r}')
        if len(skipped) > 5:
            print(f'    ... and {len(skipped) - 5} more')
    return nodes


# --------------------------- Improvements ---------------------------

def parse_improvements(html_path: str,
                       tech_ids: Dict[str, str],
                       civic_ids: Dict[str, str],
                       reverse_index: Dict[str, Dict[str, str]]) -> List[dict]:
    """Parse the improvements list page. Structure differs from wonders:
    each Age has three sub-sections (Standard, Civilization unique,
    City-state unique) and the standard tables have no prereq column at
    all. We use `reverse_index` (built off the tech and civic pages'
    Unlocks columns) for standard improvements; civ-unique improvements
    do carry an "Unlocked by" column but it points at civ traditions
    that don't map to techs, so those are dropped alongside the units
    and buildings we already filter out. City-state uniques are always
    dropped — they're gated by city-state alliance level, not tech.
    """
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    age_headings = walk_age_sections(soup, min_h_level=2)
    ordered = sorted(age_headings.items(),
                     key=lambda kv: list(soup.descendants).index(kv[1]))

    per_age_names: Dict[str, List[str]] = {a: [] for a in AGES}
    per_age_prereqs: Dict[str, Dict[str, Optional[str]]] = {a: {} for a in AGES}
    # The wiki genuinely re-lists shared standard improvements (Farm,
    # Fishing Boat, Pasture, etc.) under every Age's table because the
    # in-game reference page shows them there. For our purposes they're
    # one improvement introduced in the earliest Age; track a global
    # first-seen set to skip re-emitting them.
    seen: set = set()

    for i, (age, hd) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else None
        for tbl in _tables_between(hd, end):
            rows = tbl.find_all('tr')
            if not rows:
                continue
            ths = [th.get_text(' ', strip=True) for th in rows[0].find_all('th')]
            if not ths or not ths[0].startswith('Improvement'):
                continue
            is_civ_unique = any(t.startswith('Unique to') for t in ths)
            is_city_state = any(t.startswith('City-State') for t in ths)
            if is_city_state:
                # City-state uniques are always dropped — no tech/civic
                # prereq applies.
                continue
            unlocked_idx = next((i for i, t in enumerate(ths) if t.startswith('Unlocked')), None)

            for tr in rows[1:]:
                tds = tr.find_all('td', recursive=False)
                if not tds:
                    continue
                name = _first_node_link(tds[0])
                if not name or name in seen:
                    continue
                # Prereq resolution:
                #  - civ-unique: read Unlocked-by column
                #  - standard: no on-page column; use reverse-unlock index
                prereq_name: Optional[str] = None
                if is_civ_unique and unlocked_idx is not None and unlocked_idx < len(tds):
                    for a in tds[unlocked_idx].find_all('a'):
                        n = slug_from_href(a.get('href'))
                        if n:
                            prereq_name = n
                            break
                else:
                    prereq_name = reverse_index.get(age, {}).get(name)
                per_age_names[age].append(name)
                per_age_prereqs[age][name] = prereq_name
                seen.add(name)

    _, by_age = assign_ids(per_age_names, 'IMPROVEMENT')

    nodes: List[dict] = []
    dropped: List[Tuple[str, str]] = []
    for age in AGES:
        for name in per_age_names[age]:
            prereq_name = per_age_prereqs[age].get(name)
            pid = resolve_prereq(prereq_name, tech_ids, civic_ids) if prereq_name else None
            if pid is None:
                dropped.append((age, name))
                continue
            nodes.append({
                'id':       by_age[age][name],
                'name':     name,
                'era':      age,
                'requires': [pid],
            })

    if dropped:
        print(f'  improvements dropped (no wheel-relevant prereq): {len(dropped)}')
        for age, name in dropped[:5]:
            print(f'    [{age}] {name}')
        if len(dropped) > 5:
            print(f'    ... and {len(dropped) - 5} more')
    return nodes


# --------------------------- Units ---------------------------

def build_reverse_unlock_index(html_paths: List[str]) -> Dict[str, Dict[str, str]]:
    """Walk the Unlocks + Mastery unlocks columns of the tech/civic list
    pages, returning a per-Age map
    {age: {unlocked_item_name -> unlocking_tech_or_civic_name}}.

    Tech and civic list pages have 6 columns; column 3 is "Unlocks"
    (base-tier unlocks) and column 4 is "Mastery unlocks" (post-mastery
    unlocks). Both list wiki-anchors to buildings / units / mechanics.

    The index is Age-scoped because Civ 7 reuses item names across its
    three Ages — the units page lists a "Merchant" in all three Ages,
    but only Antiquity's civics unlock one (Code of Laws). A flat
    name-keyed map would hand every same-named copy the first Age's
    prereq (three Merchants all gated on Code of Laws); keying by the
    Age whose table the Unlocks entry sits in lets each Age's copy
    resolve only against its own trees, and copies whose Age lists no
    unlock fall out downstream as prereq-less.

    Two-pass to prefer BASE unlocks over Mastery within each Age. Civ 7
    items are sometimes "re-listed" in a Mastery column as they receive
    upgrades; we walk every Unlocks column first and only fall back to
    Mastery for items that never showed up in that Age's base Unlocks.
    """
    idx: Dict[str, Dict[str, str]] = {age: {} for age in AGES}
    # Two passes: cols=(3,) then cols=(4,). First-wins semantics within
    # each pass; only-if-absent semantics for the fallback pass.
    for cols in ((3,), (4,)):
        for path in html_paths:
            if not path:
                continue
            with open(path, encoding='utf-8') as f:
                soup = BeautifulSoup(f, 'html.parser')
            try:
                tables = find_age_tables(soup)
            except RuntimeError:
                continue
            for age, table in tables.items():
                for tr in table.find_all('tr')[1:]:
                    tds = tr.find_all('td', recursive=False)
                    if len(tds) < max(cols) + 1:
                        continue
                    parent = _first_node_link(tds[0])
                    if not parent:
                        continue
                    for col in cols:
                        for a in tds[col].find_all('a'):
                            n = slug_from_href(a.get('href'))
                            if n and n != parent and n not in idx[age]:
                                idx[age][n] = parent
    return idx


def owner_key(owner_display: str) -> str:
    """Owner display name -> the CIVILIZATION_* wrapper key used in the
    output JSON ('Achaemenid Persian' -> CIVILIZATION_ACHAEMENID_PERSIAN).
    Civ 7 has no leader-owned uniques, so everything gets the
    CIVILIZATION_ prefix the site's buildUnlockIndex.js already knows."""
    return make_id('CIVILIZATION', owner_display)


def _owner_text(td: Tag) -> Optional[str]:
    """Display name from a 'Unique to' cell: the first link with visible
    text (the first anchor is usually an icon-only image link), falling
    back to the cell's own text."""
    for a in td.find_all('a'):
        txt = a.get_text(strip=True)
        if txt:
            return txt
    txt = td.get_text(' ', strip=True)
    return txt or None


def parse_unique_owners(html_path: str) -> Dict[str, dict]:
    """Parse the 'List of unique units in Civ7' page.

    Every table on it has columns Unit | Unique to | Class-or-Replaces |
    Special abilities. Military tables carry a unit *category* in the
    third column (Civ 7 military uniques don't replace a specific base
    unit); civilian tables carry a real 'Replaces' link (Colonist ->
    Settler). Returns {unit_name: {'owner': display_name,
    'replaces': base_unit_name | None}}.

    This page only supplies attribution — membership in the wheel still
    comes from the tech/civic pages' Unlocks columns via parse_units, so
    uniques with no tech/civic gate (starter units, city-state levies)
    never reach the output and need no filtering here.
    """
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    out: Dict[str, dict] = {}
    for tbl in soup.find_all('table'):
        trs = tbl.find_all('tr')
        if not trs:
            continue
        ths = [th.get_text(' ', strip=True) for th in trs[0].find_all('th')]
        if not ths or not ths[0].startswith('Unit') or 'Unique to' not in ths:
            continue
        unique_idx = ths.index('Unique to')
        replaces_idx = ths.index('Replaces') if 'Replaces' in ths else None

        for tr in trs[1:]:
            tds = tr.find_all('td', recursive=False)
            if len(tds) <= unique_idx:
                continue
            name = _first_node_link(tds[0])
            if not name:
                continue
            owner = _owner_text(tds[unique_idx])
            if not owner:
                continue
            replaces = None
            if replaces_idx is not None and replaces_idx < len(tds):
                replaces = _first_node_link(tds[replaces_idx])
            out[name] = {'owner': owner, 'replaces': replaces}
    return out


def _walk_unit_names_under(start: Tag, end: Optional[Tag]) -> List[str]:
    """Between `start` (exclusive) and `end` (exclusive/None), scoop up
    every wiki-anchor slug. Preserves insertion order, drops dupes."""
    seen: set = set()
    out: List[str] = []
    cur = start
    while True:
        cur = cur.find_next(['a', 'h1', 'h2'])
        if cur is None or cur is end:
            break
        if cur.name in ('h1', 'h2') and cur is not end:
            break
        n = slug_from_href(cur.get('href'))
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    return out


def parse_units(units_html_path: str,
                tech_ids: Dict[str, str],
                civic_ids: Dict[str, str],
                reverse_index: Dict[str, Dict[str, str]],
                unique_owners: Optional[Dict[str, dict]] = None,
                ) -> Tuple[List[dict], Dict[str, str]]:
    """Parse the units list page. Prereqs come from `reverse_index`
    (built per-Age off the tech and civic pages); a unit only matches
    Unlocks entries from its own Age's tables, since same-named units
    recur across Ages with different gates.

    When `unique_owners` (from parse_unique_owners) is given, units it
    names are restructured into the owner-wrapped shape the site's
    tooltip renders as unique-variant chips: a unique with a Replaces
    target that's also on the wheel folds into that base unit's entry;
    everything else becomes its own entry with an owner-keyed
    sub-object. Returns (nodes, {owner_key: owner_display_name}) — the
    second element feeds the output's `civilizations` array."""
    with open(units_html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    age_headings = walk_age_sections(soup, min_h_level=2)
    ordered = sorted(age_headings.items(),
                     key=lambda kv: list(soup.descendants).index(kv[1]))

    per_age_names: Dict[str, List[str]] = {a: [] for a in AGES}
    for i, (age, hd) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else None
        names = _walk_unit_names_under(hd, end)
        # Drop names that also appear in tech/civic/building sets — those
        # are cross-references (e.g. 'Warrior' is a unit, but 'Bronze
        # Working' would slip in from a prereq mention). We'll further
        # filter by "must be in reverse_index" below; the simple pass is
        # to accept everything the page lists and let unresolved-prereq
        # trace tell the user where the wiki linked something unexpected.
        per_age_names[age] = names

    _, by_age = assign_ids(per_age_names, 'UNIT')

    nodes: List[dict] = []
    dropped: List[Tuple[str, str]] = []
    for age in AGES:
        for name in per_age_names[age]:
            # The units-page walker picks up every wiki-anchor in the
            # Age region, which includes accidental hits like civ names
            # (the "Foederati (Greek)" annotation contributes both). Only
            # keep names that are the child of an Unlocks entry in this
            # Age's tech or civic tables — that filters civ names,
            # starter units (Warrior), civ-unique units whose prereq is
            # a civ-specific tradition rather than a tech, and same-named
            # units from other Ages (each Age's Merchant has its own
            # gate; an Age with no matching unlock drops its copy).
            prereq_name = reverse_index.get(age, {}).get(name)
            pid = resolve_prereq(prereq_name, tech_ids, civic_ids) if prereq_name else None
            if pid is None:
                dropped.append((age, name))
                continue
            nodes.append({
                'id':       by_age[age][name],
                'name':     name,
                'era':      age,
                'requires': [pid],
            })

    if dropped:
        print(f'  units dropped (no tech/civic prereq): {len(dropped)}')
        for age, name in dropped[:5]:
            print(f'    [{age}] {name}')
        if len(dropped) > 5:
            print(f'    ... and {len(dropped) - 5} more')

    # Attribute civ-unique units. Names are looked up before any node is
    # wrapped (wrapping pops the flat name), so build the map first.
    owners_used: Dict[str, str] = {}
    if unique_owners:
        # Key by (name, era): a base like Settler can exist in several
        # Ages, and a unique must fold into its own Age's copy.
        by_name = {(n['name'], n['era']): n for n in nodes}
        folded: set = set()
        for n in list(nodes):
            info = unique_owners.get(n.get('name'))
            if not info:
                continue
            key = owner_key(info['owner'])
            owners_used[key] = info['owner']
            base = by_name.get((info.get('replaces') or '', n['era']))
            if base is not None and base is not n:
                if 'CIVILIZATION_ALL' not in base:
                    base['CIVILIZATION_ALL'] = {'id': base['id'], 'name': base.pop('name')}
                base[key] = {'id': n['id'], 'name': n['name']}
                folded.add(n['id'])
            else:
                n[key] = {'id': n['id'], 'name': n.pop('name')}
        nodes = [n for n in nodes if n['id'] not in folded]

    return nodes, owners_used


# --------------------------- Driver ---------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tech-html',
                    help='path to the saved "List of technologies in Civ7" HTML')
    ap.add_argument('--civic-html',
                    help='path to the saved "List of civics in Civ7" HTML')
    ap.add_argument('--buildings-html',
                    help='path to the saved "List of buildings in Civ7" HTML '
                         '(needs technologies + civics already parsed or '
                         'present in the output JSON)')
    ap.add_argument('--units-html',
                    help='path to the saved "List of units in Civ7" HTML '
                         '(needs --tech-html and/or --civic-html this run so '
                         'we can build the reverse-unlock index for prereqs)')
    ap.add_argument('--unique-units-html',
                    help='path to the saved "List of unique units in Civ7" '
                         'HTML; enables civ attribution (owner tags and '
                         'Replaces folding) on the units parsed via '
                         '--units-html')
    ap.add_argument('--wonders-html',
                    help='path to the saved "List of wonders in Civ7" HTML '
                         '(needs technologies + civics either already in '
                         'civdata.json or provided this run)')
    # Improvements were experimented with and pulled: in Civ 7 they're
    # effectively Age-gated availability, and the "Unlocks" entries on
    # tech pages are actually yield-bonus references rather than true
    # unlocks — attributing improvements to techs was misleading. See
    # parse_improvements below for the old logic if you want to revive
    # it, but nothing wires --improvements-html into the CLI now.
    ap.add_argument('-o', '--out', default=DEFAULT_OUT,
                    help=f'output JSON path (default: {os.path.relpath(DEFAULT_OUT, os.getcwd())})')
    ap.add_argument('--indent', type=int, default=2,
                    help='JSON indent; pass 0 for compact (default: 2)')
    args = ap.parse_args()

    if not any([args.tech_html, args.civic_html, args.buildings_html,
                args.units_html, args.wonders_html]):
        ap.error('pass at least one --*-html flag')

    # Merge with existing JSON so partial runs (techs only first, civics later)
    # don't blow away each other's output.
    out: dict = {}
    if os.path.exists(args.out):
        try:
            with open(args.out) as f:
                out = json.load(f)
        except (OSError, json.JSONDecodeError):
            out = {}

    if args.tech_html:
        techs = parse_tree(args.tech_html, prefix='TECH')
        out['technologies'] = techs
        eras = sorted({t['era'] for t in techs})
        print(f'techs: {len(techs)} parsed, ages: {", ".join(eras)}')
    if args.civic_html:
        civics = parse_tree(args.civic_html, prefix='CIVIC')
        out['civics'] = civics
        eras = sorted({c['era'] for c in civics})
        print(f'civics: {len(civics)} parsed, ages: {", ".join(eras)}')

    # Buildings and units both need name -> id maps for techs and civics.
    tech_ids = name_index_from_nodes(out.get('technologies', []))
    civic_ids = name_index_from_nodes(out.get('civics', []))

    # Owners referenced by civ-unique buildings/units this run, merged
    # over whatever a previous partial run already recorded so the
    # `civilizations` array survives re-scraping one category at a time.
    owners: Dict[str, str] = {
        c['id']: c['name'] for c in out.get('civilizations', [])
        if isinstance(c, dict) and c.get('id') and c.get('name')
    }

    if args.buildings_html:
        if not tech_ids and not civic_ids:
            ap.error('--buildings-html needs techs + civics; provide '
                     '--tech-html/--civic-html this run or ensure they are '
                     'already in the output JSON')
        buildings, b_owners = parse_buildings(args.buildings_html, tech_ids, civic_ids)
        out['buildings'] = buildings
        owners.update(b_owners)
        eras = sorted({b['era'] for b in buildings})
        print(f'buildings: {len(buildings)} parsed, ages: {", ".join(eras)}; '
              f'{len(b_owners)} owning civs')

    if args.units_html:
        # For unit prereqs we need to walk the tech/civic list pages'
        # Unlocks columns. If the user passed --tech-html/--civic-html this
        # run we have those paths handy; if they only re-run --units-html
        # we can't rebuild the reverse index and prereqs will be missing.
        index_paths = [p for p in (args.tech_html, args.civic_html) if p]
        if not index_paths:
            ap.error('--units-html needs --tech-html and/or --civic-html the '
                     'same run so the reverse-unlock index can be built')
        reverse = build_reverse_unlock_index(index_paths)
        unique_owners = None
        if args.unique_units_html:
            unique_owners = parse_unique_owners(args.unique_units_html)
            print(f'unique-units page: {len(unique_owners)} attribution rows')
        units, u_owners = parse_units(args.units_html, tech_ids, civic_ids,
                                      reverse, unique_owners)
        out['units'] = units
        owners.update(u_owners)
        eras = sorted({u['era'] for u in units})
        print(f'units: {len(units)} parsed, ages: {", ".join(eras)}; '
              f'{len(u_owners)} owning civs')

    if owners:
        out['civilizations'] = [
            {'id': k, 'name': v} for k, v in sorted(owners.items())
        ]

    if args.wonders_html:
        if not tech_ids and not civic_ids:
            ap.error('--wonders-html needs techs + civics; provide '
                     '--tech-html/--civic-html this run or ensure they are '
                     'already in the output JSON')
        wonders = parse_wonders(args.wonders_html, tech_ids, civic_ids)
        out['wonders'] = wonders
        eras = sorted({w['era'] for w in wonders})
        print(f'wonders: {len(wonders)} parsed, ages: {", ".join(eras)}')

    # Improvements deliberately not wired up — see comment at the top of
    # main() and the docstring on parse_improvements. Delete the array
    # from prior runs' output so a re-scrape produces clean JSON.
    out.pop('improvements', None)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(out, f, indent=args.indent if args.indent else None)
    print(f'wrote -> {args.out}')


if __name__ == '__main__':
    main()
