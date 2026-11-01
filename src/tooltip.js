import { select } from "d3-selection";

import { ringRadius, unlockArcGeom } from "./arcs";
import { TECH_IMG_WIDTH } from "./constants";
import { updateDetailsHint, visibleBand, visibleFraction } from "./detailsHint";
import { eraDisplayName } from "./eraData";
import { calculatePointOnWheel } from "./helpers";
import getHighlightedTechs from "./createSelectedUnlocks";
import { setupHighlights } from "./setupHighlights";

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
 * touch), not just the node itself — see chooseCorner. (An experiment
 * docking the tooltip in the wheel's hub was rejected for the same reason:
 * it sat on top of the inner arcs, including the selection's own highlight
 * chain.) Within that, chooseCorner prefers a corner that's on screen,
 * but only among corners that cover nothing lit. When it has to go off
 * screen, detailsHint.js says where it went.
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


/** The advance the tooltip is showing, or null while hidden — what
 *  repositionTooltip needs to re-place it without the caller saying. */
let shownTech = null;

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
    shownTech = tech;
    positionTooltipAt(tech, allTechs);
}

/**
 * Re-place an open tooltip for the current viewport. Placement is written
 * once, when the tooltip is shown, from where the SVG is at that moment —
 * but the SVG scales with the window (it has a viewBox), so a resize moves
 * every corner the tooltip docks to. Left alone, widening grew the wheel
 * out from under the box and narrowing left a bottom-docked one hanging
 * below the shrunken wheel, stretching the page to reach it.
 *
 * In the sheet view only the table's bottom margin is refreshed (the
 * sheet's height follows the viewport width). fitSheetToTable's scroll to
 * the pinned row is deliberately not repeated: resize fires continuously
 * during a drag, and the page would be yanked to that row on every event.
 */
