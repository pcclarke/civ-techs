import { select } from "d3-selection";
import "d3-transition";

import { ROW_H } from "./constants";
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
 * Arcs, pins, req/opt marks, and era boundaries are shaped by a row
 * *range*, not a single row, so — same call as the wheel — they just fade
 * out and the new set fades in; see fadeSwapLayer in animateWheelSwitch.js,
 * reused here as-is (its opacity is set via .style(), specifically so it
 * also works on the era boundaries, which are <div>s rather than SVG).
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
export function animateSpokeLines(layer, spokeData, count, spokeX1, textLeft, highlightedIds = []) {
    const rowY = (pos) => pos * ROW_H + ROW_H / 2;
    const readY = (node) => parseFloat(node.getAttribute("y1")) || 0;
    // .attr(), not .style(), for this layer's opacity (see animateSpokes in
    // animateWheelSwitch.js) — a plain SVG presentation attribute is always
    // outranked by a CSS class, so .fade wins over whatever this tween
    // drives without any of the row-level opacity juggling above.
    const fade = (d) => fadeCheck(d, highlightedIds);

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
