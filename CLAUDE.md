# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev            # vite --host (port 5173)
npm run build          # -> dist/ (gitignored; CI rebuilds it)
npm run preview        # serve the built output
npm run check:browser  # headless-browser checks (see below)
```

There is no unit-test suite and no linter; most verification is visual, in the browser.

### `npm run check:browser`

Checks the parts of the app that genuinely need a rendering engine, which is why they can't be unit-tested in Node or jsdom:

- **Wheel layout** — `computeWheelLayout` derives every radius from *measured* text (`getComputedTextLength`, `getBBox`), across all 11 game/tree combinations. Also covers the documented `display: none` hazard (hidden text measures as zero width, collapsing the radii) and that `refreshWheelLayout` repairs it.
- **Reduced motion** — that a switch animates normally, and lands on its final frame instantly under `--force-prefers-reduced-motion`.
- **Table layout** — `contentLeft`'s contract that the widest advance name finishes flush against the right edge, measured the same way `makeTable` does it (canvas `measureText`), plus the fixed `ROW_H` row pitch the lane overlay depends on. Also that the table's arc layer travels, and that an animated settle lands byte-identical to a static re-render.
- **Arc layer** — that the wheel's arc layer never empties or goes faint mid-switch (the regression the old crossfade had), that survivors are moved rather than re-created, and that settled arcs match the static generator exactly.
- **Keyboard navigation** — the same suite run in both views: one tab stop, arrow/Home/End movement, clamping, Enter to pin, Escape to release, decorative layers `aria-hidden`, and that the single tab stop survives the re-render every selection triggers.

One harness-fidelity trap worth knowing: `setupApp` must install the same `selected` accessor `main.js` does. Assigning `window.app.selected` is what triggers a re-render in the real app, so a plain property would let any check that reads the DOM *after* a selection — `tabindex`, `aria-selected`, `.fade` — silently pass against a stale DOM. That bug produced two confusing failures before it was found.

No new dependencies: it bundles with the esbuild inside Vite and drives whichever Chrome is installed (`CHROME=/path` to override). The page under test is the project's own `index.html` with its module script swapped out, so the DOM and CSS are the real ones.

Assertions are **invariants, not pixel values** ("every label fits inside the SVG", not "labelRadius is 418.5") — absolute numbers move with font availability and platform text rasterisation. Measured values are printed as diagnostics.

Two things to know before extending it. Animation time comes from a stubbed `performance.now` + rAF queue, because Chrome's `--virtual-time-budget` advances `setTimeout` but *not* the rAF clock d3-timer uses, which makes every transition look like it barely started. And `--dump-dom` serialises the inlined `<script>` too, so results are collected via DOM APIs rather than an HTML string — a literal result marker in the source would be matched before the real element.

CI is two workflows:

- `.github/workflows/checks.yml` — `npm run build` + `npm run check:browser` on every pull request and on pushes to `master`. This is the one to require as a status check in branch protection.
- `.github/workflows/deploy.yml` — a push to **`master`** runs the checks, builds, and publishes `dist/` to GitHub Pages. The checks run here as well as in `checks.yml` on purpose: pushing to master *is* publishing, so the live site shouldn't depend on branch protection having been configured and not bypassed. (`origin/HEAD` points at `gh-pages`, a legacy branch; `master` is what ships.)

`CI=true` (set by Actions) makes `run.mjs` pass `--no-sandbox --disable-dev-shm-usage`, because headless Chrome's sandbox needs unprivileged user namespaces that CI images restrict. Set `CHROME_NO_SANDBOX=1` to get the same locally. Expect the checks' printed diagnostics to differ between a local macOS run and the Linux runner — no Helvetica or Arial there, so measured text is wider. That is exactly why the assertions are invariants rather than absolute numbers.

### Data scrapers

`data_scrapers/<game>/scraper.py` regenerates `public/<game>/civdata.json`. Run each from its own directory. Their raw inputs (`data_scrapers/*/data/` — Firaxis XML dumps) are gitignored and not in the repo, so these only run on a machine that has the game assets.

```bash
cd data_scrapers/civ4 && python3 scraper.py --game base|war|bts    # or --all
cd data_scrapers/civ5 && python3 scraper.py --game base|gnk|bnw    # or --all
cd data_scrapers/civ6 && python3 scraper.py --game base|rf|gs      # or --all
cd data_scrapers/civ6 && python3 atlas_to_png.py --game gs --kind tech   # crop icons from SDK DDS atlases
```

Civ 7 is the exception: nobody owns the game files, so it parses saved Fandom wiki HTML (the `List of … in Civ7 … .html` files sitting untracked in the repo root are those inputs). `data_scrapers/civ7/scraper.py --tech-html … --civic-html … --buildings-html … --units-html …`, and `wiki_to_png.py` with the same flags for icons.

Each scraper's module docstring documents its flags and the exact JSON shape it emits — read it before touching one.

## Architecture

Vanilla ES modules + individual `d3-*` packages, bundled by Vite. No framework, no router, no build-time data step. Everything hangs off one global, `window.app`.

### Two renderings, one dataset

The core idea: the **wheel** (wide screens, SVG, polar) and the **table** (narrow screens, HTML rows + an SVG lane overlay, Cartesian) are the *same precomputed data drawn on different axes*. Nothing about layout is recomputed between them:

```
wheel                         table
angle  = position / count     y = position * ROW_H
radius = ARC_BASE + step      x = step * laneW
```

`position` and `step` both come out of the shared pipeline, so arc packing, highlight state, and pin state are view-agnostic. `src/renderView.js` is the only module that knows which view is live; `TABLE_BREAKPOINT` (700) there **must stay in sync** with the `@media (max-width: 699px)` block in `css/techs.css`, which is what actually hides the other view.

### Load pipeline

`src/initWheelData.js` is the spine. On startup and on every game/expansion/tree change:

1. fetch `public/<game>/civdata.json`, pick the active tree's node array (`technologies` or `civics`)
2. drop Civ 3's fake `kind: "Era"` nodes (they exist only so prereqs resolve)
3. `eraData.getEraOrdering` → `depthSortTechnologies` — sorts by (era, dependency depth, cost), which is what makes each era a *contiguous* run; the era ring/wedges depend on that contract
4. `createUnlocks` — the heart of the layout. For each node computes `range` (min/max index it connects to) and packs arcs into non-overlapping `step` rings via `findOpenStep`
5. `setupSpokes`, `computeEraRanges`, `computeWheelLayout`, `buildUnlockIndex`
6. writes one `window.app.wheelData` object, then `renderActiveView()`

Stale-response guard: a `loadRequestId` counter means a slow fetch that resolves after a newer switch is discarded.

### Layout is measured, not constant

`src/constants.js` holds fallbacks, but the live wheel derives `labelRadius`, `techImgRadius`, `arcSpace`, and the label font size per dataset by rendering hidden `<text>` and measuring it (`computeWheelLayout.js`). Consequence worth knowing: `getComputedTextLength()` returns 0 inside a `display: none` subtree, so a wheel laid out while the table was showing is garbage — hence `refreshWheelLayout()`, called from `renderView.js` when crossing the breakpoint.

### Paint order

SVG paints in document order and d3's `join` appends entrants at the end, so stacking is pinned down with fixed groups created once: `svgInit.js` for the wheel, the `tt-l-*` groups in `makeTable.js` for the table. Don't rely on element creation order.

### Keyboard and ARIA

Both views are single-selection listboxes over the same advances: `#chart` and `#table` carry `role="listbox"`, and one element per advance carries `role="option"` — the `.tech-image` on the wheel (its label is a second node for the same advance, so only the icon is focusable) and the `.tt-row` in the table. Everything else is decoration and is `aria-hidden`: the wheel's layers get it by group in `svgInit.js`, the table's lane overlay and era hairlines individually.

`keyboardNav.js` owns the interaction, shared by both views. Three things to know before changing it:

- **The tab stop roves.** The layer holds exactly one `tabindex="0"`; arrows move it. `tabindex="0"` on all 92 advances would mean 92 Tab presses to get past the chart. The stop is tracked as an *id* rather than a node, because every hover redraws every layer — but only within one dataset. `resolveStop` reseeds on a game switch, to the carried pin if one survived and otherwise to the new tree's first advance, and it detects the switch by the **identity of the `allTechs` array** rather than an explicit call from `initWheelData`. That's deliberate: identity is an exact signal (a fresh array per load, never mutated after) and can't be forgotten if another load path is ever added. Letting the stop survive a switch by id made where Tab landed depend on the route taken — Civ 4 opened on Fishing, but Civ 4 → Civ 5 → Civ 4 opened on Agriculture, because Civ 5 has no Fishing to hold the stop and Civ 4 does have the Agriculture it fell back to.
- **Focus implies selection**, so a keyboard user gets the highlight and tooltip a mouse user gets on hover. This deliberately ignores `pinned` where hover does not — `onNodeHover` bails while pinned because the pointer crosses the wheel accidentally on its way to the close button, and a keyboard has no equivalent accidental travel.
- **Enter/Escape reuse the mouse's handlers** (`onNodeClick`, `releasePin`), which is why `releasePin` lives in `drawTools.js` rather than `main.js`.

The tooltip is `role="status"`, so its content is announced as the selection moves.

### Selection / pin model

- `window.app.selected` is an accessor — assigning it re-renders the active view. Unrelated elements get the `.fade` class (`opacity: 0.05`).
- Hover sets `selected`; click sets `pinned`, which makes hover inert. Hover handlers bail unless `matchMedia("(hover: hover)")` matches — a tap synthesises `mouseover` before `click` and would otherwise open an unpinned tooltip with no way out.
- `setupHighlights` / `createSelectedUnlocks` compute the lit set (the node, its prereqs, its dependents) plus the overlay arcs/spokes drawn undimmed on top.
- A pin survives a game switch by **id**, re-looked-up in the new dataset; the old object never carries over.

### Switch animations

`animateWheelSwitch.js` / `animateTableSwitch.js` run only when `initWheelData` replaced the dataset (never on first load, never on hover re-renders). Node ids are stable across games, so a switch is entrances + travel + exits on the same visual objects, and **every layer travels** — nothing crossfades a whole layer in either view.

Each layer is keyed on an identity that outlives the dataset, which is the part worth understanding before changing any of it:

| Layer | Identity | What interpolates |
|---|---|---|
| Spokes, icons, labels, rows | node id | angle (wheel) / row (table) |
| Arcs, origin pins, req/opt marks | tech id; `arcId>id` for marks | angle + ring radius (wheel), lane x + row y (table) |
| Era wedges | `eraKey` — canonical across games | the shared *boundaries* of a partition, via `eraMorphPlan` |
| Era labels | `eraKey` | position; text crossfades only when the wording differs |

Three things that look like free choices but aren't:

- **Start values are read live off the DOM**, not from a snapshot, so rapid switching redirects from wherever an element actually is. Where a value can't be recovered from the DOM — an annular sector's radii, an era wedge's angles — it's stashed on the node instead (`__ringGeom`, `__eraAngles`), which is why the *static* draw paths write those stashes too.
- **Opacity is never animated for a surviving element.** Every layer carries a selection-driven `.fade` class at `opacity: 0.05`, and an inline opacity outranks a class rule — so anything that does fade goes through `fadeInToResting`, which reads the resting value instead of assuming `1`.
- **Sizes snap, positions travel.** Label radii, icon widths, `mark`/`pinHalf` are properties of the layout (recomputed per game), not of where a thing is.

## Data conventions

Node ids are `TECH_*` / `CIVIC_*` / `BUILDING_*` / `UNIT_*`. Prereq edges are `requires` (all needed) and `optional` (any-of), rendered as squares and circles respectively. Both `requires` and `obsolete` are a bare string in Civ 1/2 and an array in Civ 3+; `buildUnlockIndex.js` normalises (and also handles `obsolete2`, Civ 1 only).

Civ-unique items use a wrapper shape: `{ id: CLASS_ID, CIVILIZATION_ALL: {id, name}, CIVILIZATION_ROME: {id, name} }`, with Civ 6 also using `LEADER_*` keys. An item with owner keys but no `CIVILIZATION_ALL` is itself exclusive. `data.civilizations` resolves owner keys to display names.

`src/constants.js`'s `GAMES` array is the registry. Note the two different axes:
- **expansions** are separate data directories (`civ4` / `civ4war` / `civ4bts`) — picking one swaps `window.app.game`, i.e. which JSON loads
- **trees** are parallel node arrays inside one file (Civ 6/7 tech + civics) — picking one swaps `window.app.tree`, i.e. which array and icon folder are read

### public/ vs img/

`public/` is copied verbatim by Vite and holds everything addressed by a **runtime-constructed** path: `public/<game>/civdata.json` and `public/<game>/img/<folder>/<id>.png`. Hashing those would break the string interpolation. Chrome-level assets go through the bundler instead, so Vite hashes and base-prefixes them: `img/startSlice.png` via a JS `import` in `svgInit.js`, the fonts via `url()` in `css/techs.css`.

`vite.config.js` sets `base: "./"` because Pages serves the site from `/civ-techs/`, not the domain root.

## Gotchas

- `ROW_H` (34) is a hard contract, not a hint: the table's lane overlay computes y as `position * ROW_H` instead of measuring the DOM, and the row animation derives a target `top` the same way. Rows must all be exactly that tall.
- `index.html` carries substantial explanatory comments about why the toolbar, era indicator, and tooltip markup are shaped the way they are. The same is true of most `src/` modules — the "why" lives in doc comments, and they're accurate.
