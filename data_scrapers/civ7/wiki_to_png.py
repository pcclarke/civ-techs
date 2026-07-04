"""
Civilization 7 icon scraper (wiki-sourced).

Walks the saved Fandom wiki HTML for the tech / civic / building / unit
list pages, finds the inline icon for each row, and downloads a 128px
copy from Fandom's image CDN to civ7/img/{technologies,civics,buildings,
units}/.

The wiki <img> tags are lazy-loaded — the real CDN URL is in `data-src`,
not `src` (which holds a 1x1 placeholder gif). The URLs end in
`scale-to-width-down/44` because the table renders at 44px; we swap that
for `scale-to-width-down/128` so Fandom returns the size the wheel uses.

For buildings and units, we filter against the ids in civ7/civdata.json
so we only fetch icons for items the wheel is actually going to render —
civ-unique buildings and starter units get filtered out at scrape time
by scraper.py, and we don't want their icons cluttering the img dir
either.

Run from this directory:
    python3 wiki_to_png.py \\
      --tech-html      "../../List of technologies in Civ7 _ Civilization Wiki _ Fandom.html" \\
      --civic-html     "../../List of civics in Civ7 _ Civilization Wiki _ Fandom.html" \\
      --buildings-html "../../List of buildings in Civ7 _ Civilization Wiki _ Fandom.html" \\
      --units-html     "../../List of units in Civ7 _ Civilization Wiki _ Fandom.html"

Skips files that already exist on disk by default; pass --force to
re-download. --dry-run prints the plan without fetching anything.
"""

import argparse
import collections
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Dict, List, Optional, Set, Tuple

from bs4 import BeautifulSoup, Tag

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DEFAULT_OUT_BASE = os.path.join(REPO_ROOT, 'civ7', 'img')
DEFAULT_CIVDATA = os.path.join(REPO_ROOT, 'civ7', 'civdata.json')

AGES = ['Antiquity', 'Exploration', 'Modern']
AGE_HEADINGS = {f'{age} Age': age for age in AGES}

# Match the rest of the pipeline (Civ 6's atlas exports, Civ 5's icon copies).
ICON_SIZE = 128

# Standard Fandom URL is e.g.
#   https://static.wikia.nocookie.net/civilization/images/2/2a/Foo_(Civ7).png/revision/latest/scale-to-width-down/44?cb=...
# We rewrite the `scale-to-width-down/N` segment to ICON_SIZE, drop the cache
# buster, and request the result. Originals (no scale-to-width-down) are
# usually 256px, so requesting 128 still does a server-side resize from a
# clean source.
_SCALE_RE = re.compile(r'/scale-to-width-down/\d+')

# Wiki page slug pattern, same as scraper.py.
_HREF_RE = re.compile(r'^/wiki/([^()]+)_\(Civ7\)$')


# --------------------------- HTML walking ---------------------------

def slug_from_href(href: Optional[str]) -> Optional[str]:
    """URL-decode the slug so 'Hul%27che' -> "Hul'che" — otherwise the
    filename we assign has percent-escapes in it and the name lookup
    misses. Mirrors scraper.py's helper of the same name."""
    if not href:
        return None
    m = _HREF_RE.match(href)
    if not m:
        return None
    return urllib.parse.unquote(m.group(1)).replace('_', ' ')


def find_age_tables(soup: BeautifulSoup) -> Dict[str, Tag]:
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


def collect_rows(soup: BeautifulSoup) -> Dict[str, List[Tuple[str, str]]]:
    """Return {age: [(name, image_url), ...]} from each Age's table.

    Used for techs and civics — one table per Age, name+icon live in the
    first column. Buildings and units use `collect_buildings` and
    `collect_units` below because their page structures are messier.
    """
    out: Dict[str, List[Tuple[str, str]]] = {}
    for age, table in find_age_tables(soup).items():
        rows = []
        for tr in table.find_all('tr')[1:]:
            tds = tr.find_all('td', recursive=False)
            if not tds:
                continue
            first_td = tds[0]
            name: Optional[str] = None
            for a in first_td.find_all('a'):
                n = slug_from_href(a.get('href'))
                if n:
                    name = n
                    break
            img = first_td.find('img')
            src = (img.get('data-src') if img else None) or (img.get('src') if img else None)
            if name and src and src.startswith('http'):
                rows.append((name, src))
        out[age] = rows
    return out


# --------------------------- Buildings & units ---------------------------

def _walk_age_headings(soup: BeautifulSoup, min_h_level: int = 2) -> Dict[str, Tag]:
    """Age-tolerant version of find_age_tables — matches both `<h2>` (units
    page) and `<h3>` (tech / civic / buildings pages) headings, with any
    suffix (e.g. "Antiquity Age Units" not just "Antiquity Age")."""
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


