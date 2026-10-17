import { select } from "d3-selection";
import "d3-transition";

import { fadeInToResting, lerpGeom } from "./animateWheelSwitch";
import { arcKey, markKey } from "./arcs";
import { ROW_H } from "./constants";
import { eraJoinKey } from "./drawEras";
import { onNodeClick, onNodeHover, onNodeLeave } from "./drawTools";
import { fadeCheck } from "./helpers";

/**
 * Table-view counterpart to animateWheelSwitch.js — see that file's doc
 * comment for the shared reasoning this mirrors: stable ids across games,
 * why lane metrics snap to the target instead of tweening (same as the
 * wheel's radii — both are recomputed per dataset from that game's own
 * label widths), why start values are read live off the DOM rather than a
 * snapshot of the outgoing data (rapid repeated switching redirects from
 * wherever an element actually is instead of wherever an interrupted
 * transition was heading), and why every reclaimed node gets `.interrupt()`
 * before anything else touches it.
 *
 * The table has no angle to rotate through, but its row order is the same
 * "era, then depth" ordering the wheel sweeps clockwise through — just
 * unrolled into a vertical list — so the analogous motion is vertical:
 *
 *   - new advances fade in sliding down from the first row's position;
 *   - continuing advances slide from their old row to their new one, their
 *     icon crossfading to the new game's art as they move (same two-node
 *     technique as the wheel — a continuing advance's icon href is built
 *     from `${game}/img/${folder}/${id}.png` and differs on essentially
 *     every switch);
 *   - departing advances continue sliding down to the *new* table's last
 *     row, fading out — arriving there, not overshooting past it, since a
 *     list (unlike the wheel's circle) has no wraparound to reach for.
 *
 * Arcs, pins, req/opt marks and era boundaries are shaped by a row
 * *range* rather than a single row, and once simply faded out while the
 * new set faded in. They all travel now, on the same curve as the rows —
 * see the Arc layer section at the foot of this file and animateEraRows.
 * Nothing in either view crossfades a whole layer any more.
 */

const MOVE_MS = 700;

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function readTop(node) {
    return parseFloat(node.style.top) || 0;
}

/**
 * Once a row's own transition ends, drop the inline `opacity`/`transition`
 * this animation set rather than leaving them at "opacity: 1". Unlike the
 * wheel's icons — which set opacity via the SVG `opacity` *attribute*, a
 * presentation attribute that a CSS class rule always outranks — a plain
 * HTML element only responds to `style.opacity` (or an actual CSS rule),
 * so the transition has to drive it through inline style. Left in place,
 * that inline "1" would permanently outrank .tt-row.fade's `opacity: 0.05`
 * — the row would never dim on hover again. Clearing both restores the
 * row to exactly drawRows' non-animated state: no inline opacity/transition
 * at all, dimming controlled purely by the .fade class.
 */
function settleRowStyle(node) {
    node.style.opacity = "";
    node.style.transition = "";
}

/** Linear tween from `start` to `target`, used for both a row's `top` and
 *  a spoke's y — there's no boundary-precision hazard here the way the
 *  wheel's angle math had (plain multiplication, no trig), so the tween
 *  needs no settle correction beyond landing on the exact value at t=1. */
function lerp(start, target) {
    return (t) => start + (target - start) * t;
}

/**
 * Fade the old icon out while a fresh one (the new game's art) fades in on
 * top of it, inside the row's .tt-icon-slot wrapper (see techs.css).
 *
 * Both icons carry the same .tt-icon class, so after a rapid run of
 * switches the slot can transiently hold more than one still-fading
 * element — whichever was appended *last* is the one a previous cycle
 * left as the intended resident (document order === append order), so
 * that's the one demoted here. Anything older than that was already told
 * to fade out and remove itself in whichever earlier cycle demoted it —
 * this never needs to look further back than one step.
 */
