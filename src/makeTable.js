import { select } from "d3-selection";

import { onNodeClick, onNodeHover, onNodeLeave } from "./drawTools";
import { eraDisplayName } from "./eraData";
import { fadeCheck } from "./helpers";
import { color } from "./makeWheel";
import { setupHighlights } from "./setupHighlights";

/**
 * Mobile view: the wheel unrolled from polar to Cartesian coordinates.
 *
 * The wheel can't work on a phone. Its coordinate system is a fixed 1200
 * units scaled to the narrow axis, so on a 375px screen every label
 * renders at ~4.8px — and no font size fixes that, because the number of
 * labels around the rim is set by the data, not the viewport. Making the
 * text bigger just makes labels collide.
 *
 * A vertical table escapes that trap: rows extend downward without limit,
 * so label size stops competing with item count. Each advance becomes a
 * row and each arc a vertical line in a lane beside it — the same shape
 * as a git commit graph, which is a layout people already know how to
 * read.
 *
 * Nothing here recomputes layout. `createUnlocks` already packs arcs into
 * non-overlapping `step`s using their index `range`; the wheel maps step
 * to a ring radius, and this maps the identical number to a lane column.
 * Same algorithm, same values, different axis:
 *
 *     wheel                        table
 *     -----                        -----
 *     angle  = position / count    y = position * ROW_H
 *     radius = ARC_BASE + step     x = step * laneW
 *     arc spans an angular range   line spans a row range
 */

/** Row pitch. Every row is exactly this tall — no exceptions — because
 *  the lane overlay computes y positions as `position * ROW_H` rather
 *  than measuring the DOM. That's also why era captions are absolutely
 *  positioned in their own layer instead of being blocks in the flow:
 *  anything that added height would desynchronise the two.
 *
 *  34 rather than a touch-target 44: the longest tree is 92 rows, and
 *  every pixel here is multiplied by that. The row spans the full width,
 *  so the tap target stays large in the axis that's easy to miss in. */
const ROW_H = 34;
/** Bounds on the horizontal pitch between arc lanes. The pitch isn't
 *  fixed: lane *count* comes from the data (Civ 4 BTS packs 17, Civ 7
 *  only 6), so the lanes are spread to fill whatever room sits left of
 *  the text — see laneMetrics. The floor is where 5px marks in adjacent
 *  lanes start to touch; the ceiling stops a sparse tree's lanes drifting
 *  so far apart they stop reading as a single graph. */
const LANE_W_MAX = 24;
const LANE_W_MIN = 6;
/** Breathing room between the last lane and the icon column. */
const LANE_GUTTER = 8;
/** Marks matching the wheel's: squares = required, circles = optional.
 *  Shrinks with the lane pitch so they stay separated when lanes tighten. */
const MARK_MAX = 5;


/**
 * Work out the lane pitch, gutter width and mark sizes for this render.
 *
 * The lanes are given the whole span to the left of the text and divided
 * evenly, so the graph grows to use its space instead of huddling against
 * the left edge with a dead channel before the names. Because that span
 * is fixed by the text (see contentLeft, which depends only on the widest
 * name), the lanes can never encroach on it however many of them there
 * are — a dense tree just gets a tighter pitch.
 *
 * Clamped at both ends: below LANE_W_MIN neighbouring marks touch, and
 * above LANE_W_MAX a six-lane tree would fling its lanes so far apart
 * they'd stop reading as one diagram.
 */
function laneMetrics(laneCount, spanForLanes) {
    if (!laneCount) {
        return { laneW: 0, gutterW: 0, mark: MARK_MAX, pinHalf: 4 };
    }
    const budget = spanForLanes > 0 ? spanForLanes : laneCount * LANE_W_MAX;
    const laneW = Math.max(LANE_W_MIN, Math.min(LANE_W_MAX, budget / laneCount));
    return {
        laneW,
        gutterW: laneCount * laneW + LANE_GUTTER,
        // Keep at least ~2px of clear space between adjacent marks.
        mark: Math.min(MARK_MAX, Math.max(3, laneW - 2)),
        pinHalf: Math.min(4, laneW * 0.45),
    };
}


