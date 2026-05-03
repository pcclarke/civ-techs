"""
Civilization 7 icon scraper (wiki-sourced).

Walks the saved Fandom wiki HTML for the tech / civic list pages, finds
the inline icon for each row, and downloads a 128px copy from Fandom's
image CDN to civ7/img/{technologies,civics}/.

The wiki <img> tags are lazy-loaded — the real CDN URL is in `data-src`,
not `src` (which holds a 1x1 placeholder gif). The URLs end in
`scale-to-width-down/44` because the table renders at 44px; we swap that
for `scale-to-width-down/128` so Fandom returns the size the wheel uses.

Id assignment matches scraper.py exactly: `TECH_<NAME_UPPER>` /
`CIVIC_<NAME_UPPER>`, with `_<AGE>` appended on names that recur across
Ages (the three Future Tech / Future Civic entries). The three Future
techs share one source image on the wiki — that's expected; all three
output files end up identical, but each is keyed by a distinct id so the
wheel renders the right icon for the right node.

Run from this directory:
    python3 wiki_to_png.py \\
      --tech-html  "../../List of technologies in Civ7 _ Civilization Wiki _ Fandom.html" \\
      --civic-html "../../List of civics in Civ7 _ Civilization Wiki _ Fandom.html"

Skips files that already exist on disk by default; pass --force to
re-download. --dry-run prints the plan without fetching anything.
"""

import argparse
import collections
import os
import re
import sys
import time
import urllib.error
import urllib.request
from typing import Dict, List, Optional, Tuple

from bs4 import BeautifulSoup, Tag

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
DEFAULT_OUT_BASE = os.path.join(REPO_ROOT, 'civ7', 'img')

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
    if not href:
        return None
    m = _HREF_RE.match(href)
    return m.group(1).replace('_', ' ') if m else None


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
    """Return {age: [(name, image_url), ...]} from each Age's table."""
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


def fetch(url: str, dest: str) -> None:
    req = urllib.request.Request(url, headers={
        # Fandom serves a 403 to bare urllib without a UA. Any browser-ish
        # string works.
        'User-Agent': 'civ-techs/wiki_to_png (https://github.com/)'
    })
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()
    with open(dest, 'wb') as f:
        f.write(body)


def run_kind(html_path: str, prefix: str, subdir: str, out_base: str,
             *, force: bool, dry_run: bool, sleep_s: float) -> None:
    with open(html_path, encoding='utf-8') as f:
        soup = BeautifulSoup(f, 'html.parser')

    per_age = collect_rows(soup)
    by_age = assign_ids(per_age, prefix)

    outdir = os.path.join(out_base, subdir)
    if not dry_run:
        os.makedirs(outdir, exist_ok=True)

    total = sum(len(v) for v in by_age.values())
    print(f'[{subdir}] {total} icons to consider in {outdir}')

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
                fetch(fetch_url, dest)
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
    ap.add_argument('--out-base', default=DEFAULT_OUT_BASE,
                    help=f'image output root (default: {os.path.relpath(DEFAULT_OUT_BASE, os.getcwd())})')
    ap.add_argument('--force', action='store_true',
                    help='re-download images that already exist on disk')
    ap.add_argument('--dry-run', action='store_true',
                    help='print plan without fetching')
    ap.add_argument('--sleep', type=float, default=0.1,
                    help='seconds to wait between requests, to be polite to Fandom (default: 0.1)')
    args = ap.parse_args()

    if not args.tech_html and not args.civic_html:
        ap.error('pass --tech-html and/or --civic-html')

    if args.tech_html:
        run_kind(args.tech_html, 'TECH', 'technologies', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep)
    if args.civic_html:
        run_kind(args.civic_html, 'CIVIC', 'civics', args.out_base,
                 force=args.force, dry_run=args.dry_run, sleep_s=args.sleep)


if __name__ == '__main__':
    main()
