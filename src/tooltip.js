import { select } from "d3-selection";

import { TOTAL_WIDTH } from "./constants";
import { eraDisplayName } from "./eraData";
import { calculatePointOnWheel } from "./helpers";

/**
 * Hover tooltip for tech / civic nodes. Reuses the markup originally
 * authored for the now-removed click-modal (#tooltip and friends in
 * index.html); CSS for position is overridden here per call.
 *
 * Positioning is *antipodal*: the tooltip's centre is placed across the
 * wheel from the hovered node, in the labels-area band. Rationale lives in
 * the design discussion that motivated this module — TL;DR is "anywhere
 * the selected arcs are likely to be is wrong, and arcs concentrate near
 * the hovered node, so far away is right." Result is then clamped inside
 * the SVG bounds so it never escapes off-screen. (An experiment docking
 * the tooltip in the wheel's hub was rejected: it sat on top of the inner
 * arcs, including the selection's own highlight chain.)
 */

const SELECTORS = {
    box:        "#tooltip",
    name:       "#tipName",
    img:        "#tipImg",
    cost:       "#tipCost",
    costLine:   "#tipCostLine",
    noLine:     "#tipNoLine",
    mandLine:   "#tipMandLine",
    mand:       "#tipMand",
    plusLine:   "#tipPlusLine",
    optLine:    "#tipOptLine",
    opt:        "#tipOpt",
    leads:      "#tipLeads",
    mldLine:    "#tipMldLine",
    mld:        "#tipMld",
    oldLine:    "#tipOldLine",
    old:        "#tipOld",
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
 * Show the tooltip for `tech`. Pulls render context (allTechs, labelRadius,
 * iconFolder) off `window.app` so callers don't have to thread it through.
 */
export function showTooltip(tech) {
    const app = window.app;
    if (!app || !app.wheelData) return;

    const {
        allTechs,
        labelRadius,
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
    positionTooltipAt(tech, allTechs.length, labelRadius);
    // While pinned the tooltip advertises it (stronger border, visible
    // close button — see #tooltip.pinned in techs.css). Hover previews
    // are suppressed during a pin, so a shown tooltip is either a plain
    // hover preview or THE pinned tech, never a mixture.
    tipBox.classed("pinned", Boolean(app.pinned));
    tipBox.classed("hidden", false);
}

export function hideTooltip() {
    select(SELECTORS.box)
        .classed("pinned", false)
        .classed("hidden", true);
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

    const noPrereqs = required.length === 0 && optional.length === 0;
    if (noPrereqs) {
        select(SELECTORS.noLine).text(availabilityText(tech, eraRanges, game));
    }
    select(SELECTORS.noLine).classed("hidden", !noPrereqs);

    if (required.length > 0) {
        select(SELECTORS.mand).text(joinList(required, "and"));
        select(SELECTORS.mandLine).classed("hidden", false);
    } else {
        select(SELECTORS.mandLine).classed("hidden", true);
    }
    if (optional.length > 0) {
        select(SELECTORS.opt).text(joinList(optional, "or"));
        select(SELECTORS.optLine).classed("hidden", false);
        // "plus" only shows when both required and optional rows are visible.
        select(SELECTORS.plusLine).classed("hidden", required.length === 0);
    } else {
        select(SELECTORS.optLine).classed("hidden", true);
        select(SELECTORS.plusLine).classed("hidden", true);
    }

    // Required for (outgoing edges).
    //   reqFor: techs that hard-require this one
    //   optFor: techs that optionally require this one
    const requiredFor = (tech.reqFor || []).map((r) => nameOf(r.id));
    const optionalFor = (tech.optFor || []).map((r) => nameOf(r.id));

    const hasOutgoing = requiredFor.length > 0 || optionalFor.length > 0;
    select(SELECTORS.leads).classed("hidden", !hasOutgoing);

    if (requiredFor.length > 0) {
        select(SELECTORS.mld).text(joinList(requiredFor, "and"));
        select(SELECTORS.mldLine).classed("hidden", false);
    } else {
        select(SELECTORS.mldLine).classed("hidden", true);
    }
    if (optionalFor.length > 0) {
        select(SELECTORS.old).text(joinList(optionalFor, "and"));
        select(SELECTORS.oldLine).classed("hidden", false);
    } else {
        select(SELECTORS.oldLine).classed("hidden", true);
    }
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
                // Items with unique variants span both grid columns so
                // the variant chips sit unambiguously with their base
                // item instead of interleaving the two-column packing.
                // Owner-tagged exclusives span too: "Immortal (Achaemenid
                // Persian)" ellipsizes in a half-width column.
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

/**
 * Place the tooltip's centre at the antipode of the hovered node in screen
 * space, then clamp inside the SVG bounding box.
 *
 * The wheel renders into an SVG with a 1200×1200 viewBox; the rendered
 * size is whatever the page CSS gives it (currently `width: min(100%,
 * 95vh)`). So we work in screen pixels by reading getBoundingClientRect
 * and converting through `scale = renderedSide / TOTAL_WIDTH`.
 */
function positionTooltipAt(tech, count, labelRadius) {
    const tipBox = select(SELECTORS.box).node();
    const svgEl = document.querySelector("#chart svg");
    if (!tipBox || !svgEl) return;

    const svgRect = svgEl.getBoundingClientRect();
    const scale = svgRect.width / TOTAL_WIDTH;

    // Hovered node's offset from the wheel centre, in viewBox coords.
    const onLabelRing = calculatePointOnWheel(count, tech.position, labelRadius);

    // Reflect through the centre to get the antipodal point, then convert
    // back to screen coords. The wheel <g> is centred in the SVG, so the
    // SVG's screen centre IS the wheel's screen centre.
    const cx = svgRect.left + svgRect.width / 2;
    const cy = svgRect.top + svgRect.height / 2;
    const antipodeX = cx - onLabelRing.x * scale;
    const antipodeY = cy - onLabelRing.y * scale;

    // Tooltip dimensions: read offset* lazily so a previously-hidden box
    // doesn't return zero. CSS sets min/max widths so this is stable.
    const tipW = tipBox.offsetWidth || 400;
    const tipH = tipBox.offsetHeight || 200;

    // Anchor the tooltip's centre to the antipode, then clamp so it never
    // escapes the SVG. Clamping is per-axis so an antipode that's near the
    // edge slides the tooltip along that edge rather than snapping to the
    // corner.
    let left = antipodeX - tipW / 2;
    let top = antipodeY - tipH / 2;
    left = clamp(left, svgRect.left, svgRect.right - tipW);
    top = clamp(top, svgRect.top, svgRect.bottom - tipH);

    tipBox.style.left = `${left}px`;
    tipBox.style.top = `${top}px`;
}


function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
}