export function repositionTooltip() {
    const tipBox = select(SELECTORS.box).node();
    if (!shownTech || !tipBox || tipBox.classList.contains("hidden")) return;
    if (isSheetView()) {
        const table = document.querySelector("#table");
        if (table) table.style.marginBottom = `${tipBox.offsetHeight}px`;
        return;
    }
    const app = window.app;
    if (app && app.wheelData) positionTooltipAt(shownTech, app.wheelData.allTechs);
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
    const tipBox = select(SELECTORS.box)
        .classed("pinned", false)
        .classed("hidden", true);
    // The hidden box keeps its layout (see #tooltip.hidden), and on the
    // wheel it's absolutely positioned, so left at its last corner it
    // still counts toward the page's scrollable area — after a resize
    // narrows the window, that's a horizontal scrollbar to nowhere. Park
    // it back at the stylesheet's top-left.
    if (!tipBox.empty()) resetSheetStyles(tipBox.node());
    shownTech = null;
    releaseSheetSpace();
    updateDetailsHint();
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
 * How close the angle-nearest lit position comes to each corner, in
 * radians. Larger is safer: the box extends inward from its corner, so the
 * farther the selection is from that corner, the less chance of its edge
 * crossing a highlighted spoke or label.
 */
function cornerGaps(tech, allTechs) {
    const count = allTechs.length;
    const litAngles = [...litPositions(tech, allTechs)]
        .map((pos) => calculatePointOnWheel(count, pos, 1).angle);
    return new Map(CORNERS.map((corner) => [
        corner,
        Math.min(...litAngles.map((a) => angleGap(corner.angle, a))),
    ]));
}

/**
 * The corner farthest, in angle, from the nearest lit position. This was
 * the whole of the placement rule before chooseCorner; it's now the
 * fallback for when no corner is clear, and that choice is deliberate:
 * when every corner would cover part of the selection, the tooltip goes
 * where it covers the least likely part, even if that's off screen.
 * Covering the thing being explained is worse than making the reader
 * scroll to the explanation.
 */
function pickCorner(gaps) {
    let best = CORNERS[0];
    for (const corner of CORNERS) {
        if (gaps.get(corner) > gaps.get(best)) best = corner;
    }
    return best;
}

/** Clearance a docked tooltip keeps from each lit feature, in wheel units
 *  (the SVG's viewBox space). Icons are TECH_IMG_WIDTH square; a label is
 *  roughly a line box either side of its radial baseline; spokes and arcs
 *  are hairlines. */
const CLEAR_ICON = TECH_IMG_WIDTH / 2 + 2;
const CLEAR_LABEL = 11;
const CLEAR_LINE = 3;
/** Spacing between samples along a lit feature, in wheel units. Must stay
 *  under twice the smallest clearance, or a box edge could slip between
 *  two neighbouring samples of a hairline. */
const SAMPLE_STEP = 4;

let measureCtx = null;

/** Label widths, measured on a canvas at the label group's font, the way
 *  makeTable measures its names. Not read off the <text> nodes: during a
 *  switch animation they're mid-crossfade, and a carried pin is placed
 *  the moment that animation starts. */
function labelWidth(name) {
    const group = document.querySelector("#chart g.tech-labels");
    if (!group) return 0;
    if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
    const cs = getComputedStyle(group);
    measureCtx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return measureCtx.measureText(name).width;
}

/**
 * Points along everything the wheel draws undimmed for the current
 * selection, each with the clearance it needs, in wheel coordinates
 * (origin at the wheel's centre). Taken from the same setupHighlights
 * call makeWheel draws from, so this is the lit set by construction.
 *
 * Computed from wheelData rather than read off the DOM, for two reasons.
 * A carried pin is placed while the switch animation has every element
 * at its *old* position. And an arc's bounding box is useless here: a
 * quarter-circle arc's box is a whole quadrant, while the arc itself is a
 * hairline along one edge of it.
 */
function litSamples(wheelData) {
    const { allTechs, labelRadius, techImgRadius, arcSpace } = wheelData;
    const count = allTechs.length;
    const { highlightedIds, selectionPrerequisites, selectedSpokes } = setupHighlights(allTechs);
    const lit = new Set(highlightedIds);
    if (window.app.selected) lit.add(window.app.selected.id);

    const samples = [];
    const radial = (pos, from, to, clear) => {
        const n = Math.max(0, Math.ceil((to - from) / SAMPLE_STEP));
        for (let k = 0; k <= n; k++) {
            const p = calculatePointOnWheel(count, pos, n ? from + (to - from) * k / n : from);
            samples.push({ x: p.x, y: p.y, clear });
        }
    };

    allTechs.forEach((t, i) => {
        if (!lit.has(t.id)) return;
        radial(i, techImgRadius, techImgRadius, CLEAR_ICON);
        // Labels read outward from labelRadius on both halves of the wheel
        // (the far half is flipped and end-anchored — see wheelTransform).
        radial(i, labelRadius, labelRadius + labelWidth(t.name), CLEAR_LABEL);
    });

    for (const spoke of selectedSpokes) {
        // Same inner radius rule as drawSpokes.
        const inner = spoke.step >= 0 ? ringRadius(spoke.step, arcSpace) : 0;
        radial(spoke.position, inner, techImgRadius, CLEAR_LINE);
    }

    for (const d of selectionPrerequisites) {
        if (d.step === undefined) continue;
        const { startAngle, endAngle, radius } = unlockArcGeom(d, arcSpace);
        const n = Math.max(1, Math.ceil(Math.abs(endAngle - startAngle) * radius / SAMPLE_STEP));
        for (let k = 0; k <= n; k++) {
            // d3-shape measures from 12 o'clock; calculatePointOnWheel's
            // angles (and Math.cos/sin) from 3 o'clock. Same direction.
            const a = startAngle + (endAngle - startAngle) * k / n - Math.PI / 2;
            samples.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius, clear: CLEAR_LINE });
        }
    }
    return samples;
}

/** Where `corner` puts a tipW × tipH box: anchored, then clamped inside
 *  the SVG as a safety net for a box too big for the space. Viewport
 *  coordinates. */