function crossfadeIcon(rowNode, d, game, iconFolder) {
    const slot = rowNode.querySelector(".tt-icon-slot");
    if (!slot) return;
    const imgs = slot.querySelectorAll("img.tt-icon");
    const oldImg = imgs[imgs.length - 1];
    if (oldImg) {
        select(oldImg).interrupt()
            .transition().duration(MOVE_MS).ease(easeInOutCubic)
            .style("opacity", 0)
            .remove();
    }
    select(slot).append("img")
        .attr("class", "tt-icon")
        .attr("decoding", "sync")
        .attr("alt", "")
        .attr("src", `${game}/img/${iconFolder}/${d.id}.png`)
        .style("opacity", 0)
        .transition().duration(MOVE_MS).ease(easeInOutCubic)
        .style("opacity", 1);
}

/**
 * Rows: icon + name, one per advance, keyed by id exactly like the wheel's
 * labels/images.
 */
export function animateRows(root, allTechs, count, opts) {
    const { game, iconFolder, eraOf, highlightedIds = [] } = opts;
    const rowHTML = (d) =>
        `<span class="tt-icon-slot"><img class="tt-icon" decoding="sync" src="${game}/img/${iconFolder}/${d.id}.png" alt=""></span>`
        + `<span class="tt-name">${d.name}</span>`;
    const eraAttr = (d) => (eraOf.has(d.position) ? eraOf.get(d.position) % 2 : null);
    const fade = (d) => fadeCheck(d, highlightedIds);
    const pinned = (d) => Boolean(window.app.pinned) && window.app.pinned.id === d.id;
    // A dimmed row's opacity target is 0.05, not 1 — .tt-row.fade only
    // wins the cascade once the inline opacity this animation drives is
    // gone (see settleRowStyle), so while the transition is still in
    // control the *inline* target itself has to already be the dimmed
    // value, or a persisting pin's highlight chain would flash at full
    // brightness for the whole move before snapping dim at the very end.
    const opacityFor = (d) => (fade(d) ? 0.05 : 1);

    root.selectAll("div.tt-row")
        .data(allTechs, (d) => d.id)
        .join(
            (enter) => enter.append("div")
                .attr("class", "tt-row")
                .attr("data-id", (d) => d.id)
                .attr("data-era", eraAttr)
                .classed("fade", fade)
                .classed("pinned", pinned)
                .style("height", `${ROW_H}px`)
                .style("top", "0px")
                // .tt-row carries a CSS `transition: opacity 0.5s ease`
                // (for hover-fade) that would otherwise fight this
                // d3-driven fade — every tick is itself a "change" the CSS
                // transition tries to ease toward. Killed for the duration,
                // restored once this transition ends (see .on("end", ...)).
                .style("transition", "none")
                .style("opacity", 0)
                .html(rowHTML)
                .on("mouseover", onNodeHover)
                .on("mouseleave", onNodeLeave)
                .on("click", onNodeClick)
                .call((sel) => sel.transition().duration(MOVE_MS).ease(easeInOutCubic)
                    .style("opacity", opacityFor)
                    .styleTween("top", (d) => {
                        const t = lerp(0, d.position * ROW_H);
                        return (u) => `${t(u)}px`;
                    })
                    .on("end", function () { settleRowStyle(this); })),
            (update) => update
                // A row reclaimed mid-flight from a still-running enter or
                // exit needs that old schedule killed outright, not just
                // superseded — see animateWheelSwitch.js's animateSpokes
                // for why .interrupt() has to come before opacity is
                // reasserted, not after.
                .interrupt()
                .style("transition", "none")
                .classed("fade", fade)
                .classed("pinned", pinned)
                .style("opacity", opacityFor)
                .attr("data-era", eraAttr)
                .each(function (d) {
                    crossfadeIcon(this, d, game, iconFolder);
                    const nameEl = this.querySelector(".tt-name");
                    if (nameEl) nameEl.textContent = d.name;
                })
                .call((sel) => sel.transition().duration(MOVE_MS).ease(easeInOutCubic)
                    .styleTween("top", function (d) {
                        const t = lerp(readTop(this), d.position * ROW_H);
                        return (u) => `${t(u)}px`;
                    })
                    .on("end", function () { settleRowStyle(this); })),
            (exit) => exit.interrupt().style("transition", "none")
                .call((sel) => sel.transition().duration(MOVE_MS).ease(easeInOutCubic)
                    .style("opacity", 0)
                    .styleTween("top", function () {
                        const t = lerp(readTop(this), (count - 1) * ROW_H);
                        return (u) => `${t(u)}px`;
                    })
                    .remove())
        );
}

