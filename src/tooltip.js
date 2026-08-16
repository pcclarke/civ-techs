import { select } from "d3-selection";

import { eraDisplayName } from "./eraData";
import { calculatePointOnWheel } from "./helpers";
import getHighlightedTechs from "./createSelectedUnlocks";

/**
 * Hover tooltip for tech / civic nodes. Reuses the markup originally
 * authored for the now-removed click-modal (#tooltip and friends in
 * index.html); CSS for position is overridden here per call.
 *
 * Positioning docks the tooltip to one of the SVG's four corners. The
 * wheel is a circle inscribed in a square viewBox (see MAX_EXTENT in
 * computeWheelLayout.js), so every corner sits outside anything the wheel
 * ever draws. That replaces an earlier antipodal placement, which mirrored
 * only the hovered node's own position and could still land on top of an
 * arc running far around the rim — e.g. Iron Working in Civilization IV,
 * whose prerequisite sits many positions away. The corner is chosen from
 * the whole lit selection (the hovered node plus everything its arcs
 * touch), not just the node itself — see pickCorner. (An experiment
 * docking the tooltip in the wheel's hub was rejected for the same reason:
 * it sat on top of the inner arcs, including the selection's own highlight
 * chain.)
 */

const SELECTORS = {
    box:        "#tooltip",
    name:       "#tipName",
    img:        "#tipImg",
    cost:       "#tipCost",
    costLine:   "#tipCostLine",
    reqLine:    "#tipReqLine",
    leads:      "#tipLeads",
    leadLine:   "#tipLeadLine",
    unlocks:        "#tipUnlocks",
    unlocksContent: "#tipUnlocksContent",
    obsoletes:        "#tipObsoletes",
    obsoletesContent: "#tipObsoletesContent",
};

// Map source array key -> display heading. Also fixes plural for "build"
// which is stored as a single string in JSON (legacy from old scraper).
// "improvements" is the Civ 6 spelling for the same concept; both render
// under the same display heading.
const SOURCE_LABEL = {
    buildings:    "Buildings",
    wonders:      "Wonders",
    units:        "Units",
    build:        "Improvements",
    improvements: "Improvements",
    districts:    "Districts",
    projects:     "Projects",
    policies:     "Policies",
    governments:  "Governments",
    promotions:   "Promotions",
    religions:    "Religions",
    resources:    "Resources",
    civics:       "Civics",
};

// Order to render groups in. Roughly: things you build in a city, then
// what changes the broader empire (districts/policies/governments), then
// flavour categories (religions/resources). Anything outside this list
// goes last in dictionary order so we never silently drop a category we
// forgot.
const SOURCE_ORDER = [
    "districts",
    "buildings",
    "wonders",
    "units",
    "build",
    "improvements",
    "projects",
    "policies",
    "governments",
    "promotions",
    "religions",
    "resources",
    "civics",
];


/**
 * Show the tooltip for `tech`. Pulls render context (allTechs, game,
 * iconFolder) off `window.app` so callers don't have to thread it through.
 */
export function showTooltip(tech) {
    const app = window.app;
    if (!app || !app.wheelData) return;

    const {
        allTechs,
        unlocksByTech,
        obsoletesByTech,
        eraRanges,
    } = app.wheelData;
    const game = app.game;
    const folder = (app.tree && app.tree.folder) || "technologies";

    const tipBox = select(SELECTORS.box);
    if (tipBox.empty()) return;

    populateTooltip(tech, allTechs, game, folder, eraRanges);
    populateUnlocks(tech, unlocksByTech, obsoletesByTech, game);
    // While pinned the tooltip advertises it (stronger border, visible
    // close button — see #tooltip.pinned in techs.css). Hover previews
    // are suppressed during a pin, so a shown tooltip is either a plain
    // hover preview or THE pinned tech, never a mixture.
    tipBox.classed("pinned", Boolean(app.pinned));
    // Unhidden before positioning, not after: on mobile the hidden sheet
    // is display:none (it costs a composited fixed layer during scroll
    // otherwise), and the sheet path measures its own height to pad the
    // table. Both happen in one task, so nothing paints in between.
    tipBox.classed("hidden", false);
    positionTooltipAt(tech, allTechs);
}