def _elements_between(start: Tag, end: Optional[Tag], names: Tuple[str, ...]):
    """Iterate DOM elements in document order between `start` (exclusive)
    and `end` (exclusive/None) that match any of `names`.

    Stops at any heading whose level is at or above `start`'s level.
    Buildings-page Age headings are <h3>, so we need to stop at the next
    <h3> (or higher) to avoid walking straight into the next Age's
    tables. Units-page Age headings are <h2>, so we stop at any <h2>
    (or <h1>) instead. Deriving the stop level from `start`'s tag lets
    the same walker handle both."""
    stop_level = int(start.name[1]) if start.name and start.name.startswith('h') else 6
    stop_tags = tuple(f'h{i}' for i in range(1, stop_level + 1))
    walked_tags = tuple(set(names) | set(stop_tags))
    cur = start
    while True:
        cur = cur.find_next(walked_tags)
        if cur is None or cur is end:
            return
        if cur.name in stop_tags and cur is not end:
            return
        if cur.name in names:
            yield cur


def _first_img_src(el: Tag) -> Optional[str]:
    img = el.find('img')
    if img is None:
        return None
    src = img.get('data-src') or img.get('src')
    return src if src and src.startswith('http') else None


def _collect_table_rows_by_age(
        soup: BeautifulSoup,
        header_prefix: str,
        min_h_level: int) -> Dict[str, List[Tuple[str, str]]]:
    """Generic per-Age table walker. For each Age heading (h2 or h3 per
    min_h_level), walk all tables under it whose first-column header
    starts with `header_prefix`, and pull (name, icon_url) from the
    first cell of every data row. Used for buildings, wonders, and
    improvements — they all share this shape."""
    heads = _walk_age_headings(soup, min_h_level=min_h_level)
    ordered = sorted(heads.items(),
                     key=lambda kv: list(soup.descendants).index(kv[1]))
    out: Dict[str, List[Tuple[str, str]]] = {a: [] for a in AGES}
    for i, (age, hd) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else None
        for tbl in _elements_between(hd, end, ('table',)):
            rows = tbl.find_all('tr')
            if not rows:
                continue
            ths = rows[0].find_all('th')
            if not any(th.get_text(strip=True).startswith(header_prefix) for th in ths):
                continue
            for tr in rows[1:]:
                tds = tr.find_all('td', recursive=False)
                if not tds:
                    continue
                first = tds[0]
                name: Optional[str] = None
                for a in first.find_all('a'):
                    n = slug_from_href(a.get('href'))
                    if n:
                        name = n
                        break
                src = _first_img_src(first)
                if name and src:
                    out[age].append((name, src))
    return out


def collect_buildings(soup: BeautifulSoup) -> Dict[str, List[Tuple[str, str]]]:
    """Buildings page: <h3> Age headings, two tables per Age (standard
    + unique)."""
    return _collect_table_rows_by_age(soup, 'Building', min_h_level=3)


def collect_wonders(soup: BeautifulSoup) -> Dict[str, List[Tuple[str, str]]]:
    """Wonders page: <h3> Age headings, one table per Age."""
    return _collect_table_rows_by_age(soup, 'Wonder', min_h_level=3)


def collect_improvements(soup: BeautifulSoup) -> Dict[str, List[Tuple[str, str]]]:
    """Improvements page: <h2> Age headings (note: h2, not h3), with
    three sub-tables per Age. The first-column header prefix "Improvement"
    picks up all three.

    Dedupes by name across ages: the wiki lists shared standard
    improvements (Farm, Fishing Boat, etc.) under every Age's table,
    but our scraper.py keeps only the earliest Age occurrence in the
    JSON. We do the same here so the assigned ids (and thus icon
    filenames) match the JSON ids one-to-one.
    """
    raw = _collect_table_rows_by_age(soup, 'Improvement', min_h_level=2)
    seen: Set[str] = set()
    out: Dict[str, List[Tuple[str, str]]] = {a: [] for a in AGES}
    for age in AGES:
        for name, url in raw.get(age, []):
            if name in seen:
                continue
            seen.add(name)
            out[age].append((name, url))
    return out