/**
 * Spokes — the wheel's radial lines, laid flat here too: a horizontal hairline
 * from an advance's lane across to its icon. Only the row (y) end of each
 * needs to move; x1/x2 come from the lane assignment and the text's left
 * edge, both already snapped to this render's own values by the caller,
 * same as the wheel leaves radius untweened.
 */
export function animateSpokeLines(layer, spokeData, count, spokeX1, textLeft, dimAll = false) {
    const rowY = (pos) => pos * ROW_H + ROW_H / 2;
    const readY = (node) => parseFloat(node.getAttribute("y1")) || 0;
    // Unlike rows (dimmed per-tech, via fadeCheck against the highlight
    // chain — see animateRows), this base spoke layer dims *uniformly*
    // whenever anything is selected, exactly like drawSpokeLines' own
    // non-animated `Boolean(selected)` call — the actual highlighted chain
    // is a separate overlay (layer.spokesSel), often anchored to a
    // *different* lane than a dependent advance's own arc (setupSpokes
    // roots a dependent's highlighted spoke at the selected advance's
    // lane, not its own). Dimming this layer per-tech instead of uniformly
    // — an earlier version did — left a highlighted-but-not-current
    // advance's base spoke undimmed at its own lane, competing visibly
    // with the correct overlay spoke at the selected advance's lane:
    // exactly the "spoke doesn't end at its own line" bug reported after a
    // switch carried a pin over (see initWheelData.js).
    //
    // .attr(), not .style(), for this layer's opacity (see animateSpokes in
    // animateWheelSwitch.js) — a plain SVG presentation attribute is always
    // outranked by a CSS class, so .fade wins over whatever this tween
    // drives without any of the row-level opacity juggling above.
    const fade = () => dimAll;

    layer.selectAll("line")
        .data(spokeData, (d) => d.id)
        .join(
            (enter) => enter.append("line")
                .attr("class", "tt-spoke")
                .classed("fade", fade)
                .attr("x1", spokeX1)
                .attr("x2", textLeft)
                .attr("y1", rowY(0))
                .attr("y2", rowY(0))
                .attr("opacity", 0)
                .call((sel) => sel.transition().duration(MOVE_MS).ease(easeInOutCubic)
                    .attr("opacity", 1)
                    .tween("y", (d) => {
                        const t = lerp(rowY(0), rowY(d.position));
                        return function (u) {
                            const y = t(u);
                            this.setAttribute("y1", y);
                            this.setAttribute("y2", y);
                        };
                    })),
            (update) => update.interrupt()
                .attr("opacity", 1)
                .classed("fade", fade)
                .attr("x1", spokeX1)
                .attr("x2", textLeft)
                .call((sel) => sel.transition().duration(MOVE_MS).ease(easeInOutCubic)
                    .tween("y", function (d) {
                        const t = lerp(readY(this), rowY(d.position));
                        return function (u) {
                            const y = t(u);
                            this.setAttribute("y1", y);
                            this.setAttribute("y2", y);
                        };
                    })),
            (exit) => exit.interrupt().call((sel) => sel.transition().duration(MOVE_MS).ease(easeInOutCubic)
                .attr("opacity", 0)
                .tween("y", function () {
                    const t = lerp(readY(this), rowY(count - 1));
                    return function (u) {
                        const y = t(u);
                        this.setAttribute("y1", y);
                        this.setAttribute("y2", y);
                    };
                })
                .remove())
        );
}


/**
 * Era boundaries: the table's counterpart to the wheel's era wedges.
 *
 * These went through a layer-wide crossfade, which empties the layer and
 * redraws it, so every boundary blinked out and back on a switch —
 * including the ones belonging to an era both games have. Two things made
 * that worse than it looked: the crossfade removed every child *before*
 * the redraw ran, so the keyed join behind it never matched anything; and
 * the key was the raw `d.era` string, which would have failed anyway,
 * since Civ 3
 * calls it "Modern Times" where Civ 6 calls it ERA_MODERN. Keyed on
 * eraJoinKey, the same canonical identity the wheel uses, a boundary that
 * exists in both games now slides from its old row to its new one.
 *
 * Far simpler than the wheel's equivalent: a boundary's position is one
 * number (`first * ROW_H`), so there are no angles to unwrap, no 180
 * degree flip, and no partition to keep airtight — the wedges had to
 * share moving edges because they tile the wheel, whereas these are
 * independent hairlines with nothing between them to leave a gap in.
 *
 * Arrivals and departures fade, like the wheel's era labels: a boundary
 * is a single row position, so there's no span to collapse onto a
 * neighbour.
 */