/**
 * True when the tooltip is rendering as the mobile bottom sheet.
 *
 * Same test the positioning code uses: in the table view the wheel is
 * display:none, so its SVG has no box. Callers need this because the
 * sheet has no hover to fall back on — there is no mouseleave on touch,
 * so anything that leaves an unpinned tooltip on screen strands it there.
 */
export function isSheetView() {
    const svgEl = document.querySelector("#chart svg");
    return !svgEl || svgEl.getBoundingClientRect().width === 0;
}

export function hideTooltip() {
    select(SELECTORS.box)
        .classed("pinned", false)
        .classed("hidden", true);
    releaseSheetSpace();
}


// --------------------------- Content ---------------------------

function populateTooltip(tech, allTechs, game, folder, eraRanges) {
    const nameOf = makeNameLookup(allTechs);

    select(SELECTORS.name).text(tech.name || tech.id);
    select(SELECTORS.img)
        .attr("src", `${game}/img/${folder}/${tech.id}.png`)
        .attr("alt", tech.name || tech.id);

    // Cost: not rendered in this iteration. Hide the row regardless of
    // whether the underlying tech has a `cost` field — keeps the markup
    // compact while we figure out what other fields the user wants here.
    select(SELECTORS.costLine).classed("hidden", true);

    // Requirements (incoming edges).
    //   reqTo: techs this hard-requires (mandatory prereqs)
    //   optTo: techs this optionally requires (any-of prereqs)
    // Names that don't resolve in allTechs (e.g. cross-tree refs from
    // Civ 4 civics into the tech tree) fall back to the raw id.
    const required = (tech.reqTo || []).map((r) => nameOf(r.id));
    const optional = (tech.optTo || []).map((r) => nameOf(r.id));

    select(SELECTORS.reqLine).text(
        requirementText(required, optional, availabilityText(tech, eraRanges, game))
    );

    // Required for (outgoing edges).
    //   reqFor: techs that hard-require this one
    //   optFor: techs that optionally require this one
    const requiredFor = (tech.reqFor || []).map((r) => nameOf(r.id));
    const optionalFor = (tech.optFor || []).map((r) => nameOf(r.id));

    const hasOutgoing = requiredFor.length > 0 || optionalFor.length > 0;
    select(SELECTORS.leads).classed("hidden", !hasOutgoing);
    if (hasOutgoing) {
        select(SELECTORS.leadLine).text(leadsToText(requiredFor, optionalFor));
    }
}


/**
 * One sentence for the "Requires" row.
 *
 * The mandatory prerequisites are stated plainly — the row's label already
 * says they're required — and the any-of set is the one that needs
 * marking. This used to be up to three stacked lines ("You must have: X" /
 * "plus" / "You need one of: Y or Z"), which is the same information at
 * three times the height.
 */
function requirementText(required, optional, availability) {
    const mand = joinList(required, "and");
    const opt = joinList(optional, "or");
    if (required.length && optional.length) return `${mand}, plus one of ${opt}`;
    if (required.length) return mand;
    if (optional.length) return `One of ${opt}`;
    // "Requires: Available at game start" doesn't parse — under a label
    // that names the thing, the answer has to be the absence of one.
    return `Nothing — ${availability[0].toLowerCase()}${availability.slice(1)}`;
}

/**
 * One sentence for the "Leads to" row. Advances this one is a mandatory
 * prerequisite for come first and unmarked; the ones where it's merely an
 * option are called out, since that's the difference worth reading.
 */
function leadsToText(requiredFor, optionalFor) {
    const mand = joinList(requiredFor, "and");
    const opt = joinList(optionalFor, "and");
    if (requiredFor.length && optionalFor.length) return `${mand}; optional for ${opt}`;
    if (requiredFor.length) return mand;
    return `Optional for ${opt}`;
}


/**
 * Render the "Unlocks" and "Makes obsolete" sections by reading the
 * pre-built indices on wheelData. Each section hides itself when there
 * are no items for the hovered node.
 *
 * Items are grouped by their `source` (the originating array key), with
 * a small subheading per group, in SOURCE_ORDER. Every item gets a 24px
 * icon (broken-image placeholder if the file isn't on disk) and its
 * display name.
 */
function populateUnlocks(tech, unlocksByTech, obsoletesByTech, game) {
    renderItemSection(
        unlocksByTech ? unlocksByTech.get(tech.id) : null,
        SELECTORS.unlocks, SELECTORS.unlocksContent, game,
    );
    renderItemSection(
        obsoletesByTech ? obsoletesByTech.get(tech.id) : null,
        SELECTORS.obsoletes, SELECTORS.obsoletesContent, game,
    );
}