def collect_units(soup: BeautifulSoup) -> Dict[str, List[Tuple[str, str]]]:
    """Walk the units page — mix of grid-shaped tables (Military Units)
    and <ul> lists (Civilian Units) per Age.

    The wiki emits each unit as an `<a>` that wraps only an `<img>`
    (that's the icon link, with empty text), then a following `<a>`
    with the same href but the visible name text. Unique-unit cells
    pack several such pairs in a single <td>. Walking at the <a>-with-
    nested-<img> level lets us capture each unit distinctly, whereas
    the earlier "first anchor per <td>" pass only saw the first unit in
    each cell and silently dropped the rest (Chu-Ko-Nu, Legion, etc.).
    """
    heads = _walk_age_headings(soup, min_h_level=2)
    ordered = sorted(heads.items(),
                     key=lambda kv: list(soup.descendants).index(kv[1]))
    out: Dict[str, List[Tuple[str, str]]] = {a: [] for a in AGES}
    for i, (age, hd) in enumerate(ordered):
        end = ordered[i + 1][1] if i + 1 < len(ordered) else None
        seen: Set[str] = set()
        for anchor in _elements_between(hd, end, ('a',)):
            n = slug_from_href(anchor.get('href'))
            if not n or n in seen:
                continue
            # We only want anchors that carry the icon — those wrap an
            # <img>. Text-only anchors of the same unit follow, but we
            # want the pair with the actual image inside.
            img = anchor.find('img')
            if img is None:
                continue
            src = img.get('data-src') or img.get('src')
            if not src or not src.startswith('http'):
                continue
            seen.add(n)
            out[age].append((n, src))
    return out


# --------------------------- Filtering against civdata.json ---------------------------

def load_id_set(civdata_path: str, category_key: str) -> Set[str]:
    """Load the set of ids present in civdata.json under `category_key`.
    Empty set if the file or the key is missing (no filter, everything
    passes through)."""
    if not os.path.isfile(civdata_path):
        return set()
    try:
        with open(civdata_path) as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return set()
    return {it['id'] for it in data.get(category_key, []) if 'id' in it}


# --------------------------- Id assignment (copy of scraper.py logic) ---------------------------

def make_id(prefix: str, name: str) -> str:
    upper = re.sub(r'[^A-Z0-9_]', '_', name.upper().replace(' ', '_'))
    return f'{prefix}_{upper}'


def assign_ids(per_age_rows: Dict[str, List[Tuple[str, str]]], prefix: str) -> Dict[str, List[Tuple[str, str]]]:
    """Walk per-Age rows and return {age: [(id, url), ...]}.
    Names that appear in more than one Age get _<AGE> appended."""
    counts: Dict[str, int] = collections.Counter()
    for rows in per_age_rows.values():
        for name, _ in rows:
            counts[name] += 1
    out: Dict[str, List[Tuple[str, str]]] = {}
    for age, rows in per_age_rows.items():
        bucket = []
        for name, url in rows:
            base = make_id(prefix, name)
            id_ = base if counts[name] == 1 else f'{base}_{age.upper()}'
            bucket.append((id_, url))
        out[age] = bucket
    return out


# --------------------------- Download ---------------------------

def upsize_url(url: str, target: int = ICON_SIZE) -> str:
    """Rewrite a Fandom thumbnail URL to request ICON_SIZE pixels.
    Drops the cache buster too — leaving it doesn't hurt, but Fandom's
    canonical asset path is cleaner without it."""
    no_cb = url.split('?', 1)[0]
    if _SCALE_RE.search(no_cb):
        return _SCALE_RE.sub(f'/scale-to-width-down/{target}', no_cb)
    # Original (no scale-to-width-down) — append one to force a resize.
    return f'{no_cb}/scale-to-width-down/{target}'