function cornerRect(corner, svgRect, tipW, tipH) {
    let { left, top } = corner.anchor(svgRect, tipW, tipH);
    left = clamp(left, svgRect.left, svgRect.right - tipW);
    top = clamp(top, svgRect.top, svgRect.bottom - tipH);
    return { left, top, right: left + tipW, bottom: top + tipH };
}

/**
 * Choose the corner to dock to, as a placed rect.
 *
 * Corners are filtered on what the box would actually cover: one is clear
 * when its rect, at its real size and position, touches none of the lit
 * samples. Among the clear ones, the most visible wins — that's what lets
 * a selection at the top of a wheel whose bottom is below the fold get its
 * tooltip in a top corner, where the old angle-only rule always sent it
 * to the bottom and out of sight. The angle gap breaks ties, so on a fully
 * visible wheel the choice matches the old rule whenever that rule's pick
 * was clear.
 *
 * Visibility never overrides clearance: if no corner is clear, it's
 * pickCorner's choice, on screen or not (see pickCorner for why).
 */
function chooseCorner(tech, allTechs, svgRect, tipW, tipH) {
    const gaps = cornerGaps(tech, allTechs);
    const placed = (corner) => cornerRect(corner, svgRect, tipW, tipH);

    const wheel = document.querySelector("#chart g.wheel");
    const ctm = wheel && wheel.getScreenCTM();
    if (!ctm || !window.app.wheelData) return placed(pickCorner(gaps));

    // Wheel coordinates -> viewport pixels. The wheel group's transform is
    // a fixed translate (svgInit), never animated, so this is exact even
    // mid-switch. Uniform scale: the viewBox is square and preserved.
    const scale = Math.hypot(ctm.a, ctm.b);
    const points = litSamples(window.app.wheelData).map((p) => ({
        x: ctm.a * p.x + ctm.c * p.y + ctm.e,
        y: ctm.b * p.x + ctm.d * p.y + ctm.f,
        clear: p.clear * scale,
    }));
    const isClear = (r) => points.every((p) =>
        p.x < r.left - p.clear || p.x > r.right + p.clear ||
        p.y < r.top - p.clear || p.y > r.bottom + p.clear);

    const band = visibleBand();
    const clear = CORNERS
        .map((corner) => ({ corner, rect: placed(corner) }))
        .filter((c) => isClear(c.rect))
        .map((c) => ({ ...c, seen: visibleFraction(c.rect, band) }));
    if (clear.length === 0) return placed(pickCorner(gaps));

    // Visibility compared to the nearest percent, so a sliver of
    // difference between two mostly-hidden corners doesn't outrank the
    // angle gap.
    const seen = (c) => Math.round(c.seen * 100);
    clear.sort((a, b) => seen(b) - seen(a) || gaps.get(b.corner) - gaps.get(a.corner));
    return clear[0].rect;
}

/**
 * Dock the tooltip to whichever SVG corner clears the current selection
 * and is most visible (see chooseCorner), clamped inside the SVG bounding
 * box as a safety net for a tooltip too big for the space it was docked
 * into.
 *
 * The box is absolutely positioned in document coordinates (see #tooltip
 * in techs.css), so the viewport rect is shifted by the scroll offset.
 * That's what keeps it attached to its corner when the page scrolls: a
 * corner below the fold comes into view along with the wheel.
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
        updateDetailsHint();
        return;
    }
    releaseSheetSpace();
    resetSheetStyles(tipBox);

    // Tooltip dimensions: read offset* lazily so a previously-hidden box
    // doesn't return zero. CSS sets min/max widths so this is stable.
    const tipW = tipBox.offsetWidth || 400;
    const tipH = tipBox.offsetHeight || 200;

    const { left, top } = chooseCorner(tech, allTechs, svgRect, tipW, tipH);

    tipBox.style.left = `${left + window.scrollX}px`;
    tipBox.style.top = `${top + window.scrollY}px`;
    updateDetailsHint();
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