function renderItemSection(items, sectionSel, contentSel, game) {
    const section = select(sectionSel);
    const content = select(contentSel);
    content.selectAll("*").remove();

    if (!items || items.length === 0) {
        section.classed("hidden", true);
        return;
    }
    section.classed("hidden", false);

    // Group by source (array key) so we can emit one subsection per kind.
    // Using a Map preserves insertion order; we then iterate in SOURCE_ORDER
    // so e.g. Buildings always appear before Units regardless of which got
    // populated first.
    const bySource = new Map();
    for (const it of items) {
        if (!bySource.has(it.source)) bySource.set(it.source, []);
        bySource.get(it.source).push(it);
    }

    const sources = orderedSources(bySource);
    for (const source of sources) {
        const group = content.append("div").attr("class", "tipGroup");
        group.append("p")
            .attr("class", "tipGroupName")
            .text(SOURCE_LABEL[source] || source);

        const list = group.append("ul").attr("class", "tipItemList");
        for (const it of bySource.get(source)) {
            const hasUniques = it.uniques && it.uniques.length > 0;
            const li = list.append("li")
                .attr("class", "tipItem")
                // Items with unique variants take a line of their own so
                // the variant chips sit unambiguously with their base item
                // instead of interleaving with whatever else the flow
                // packs onto that line. Owner-tagged exclusives too:
                // "Immortal (Achaemenid Persian)" needs the width.
                .classed("tipItemWide", hasUniques || Boolean(it.civ));
            li.append("img")
                .attr("class", "tipItemIcon")
                .attr("src", `${game}/img/${source}/${it.id}.png`)
                .attr("alt", "");
            li.append("span")
                .attr("class", "tipItemName")
                // Native browser tooltip carries the full name when CSS
                // ellipsis-truncates a long item.
                .attr("title", it.name)
                .text(it.name);
            // Civ-exclusive item (no shared base version): tag its owner.
            if (it.civ) {
                li.append("span")
                    .attr("class", "tipUniqueCiv")
                    .text(`(${it.civ})`);
            }
            // Unique replacements of a shared item: icon + name + owner
            // for each, inline after the base item.
            if (hasUniques) {
                const chips = li.append("span").attr("class", "tipUniques");
                chips.append("span")
                    .attr("class", "tipUniquesLabel")
                    .text("unique:");
                for (const u of it.uniques) {
                    const chip = chips.append("span").attr("class", "tipUnique");
                    chip.append("img")
                        .attr("class", "tipUniqueIcon")
                        .attr("src", `${game}/img/${source}/${u.id}.png`)
                        .attr("alt", "");
                    chip.append("span").text(u.name);
                    chip.append("span")
                        .attr("class", "tipUniqueCiv")
                        .text(`(${u.civ})`);
                }
            }
        }
    }
}


function orderedSources(bySource) {
    const known = SOURCE_ORDER.filter((k) => bySource.has(k));
    const extras = [...bySource.keys()].filter((k) => !SOURCE_ORDER.includes(k)).sort();
    return [...known, ...extras];
}


/**
 * Wording for a node with no prerequisite edges. "Available at game
 * start" is only true in the wheel's FIRST era — Civ 3 techs whose sole
 * prereq was an era pseudo-node (stripped at load), and Civ 7 techs that
 * root a later Age's self-contained tree, unlock when their era begins,
 * not at game start. The node's own era field is dropped by
 * createUnlocks, so the era is recovered from its wheel position via
 * eraRanges. Games without era data (empty eraRanges) keep the
 * game-start wording.
 */
function availabilityText(tech, eraRanges, game) {
    if (eraRanges && eraRanges.length > 1 && typeof tech.position === "number") {
        const range = eraRanges.find(
            (r) => tech.position >= r.first && tech.position <= r.last
        );
        if (range && range !== eraRanges[0]) {
            const name = eraDisplayName(range.era);
            // Per-game grammar, reluctantly: Civ 3's descriptive era
            // names ("Middle Ages", "Modern Times") are complete noun
            // phrases that read wrong with a trailing noun, while
            // Civ 7's single-word Age names need one — and that game's
            // own term for them is "Age". Everything else keeps the
            // site's generic "era" (currently unreachable: only Civ 3
            // and Civ 7 have prereq-less techs beyond the first era).
            if (game && game.startsWith("civ3")) {
                return `Available at the start of the ${name}`;
            }
            if (game && game.startsWith("civ7")) {
                return `Available at the start of the ${name} Age`;
            }
            return `Available at the start of the ${name} era`;
        }
    }
    return "Available at game start";
}