/**
 * Left offset for the icon + name block, chosen so the widest advance
 * name finishes flush against the table's right edge.
 *
 * Names are measured on a canvas rather than in the DOM: `.tt-name` is a
 * flex child that stretches to fill the row, so its scrollWidth reports
 * the *box* rather than the text, and forcing each one to max-content to
 * measure it would thrash layout once per row. The icon width and row gap
 * are read back from the rendered elements so this can't silently drift
 * from techs.css.
 *
 * Floored at the space the lanes need at their tightest pitch, so a
 * narrow screen with long names gives the lanes their minimum and lets
 * the names ellipsize rather than the two colliding.
 */
function contentLeft(root, allTechs, laneCount) {
    const minForLanes = laneCount ? laneCount * LANE_W_MIN + LANE_GUTTER : 0;
    const rowEl = root.select(".tt-row").node();
    const nameEl = root.select(".tt-name").node();
    const iconEl = root.select(".tt-icon").node();
    const availW = root.node() ? root.node().clientWidth : 0;
    if (!rowEl || !nameEl || !availW) return minForLanes;

    const ctx = contentLeft._ctx
        || (contentLeft._ctx = document.createElement("canvas").getContext("2d"));
    ctx.font = getComputedStyle(nameEl).font;
    let widest = 0;
    for (const t of allTechs) {
        const w = ctx.measureText(t.name).width;
        if (w > widest) widest = w;
    }

    const iconW = iconEl ? iconEl.getBoundingClientRect().width : 24;
    const gap = parseFloat(getComputedStyle(rowEl).gap) || 0;
    // +1 absorbs sub-pixel rounding so the longest name can't be clipped
    // into an ellipsis by a fraction of a pixel.
    return Math.max(minForLanes, availW - iconW - gap - Math.ceil(widest) - 1);
}


/**
 * Draw one row per advance: icon plus name.
 *
 * HTML rather than SVG text so names get native ellipsis, selection and
 * hit-testing. Row height is fixed at ROW_H, so these line up with the
 * lane overlay by construction rather than by measurement. The rows'
 * left offset isn't set here — it arrives as the --tt-content-left
 * custom property once the text has been measured.
 */
function drawRows(root, allTechs, opts) {
    const { game, iconFolder, highlightedIds, eraOf } = opts;
    root.selectAll("div.tt-row")
        .data(allTechs, (d) => d.id)
        .join("div")
        .attr("class", "tt-row")
        .classed("fade", (d) => fadeCheck(d, highlightedIds))
        .classed("pinned", (d) => Boolean(window.app.pinned)
            && window.app.pinned.id === d.id)
        .attr("data-era", (d) => eraOf.has(d.position)
            ? eraOf.get(d.position) % 2 : null)
        .style("top", (d) => `${d.position * ROW_H}px`)
        .style("height", `${ROW_H}px`)
        .on("mouseover", onNodeHover)
        .on("mouseleave", onNodeLeave)
        .on("click", onNodeClick)
        .html((d) =>
            `<img class="tt-icon" src="${game}/img/${iconFolder}/${d.id}.png" alt="">`
            + `<span class="tt-name">${d.name}</span>`);
}


/**
 * Render the table into #table. Reads the same window.app.wheelData the
 * wheel does, so switching views needs no data reload.
 */