export function animateEraRows(root, eraRanges) {
    const resident = new Map();
    root.selectAll("div.tt-era").each(function (d) {
        if (d) resident.set(eraJoinKey(d), this);
    });

    const arriving = new Set(eraRanges.map(eraJoinKey));
    for (const [key, node] of resident) {
        if (arriving.has(key)) continue;
        select(node).interrupt()
            .transition().duration(MOVE_MS).ease(easeInOutCubic)
            .style("opacity", 0)
            .remove();
    }

    for (const d of eraRanges) {
        const target = d.first * ROW_H;
        const old = resident.get(eraJoinKey(d));

        if (old) {
            // Rebind the datum: the next switch reads the key off it.
            select(old).interrupt().datum(d)
                .transition().duration(MOVE_MS).ease(easeInOutCubic)
                .styleTween("top", () => {
                    const move = lerp(readTop(old), target);
                    return (t) => `${move(t)}px`;
                })
                // Land on the exact value rather than the tween's last
                // step, so a later switch reads a clean start position.
                .on("end", function () { this.style.top = `${target}px`; });
            continue;
        }

        // fadeInToResting rather than a fade to 1: nothing sets a resting
        // opacity on .tt-era today, but hard-coding the target is the
        // mistake that made the era wedges flash, and this is the one
        // shared implementation that reads it instead of assuming.
        fadeInToResting(
            root.append("div").attr("class", "tt-era").datum(d).style("top", `${target}px`),
            MOVE_MS,
        );
    }
}


// --------------------------- Arc layer ---------------------------

/**
 * The table's arc layer travels, exactly as the wheel's now does — see
 * animateArcs in animateWheelSwitch.js for the reasoning, the measured
 * churn in the underlying data, and why the real problem with the old
 * treatment was not the absence of motion but the blank middle: the
 * layer-wide crossfade took everything to opacity 0 over 250ms and only
 * then brought the new set up, so the arcs vanished out of the centre of
 * a 700ms switch while the rows slid on around them.
 *
 * This side is the easier one. The wheel has to interpolate an angle and
 * a ring radius and rebuild an annular sector per frame; here an arc is a
 * vertical line in a lane, so the geometry is a Cartesian (x, y) pair
 * read straight off the element's own attributes. No stash is needed —
 * unlike the wheel's arcs, whose radii cannot be recovered from a path's
 * `d` string, every number here is sitting in an attribute already, so
 * this follows the file's usual habit of reading live from the DOM.
 *
 * Sizes snap rather than tween: `mark` and `pinHalf` come out of
 * laneMetrics and change with the lane *count*, so like the wheel's icon
 * width they are a property of the layout rather than of where a thing
 * is. Position travels; size arrives.
 */

function attrNum(node, name) {
    return parseFloat(node.getAttribute(name)) || 0;
}

/**
 * One keyed switch over a part of the table's arc layer. Mirrors
 * animateRingPart on the wheel side: departures fade out, arrivals fade
 * in through fadeInToResting (every part of this layer carries a
 * selection-driven `.fade` class whose 0.05 an inline opacity would
 * outrank), and survivors tween their geometry without touching opacity
 * at all.
 */