function makeNameLookup(allTechs) {
    const byId = new Map(allTechs.map((t) => [t.id, t]));
    return (id) => {
        const t = byId.get(id);
        return t ? t.name : id;
    };
}


/** "A", "A and B", "A, B, and C". Conjunction is "and" for required-style
 *  lists and "or" for any-of optional lists. */
function joinList(items, conj) {
    if (items.length === 0) return "";
    if (items.length === 1) return items[0];
    if (items.length === 2) return `${items[0]} ${conj} ${items[1]}`;
    const head = items.slice(0, -1).join(", ");
    return `${head}, ${conj} ${items[items.length - 1]}`;
}


// --------------------------- Position ---------------------------

/** Gap between the tooltip and the SVG's own edge, so the box doesn't
 *  land flush against the corner it's docked to. */
const CORNER_MARGIN = 10;

/**
 * The four corners a tooltip can dock to, each as the angle of that corner
 * from the wheel's centre (same convention as calculatePointOnWheel — 0 is
 * +x, increasing toward +y) plus how to turn a tooltip size into a
 * {left, top} anchored there. All four are always outside the wheel's
 * circle (see the module doc comment), so whichever one is picked is
 * guaranteed clear of anything drawn.
 */
const CORNERS = [
    { // top-left
        angle: -3 * Math.PI / 4,
        anchor: (r) => ({ left: r.left + CORNER_MARGIN, top: r.top + CORNER_MARGIN }),
    },
    { // top-right
        angle: -Math.PI / 4,
        anchor: (r, w) => ({ left: r.right - CORNER_MARGIN - w, top: r.top + CORNER_MARGIN }),
    },
    { // bottom-right
        angle: Math.PI / 4,
        anchor: (r, w, h) => ({ left: r.right - CORNER_MARGIN - w, top: r.bottom - CORNER_MARGIN - h }),
    },
    { // bottom-left
        angle: 3 * Math.PI / 4,
        anchor: (r, _w, h) => ({ left: r.left + CORNER_MARGIN, top: r.bottom - CORNER_MARGIN - h }),
    },
];

/** Smallest angle between two directions, in [0, π]. */
function angleGap(a, b) {
    const diff = Math.abs(a - b) % (2 * Math.PI);
    return diff > Math.PI ? 2 * Math.PI - diff : diff;
}

/**
 * Every wheel position that's lit up for the current selection: the
 * hovered/pinned node itself, plus everything setupHighlights would mark
 * undimmed (its direct prerequisites and dependents — the same set the
 * wheel draws arcs and un-fades labels for). An arc never reaches past its
 * two ends, and both ends are always in this set, so it's everything a
 * placement needs to steer clear of.
 */
function litPositions(tech, allTechs) {
    const { highlightedIds } = getHighlightedTechs(allTechs);
    const posById = new Map(allTechs.map((t) => [t.id, t.position]));
    const positions = new Set([tech.position]);
    for (const id of highlightedIds) {
        const p = posById.get(id);
        if (p !== undefined) positions.add(p);
    }
    return positions;
}

/**
 * Pick whichever corner is farthest, in angle, from the nearest lit
 * position — the corner the tooltip can extend inward from with the least
 * chance of its edge crossing a highlighted spoke or label.
 */
function pickCorner(tech, allTechs) {
    const count = allTechs.length;
    const litAngles = [...litPositions(tech, allTechs)]
        .map((pos) => calculatePointOnWheel(count, pos, 1).angle);

    let best = CORNERS[0];
    let bestGap = -Infinity;
    for (const corner of CORNERS) {
        const gap = Math.min(...litAngles.map((a) => angleGap(corner.angle, a)));
        if (gap > bestGap) {
            bestGap = gap;
            best = corner;
        }
    }
    return best;
}

/**
 * Dock the tooltip to whichever SVG corner clears the current selection
 * (see pickCorner), then clamp inside the SVG bounding box as a safety net
 * for a tooltip too big for the space it was docked into.
 */