export function renderTable() {
    const { game, tree, selected, wheelData } = window.app;
    if (!wheelData) return;

    const iconFolder = (tree && tree.folder) || "technologies";
    const {
        allTechs,
        prerequisites,
        spokeData,
        squareData,
        circleData,
        eraRanges,
    } = wheelData;

    const {
        highlightedIds,
        selectionPrerequisites,
        selectedSpokes,
        prerequisiteIds,
    } = setupHighlights(allTechs);

    const root = select("#table");
    if (root.empty()) return;

    // Lane count comes from the arcs actually drawn, so a tree with few
    // dependencies doesn't reserve a wide empty gutter.
    const arcs = prerequisites.filter((d) => Number.isFinite(d.step));
    const laneCount = arcs.length
        ? Math.max(...arcs.map((d) => d.step)) + 1
        : 0;
    const bodyH = allTechs.length * ROW_H;

    // Era lookup by row, so each row can be tinted and the first row of
    // an era can caption itself.
    const eraOf = new Map();
    const eraStart = new Map();
    eraRanges.forEach((r, i) => {
        for (let p = r.first; p <= r.last; p++) eraOf.set(p, i);
        eraStart.set(r.first, r);
    });

    // Rows are built before the lanes because the lane geometry is derived
    // from where the text starts, and that in turn is measured from a
    // rendered name (for its font). Rows themselves need no lane geometry
    // — their left offset arrives afterwards as a CSS variable.
    drawRows(root, allTechs, {
        game, iconFolder, selected, highlightedIds, eraOf,
    });

    // The text block's left edge depends only on the widest name, so it's
    // a fixed wall the lanes can be fitted against.
    const textLeft = contentLeft(root, allTechs, laneCount);
    const { laneW, gutterW, mark, pinHalf } =
        laneMetrics(laneCount, textLeft - LANE_GUTTER);

    root.style("--lane-gutter", `${gutterW}px`);
    root.style("--tt-content-left", `${textLeft}px`);

    // ----- lanes (SVG overlay, absolutely positioned over the rows) -----
    // No viewBox: 1 SVG unit is 1 CSS pixel, which is what keeps this
    // view immune to the scaling that makes the wheel illegible here.
    // Width runs to the text rather than stopping at the last lane, so
    // spokes can reach across to the icon they belong to.
    const svg = root.selectAll("svg.tt-lanes").data([null]).join("svg")
        .attr("class", "tt-lanes")
        .attr("width", textLeft)
        .attr("height", bodyH);

    // Paint order has to be pinned down with real groups rather than left
    // to the order elements happen to be created in. SVG paints in
    // document order, and d3's join appends *entering* elements at the end
    // of the parent — so when a game switch grows the arc count, the new
    // arcs land after the marks already in the DOM and start painting over
    // them. The result drifts with the history of game switches. Fixed
    // groups, created once bottom-to-top, make the stacking deterministic;
    // svgInit does the same for the wheel.
    // Spokes sit underneath the arcs, matching the wheel's own paint order
    // in svgInit.
    const layer = {};
    ["spokes", "spokesSel", "arcs", "sel", "pins", "marks"].forEach((name) => {
        layer[name] = svg.selectAll(`g.tt-l-${name}`).data([null])
            .join("g").attr("class", `tt-l-${name}`);
    });

    const laneX = (step) => step * laneW + laneW / 2;
    const rowY = (pos) => pos * ROW_H + ROW_H / 2;

    // Spokes — the wheel's radial lines, laid flat. Each runs from the
    // innermost lane that touches its advance out to the icon, which is
    // what lets the eye follow a row back to the lines belonging to it;
    // without them the names and the graph read as two separate columns.
    // setupSpokes marks an advance with no prerequisites using a negative
    // sentinel step; the wheel starts those at the centre, so here they
    // start at the left edge.
    const spokeX1 = (d) => (d.step >= 0 ? laneX(d.step) : 0);
    const drawSpokeLines = (sel, data) => sel.selectAll("line")
        .data(data, (d) => d.id)
        .join("line")
        .attr("class", "tt-spoke")
        .attr("x1", spokeX1)
        .attr("x2", textLeft)
        .attr("y1", (d) => rowY(d.position))
        .attr("y2", (d) => rowY(d.position));

    drawSpokeLines(layer.spokes, spokeData)
        .classed("fade", Boolean(selected));

    // The selection's own spokes, redrawn undimmed on top — the same
    // two-layer treatment the arcs get.
    drawSpokeLines(layer.spokesSel, selected ? selectedSpokes : [])
        .classed("tt-spoke-sel", true);

    // The arc itself: a vertical line from the origin advance down to the
    // furthest advance it leads to. When something is selected the whole
    // base layer dims and the highlight is drawn separately below, the
    // same two-layer scheme the wheel uses — see the note there.
    layer.arcs.selectAll("line")
        .data(arcs, (d) => d.id)
        .join("line")
        .attr("class", "tt-arc")
        .classed("fade", Boolean(selected))
        .attr("x1", (d) => laneX(d.step))
        .attr("x2", (d) => laneX(d.step))
        .attr("y1", (d) => rowY(d.range[0]))
        .attr("y2", (d) => rowY(d.range[1]))
        .attr("stroke", (d) => color(d.step));

    // Highlight layer, drawn over the dimmed base. These are not the same
    // lines re-coloured: getHighlightedTechs rebuilds each prerequisite
    // with its range clipped to the selected row
    // (`[start, min(end, selected.position)]`), so the lit segment stops
    // at the selection instead of running on to that advance's furthest
    // dependent. Selecting Animal Husbandry should light Agriculture's
    // line only as far as Animal Husbandry, not onward to Sailing.
    //
    // Entries without a `step` are the dependents and are spans of
    // nothing, so they're filtered out; the selected advance's own entry
    // keeps its full range, which is correct — that span is what it
    // leads to.
    const selectedArcs = selected
        ? selectionPrerequisites.filter((d) => Number.isFinite(d.step) && d.range)
        : [];

    layer.sel.selectAll("line")
        .data(selectedArcs, (d) => d.id)
        .join("line")
        .attr("class", "tt-arc-sel")
        .attr("x1", (d) => laneX(d.step))
        .attr("x2", (d) => laneX(d.step))
        .attr("y1", (d) => rowY(d.range[0]))
        .attr("y2", (d) => rowY(d.range[1]))
        .attr("stroke", (d) => color(d.step));

    // Origin tick — the wheel's perpendicular "pin", rotated 90°.
    layer.pins.selectAll("line")
        .data(arcs, (d) => d.id)
        .join("line")
        .attr("class", "tt-pin")
        .classed("fade", (d) => Boolean(selected)
            && d.id !== (selected && selected.id)
            && !prerequisiteIds.includes(d.id))
        .attr("x1", (d) => laneX(d.step) - pinHalf)
        .attr("x2", (d) => laneX(d.step) + pinHalf)
        .attr("y1", (d) => rowY(d.position))
        .attr("y2", (d) => rowY(d.position))
        .attr("stroke", (d) => color(d.step));

    layer.marks.selectAll("rect")
        .data(squareData)
        .join("rect")
        .attr("class", "tt-req")
        .classed("fade", (d) => Boolean(selected)
            && selected.id !== d.id && selected.id !== d.arcId)
        .attr("x", (d) => laneX(d.step) - mark / 2)
        .attr("y", (d) => rowY(d.pos) - mark / 2)
        .attr("width", mark)
        .attr("height", mark)
        .attr("fill", (d) => color(d.step));

    layer.marks.selectAll("circle")
        .data(circleData)
        .join("circle")
        .attr("class", "tt-opt")
        .classed("fade", (d) => Boolean(selected)
            && selected.id !== d.id && selected.id !== d.arcId)
        .attr("cx", (d) => laneX(d.step))
        .attr("cy", (d) => rowY(d.pos))
        .attr("r", mark / 2)
        .attr("stroke", (d) => color(d.step));

    // Era captions ride in their own absolutely-positioned layer rather
    // than inside the row. In the row they competed with the advance name
    // for width and truncated it ("Iron Worki…"), and they'd have been the
    // one row per era where the name is hardest to read.
    root.selectAll("div.tt-era")
        .data(eraRanges, (d) => d.era)
        .join("div")
        .attr("class", "tt-era")
        .style("top", (d) => `${d.first * ROW_H}px`)
        .text((d) => eraDisplayName(d.era));

    root.style("height", `${bodyH}px`);
}