function animateLanePart({ layer, tag, cls, data, keyOf, geomOf, readGeom, apply, paintAttr, paintOf, fadeOf }) {
    const resident = new Map();
    layer.selectAll(tag).each(function (d) {
        if (d) resident.set(keyOf(d), this);
    });

    const arriving = new Set(data.map(keyOf));
    for (const [key, node] of resident) {
        if (arriving.has(key)) continue;
        select(node).interrupt()
            .transition().duration(MOVE_MS).ease(easeInOutCubic)
            .style("opacity", 0)
            .remove();
    }

    data.forEach((d, i) => {
        const to = geomOf(d);
        const old = resident.get(keyOf(d));

        if (old) {
            const from = readGeom(old);
            // Rebind: the next switch keys off this datum.
            select(old).interrupt().datum(d).classed("fade", fadeOf(d, i))
                .transition().duration(MOVE_MS).ease(easeInOutCubic)
                // Colour interpolates: the ordinal scale is keyed by step,
                // so a survivor that changes lane changes hue too.
                .attr(paintAttr, paintOf(d))
                .tween("lane", function () {
                    return (t) => apply(this, lerpGeom(from, to, t));
                })
                // Land on the exact target, so the next switch reads a
                // clean start value back out of the attributes.
                .on("end", function () { apply(this, to); });
            return;
        }

        const sel = layer.append(tag).datum(d)
            .attr("class", cls)
            .classed("fade", fadeOf(d, i))
            .attr(paintAttr, paintOf(d));
        apply(sel.node(), to);
        fadeInToResting(sel, MOVE_MS);
    });
}

export function animateTableArcs(layer, arcs, laneX, rowY, color, dimAll = false) {
    animateLanePart({
        layer, tag: "line", cls: "tt-arc", data: arcs, keyOf: arcKey,
        geomOf: (d) => ({ x: laneX(d.step), y0: rowY(d.range[0]), y1: rowY(d.range[1]) }),
        readGeom: (n) => ({ x: attrNum(n, "x1"), y0: attrNum(n, "y1"), y1: attrNum(n, "y2") }),
        apply: (n, g) => {
            n.setAttribute("x1", g.x);
            n.setAttribute("x2", g.x);
            n.setAttribute("y1", g.y0);
            n.setAttribute("y2", g.y1);
        },
        paintAttr: "stroke", paintOf: (d) => color(d.step),
        fadeOf: () => dimAll,
    });
}

export function animateTablePins(layer, arcs, laneX, rowY, pinHalf, color, fadeOf) {
    animateLanePart({
        layer, tag: "line", cls: "tt-pin", data: arcs, keyOf: arcKey,
        geomOf: (d) => ({ x: laneX(d.step), y: rowY(d.position) }),
        readGeom: (n) => ({
            x: (attrNum(n, "x1") + attrNum(n, "x2")) / 2,
            y: attrNum(n, "y1"),
        }),
        apply: (n, g) => {
            n.setAttribute("x1", g.x - pinHalf);
            n.setAttribute("x2", g.x + pinHalf);
            n.setAttribute("y1", g.y);
            n.setAttribute("y2", g.y);
        },
        paintAttr: "stroke", paintOf: (d) => color(d.step),
        fadeOf,
    });
}

export function animateTableSquares(layer, squareData, laneX, rowY, mark, color, fadeOf) {
    animateLanePart({
        layer, tag: "rect", cls: "tt-req", data: squareData, keyOf: markKey,
        geomOf: (d) => ({ x: laneX(d.step), y: rowY(d.pos) }),
        readGeom: (n) => ({
            x: attrNum(n, "x") + attrNum(n, "width") / 2,
            y: attrNum(n, "y") + attrNum(n, "height") / 2,
        }),
        apply: (n, g) => {
            n.setAttribute("x", g.x - mark / 2);
            n.setAttribute("y", g.y - mark / 2);
            n.setAttribute("width", mark);
            n.setAttribute("height", mark);
        },
        // A square is filled, not stroked.
        paintAttr: "fill", paintOf: (d) => color(d.step),
        fadeOf,
    });
}

export function animateTableCircles(layer, circleData, laneX, rowY, mark, color, fadeOf) {
    animateLanePart({
        layer, tag: "circle", cls: "tt-opt", data: circleData, keyOf: markKey,
        geomOf: (d) => ({ x: laneX(d.step), y: rowY(d.pos) }),
        readGeom: (n) => ({ x: attrNum(n, "cx"), y: attrNum(n, "cy") }),
        apply: (n, g) => {
            n.setAttribute("cx", g.x);
            n.setAttribute("cy", g.y);
            n.setAttribute("r", mark / 2);
        },
        // Stroked, not filled: .tt-opt gets its white fill from
        // techs.css, exactly as the static path relies on.
        paintAttr: "stroke", paintOf: (d) => color(d.step),
        fadeOf,
    });
}