def fetch(url: str, dest: str, post_process=None) -> None:
    req = urllib.request.Request(url, headers={
        # Fandom serves a 403 to bare urllib without a UA. Any browser-ish
        # string works.
        'User-Agent': 'civ-techs/wiki_to_png (https://github.com/)'
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()
    if post_process is not None:
        # Round-trip through PIL for kinds that need a pixel-level fix
        # (see recolor_white_silhouette). Pure network + write for kinds
        # that don't.
        from io import BytesIO
        from PIL import Image
        img = Image.open(BytesIO(body))
        img = post_process(img)
        img.save(dest, 'PNG', optimize=True)
    else:
        with open(dest, 'wb') as f:
            f.write(body)


def recolor_white_silhouette(img):
    """Flip a white-on-transparent silhouette to black-on-transparent.

    Civ 7 wiki unit icons are white silhouettes intended to render on
    top of a coloured badge in-game. Dropped straight onto the wheel's
    white tooltip they become invisible; recolouring the white
    foreground to black keeps the silhouette shape and antialiasing
    intact while making it read against a light background.
    """
    from PIL import Image
    rgba = img.convert('RGBA')
    r, g, b, a = rgba.split()
    # Solid black RGB across the whole canvas — alpha alone carries the
    # silhouette. Antialiased edge pixels keep their partial-alpha, so
    # they blend cleanly rather than fringing.
    black = Image.new('L', rgba.size, 0)
    return Image.merge('RGBA', (black, black, black, a))


def run_kind(html_path: str, prefix: str, subdir: str, out_base: str,
             *, force: bool, dry_run: bool, sleep_s: float,
             collector=collect_rows, id_filter: Optional[Set[str]] = None,
             post_process=None) -> None:
    """Extract per-Age (name, url) rows using `collector`, assign ids the
    same way scraper.py does, then fetch each icon.

    `id_filter`: if provided, only ids present in the set are fetched.
    Used for buildings and units so we skip civ-unique items that
    scraper.py already dropped from the JSON.
    """
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    per_age = collector(soup)
    by_age = assign_ids(per_age, prefix)

    outdir = os.path.join(out_base, subdir)
    if not dry_run:
        os.makedirs(outdir, exist_ok=True)

    # Apply the id_filter now that we have final ids assigned.
    if id_filter is not None:
        by_age = {age: [(i, u) for i, u in rows if i in id_filter]
                  for age, rows in by_age.items()}

    total = sum(len(v) for v in by_age.values())
    filt_note = f' (filtered to {len(id_filter)} ids from civdata.json)' if id_filter is not None else ''
    print(f'[{subdir}] {total} icons to consider in {outdir}{filt_note}')

    written = skipped = failed = 0
    for age in AGES:
        for id_, url in by_age[age]:
            dest = os.path.join(outdir, f'{id_}.png')
            if os.path.exists(dest) and not force:
                skipped += 1
                continue
            fetch_url = upsize_url(url)
            if dry_run:
                print(f'  would fetch  {fetch_url} -> {dest}')
                continue
            try:
                fetch(fetch_url, dest, post_process=post_process)
                written += 1
                print(f'  wrote {os.path.relpath(dest, REPO_ROOT)}')
            except (urllib.error.URLError, urllib.error.HTTPError) as e:
                failed += 1
                print(f'  FAILED {id_}: {e}', file=sys.stderr)
            if sleep_s:
                time.sleep(sleep_s)

    summary = f'[{subdir}] wrote {written}, skipped {skipped} (already existed)'
    if failed:
        summary += f', FAILED {failed}'
    print(summary)


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--tech-html',
                    help='path to the saved "List of technologies in Civ7" HTML')
    ap.add_argument('--civic-html',
                    help='path to the saved "List of civics in Civ7" HTML')
    ap.add_argument('--buildings-html',
                    help='path to the saved "List of buildings in Civ7" HTML '
                         '(only ids present in civdata.json get fetched)')
    ap.add_argument('--units-html',
                    help='path to the saved "List of units in Civ7" HTML '
                         '(only ids present in civdata.json get fetched)')
    ap.add_argument('--wonders-html',
                    help='path to the saved "List of wonders in Civ7" HTML '
                         '(only ids present in civdata.json get fetched)')
    # --improvements-html was removed alongside the scraper's improvement
    # support; see the equivalent comment in scraper.py for context.
    ap.add_argument('--civdata', default=DEFAULT_CIVDATA,
                    help=f'civdata.json to filter buildings/units against '
                         f'(default: {os.path.relpath(DEFAULT_CIVDATA, os.getcwd())})')
    ap.add_argument('--out-base', default=DEFAULT_OUT_BASE,
                    help=f'image output root (default: {os.path.relpath(DEFAULT_OUT_BASE, os.getcwd())})')
    ap.add_argument('--force', action='store_true',
                    help='re-download images that already exist on disk')
    ap.add_argument('--dry-run', action='store_true',
                    help='print plan without fetching')
    ap.add_argument('--sleep', type=float, default=0.1,
                    help='seconds to wait between requests, to be polite to Fandom (default: 0.1)')
    args = ap.parse_args()

    if not any([args.tech_html, args.civic_html, args.buildings_html,
                args.units_html, args.wonders_html]):
        ap.error('pass at least one --*-html flag')

    if args.tech_html:
        run_kind(args.tech_html, 'TECH', 'technologies', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep)
    if args.civic_html:
        run_kind(args.civic_html, 'CIVIC', 'civics', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep)
    if args.buildings_html:
        run_kind(args.buildings_html, 'BUILDING', 'buildings', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep,
                 collector=collect_buildings,
                 id_filter=load_id_set(args.civdata, 'buildings'))
    if args.units_html:
        run_kind(args.units_html, 'UNIT', 'units', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep,
                 collector=collect_units,
                 id_filter=load_id_set(args.civdata, 'units'),
                 post_process=recolor_white_silhouette)
    if args.wonders_html:
        run_kind(args.wonders_html, 'BUILDING', 'wonders', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep,
                 collector=collect_wonders,
                 id_filter=load_id_set(args.civdata, 'wonders'))


if __name__ == '__main__':
    main()
