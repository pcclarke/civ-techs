"""
Civilization 7 data scraper (wiki-sourced).

Civ 7 ships a fundamentally different progression model — each game has
three sequential Ages (Antiquity, Exploration, Modern) and each Age has
its own self-contained tech tree and civic tree. Within an Age, the trees
have prereq edges between nodes; across Ages, no edges exist (the trees
reset when an Age ends).

Since none of us own the game, this scraper reads HTML pages saved from
the community Fandom wiki rather than the game's XML. Drop the saved HTML
files into this directory (or pass --tech-html / --civic-html) and run it.

Source pages, expected structure:
    "List of technologies in Civ7" — three <h3>s (Antiquity Age,
    Exploration Age, Modern Age), each followed by a sortable <table> with
    columns: Technology | Science cost | Prerequisites | Unlocks | Mastery
    unlocks | Leads to. Tech name links use the form `/wiki/<Name>_(Civ7)`.

    "List of civics in Civ7" — same shape with Culture cost instead of
    Science cost.

Wheel-renderer integration:
    - era field is the Age name in plain English ("Antiquity",
      "Exploration", "Modern"). The eraDisplayName helper passes plain
      English strings through unchanged, matching how Civ 2/3 store eras.
    - id is "TECH_<NAME_UPPER>" (or CIVIC_), with an _<AGE> suffix on
      cross-age duplicates — Civ 7 has three "Future Tech" entries (one per
      Age), so they need disambiguation. Single-Age names are left clean.
    - requires holds ids of prereqs in the same Age. Civ 7 has no
      cross-Age prereq edges; the parser additionally guards against any
      that the wiki might accidentally introduce.

Run from this directory:
    python3 scraper.py --tech-html ../../List\\ of\\ technologies\\ in\\ Civ7\\ ...html
    python3 scraper.py --civic-html ...html
    python3 scraper.py --tech-html ... --civic-html ... --out ../../civ7/civdata.json
"""

import argparse
import collections
import json
import os
import re
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup, Tag

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DEFAULT_OUT = os.path.join(REPO_ROOT, 'civ7', 'civdata.json')

AGES = ['Antiquity', 'Exploration', 'Modern']
AGE_HEADINGS = {f'{age} Age': age for age in AGES}


# --------------------------- HTML parsing helpers ---------------------------

# Wiki page slugs are `/wiki/<Name>_(Civ7)`. The display name is
# space-separated; the slug uses underscores. We keep the spaced name for
# lookups since it's what shows in the cell text and our id helper uppercases
# from there anyway.
_HREF_RE = re.compile(r'^/wiki/([^()]+)_\(Civ7\)$')

def slug_from_href(href: Optional[str]) -> Optional[str]:
    if not href:
        return None
    m = _HREF_RE.match(href)
    return m.group(1).replace('_', ' ') if m else None


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


# --------------------------- Driver ---------------------------

def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tech-html',
                    help='path to the saved "List of technologies in Civ7" HTML')
    ap.add_argument('--civic-html',
                    help='path to the saved "List of civics in Civ7" HTML')
    ap.add_argument('-o', '--out', default=DEFAULT_OUT,
                    help=f'output JSON path (default: {os.path.relpath(DEFAULT_OUT, os.getcwd())})')
    ap.add_argument('--indent', type=int, default=2,
                    help='JSON indent; pass 0 for compact (default: 2)')
    args = ap.parse_args()

    if not args.tech_html and not args.civic_html:
        ap.error('pass --tech-html and/or --civic-html')

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

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, 'w') as f:
        json.dump(out, f, indent=args.indent if args.indent else None)
    print(f'wrote -> {args.out}')


if __name__ == '__main__':
    main()