function positionTooltipAt(tech, allTechs) {
    const tipBox = select(SELECTORS.box).node();
    const svgEl = document.querySelector("#chart svg");
    if (!tipBox || !svgEl) return;

    const svgRect = svgEl.getBoundingClientRect();

    // In the mobile table view the wheel is display:none, so its rect is
    // all zeroes and there's no wheel to avoid overlapping — dock to the
    // bottom of the viewport instead, the tapped row stays visible above it.
    if (svgRect.width === 0) {
        positionTooltipAsSheet(tipBox);
        fitSheetToTable(tipBox, tech);
        return;
    }
    releaseSheetSpace();
    resetSheetStyles(tipBox);

    // Tooltip dimensions: read offset* lazily so a previously-hidden box
    // doesn't return zero. CSS sets min/max widths so this is stable.
    const tipW = tipBox.offsetWidth || 400;
    const tipH = tipBox.offsetHeight || 200;

    const corner = pickCorner(tech, allTechs);
    let { left, top } = corner.anchor(svgRect, tipW, tipH);
    left = clamp(left, svgRect.left, svgRect.right - tipW);
    top = clamp(top, svgRect.top, svgRect.bottom - tipH);

    tipBox.style.left = `${left}px`;
    tipBox.style.top = `${top}px`;
}


function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}


/**
 * Mobile placement: the tooltip is a bottom sheet, and the media query in
 * techs.css owns every bit of its geometry. All this has to do is clear
 * the inline styles the wheel path writes, since those would otherwise
 * out-rank the stylesheet.
 */
function positionTooltipAsSheet(tipBox) {
    resetSheetStyles(tipBox);
}

/** Undo the wheel's inline placement so the sheet's CSS can apply — and,
 *  going the other way, undo nothing, because the sheet sets none. */
function resetSheetStyles(tipBox) {
    tipBox.style.left = "";
    tipBox.style.top = "";
    tipBox.style.width = "";
    tipBox.style.maxHeight = "";
    tipBox.style.overflowY = "";
}


/** Breathing room between a revealed row and whatever it's clearing. */
const REVEAL_GAP = 6;

/**
 * A sheet docked to the bottom edge covers the rows behind it, and the
 * ones at the very end of the tree could not be scrolled out from under
 * it — the document simply ended. Two things fix that:
 *
 *   - The table carries a bottom margin the height of the open sheet, so
 *     every row can be scrolled clear of it. Margin rather than padding:
 *     getBoundingClientRect (which the era indicator reads to work out
 *     which rows are where) counts padding but not margin.
 *   - The row you just tapped is scrolled into the band between the
 *     toolbar and the sheet, so opening the sheet never hides the thing
 *     it's describing.
 *
 * Only on a pin. Hover previews on a narrow desktop window would
 * otherwise yank the page around under the pointer.
 */
function fitSheetToTable(tipBox, tech) {
    const table = document.querySelector("#table");
    if (!table) return;

    const sheetH = tipBox.offsetHeight;
    table.style.marginBottom = `${sheetH}px`;

    if (!window.app.pinned) return;
    const row = document.querySelector(
        `#table .tt-row[data-id="${CSS.escape(tech.id)}"]`
    );
    if (!row) return;

    // The top of the band is whatever chrome is pinned up there: the era
    // indicator when it's showing, else the compact toolbar, else nothing.
    const indicator = document.querySelector("#era-indicator");
    const bar = document.querySelector("#select-options");
    let bandTop = 0;
    if (indicator && !indicator.classList.contains("hidden")) {
        bandTop = indicator.getBoundingClientRect().bottom;
    } else if (bar && bar.classList.contains("compact")) {
        bandTop = bar.getBoundingClientRect().bottom;
    }
    const bandBottom = window.innerHeight - sheetH;

    const r = row.getBoundingClientRect();
    if (r.bottom > bandBottom - REVEAL_GAP) {
        window.scrollBy(0, r.bottom - bandBottom + REVEAL_GAP);
    } else if (r.top < bandTop + REVEAL_GAP) {
        window.scrollBy(0, r.top - bandTop - REVEAL_GAP);
    }
}

/** Give the table its own height back once the sheet is gone. */
function releaseSheetSpace() {
    const table = document.querySelector("#table");
    if (table) table.style.marginBottom = "";
}
