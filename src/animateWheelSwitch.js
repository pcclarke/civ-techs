import { select } from "d3-selection";
import "d3-transition";

import { ARC_BASE, PI_DIFF, TECH_IMG_WIDTH, TWO_PI } from "./constants";
import { calculatePointOnWheel, fadeCheck, wheelTransform } from "./helpers";
import { onNodeClick, onNodeHover, onNodeLeave } from "./drawTools";

/**
 * Animates the wheel's spokes/icons/labels when a game/expansion/tree
 * switch replaces the dataset — see makeWheel.js's `renderWheel({ animate })`.
 * Tech ids are stable across games (verified against the actual data), so
 * a switch is three things happening to the same visual objects at once:
 *
 *   - new techs fade in at the wheel's 0° "start" marker and sweep
 *     clockwise to their slot;
 *   - continuing techs rotate to their new slot by the shortest path,
 *     their old icon crossfading to the new game's icon as they move;
 *   - departing techs continue clockwise past their old slot to the *new*
 *     wheel's last slot, fading out as they go — the far side of the
 *     wheel's reserved gap from where entrants appear, not the same point
 *     reached by going all the way around.
 *
 * Arcs and everything else shaped by an angular *range* rather than a
 * single point (pins, unlock marks, era wedges/labels) don't rotate —
 * their two ends would be moving independently, which has no sane tween —
 * they just fade out and the new set fades in; see fadeSwapLayer.
 *
 * Radii are not animated: every element jumps straight to its *target*
 * radius (each game recomputes labelRadius/techImgRadius/arcSpace from its
 * own label widths, so the old radius isn't meaningfully "where it should
 * ease from") and only angle is tweened, keeping the motion a clean arc
 * sweep rather than a spiral.
 *
 * Start angles are read straight off each element's *live* attribute
 * rather than computed from a snapshot of the outgoing data. That's what
 * makes rapid repeated switching degrade gracefully: d3 auto-interrupts a
 * running transition when a new one starts on the same node, and the next
 * tween just redirects from wherever the element actually is on screen —
 * not from wherever a previous, possibly-interrupted transition was
 * heading.
 */

const ROTATE_MS = 700;
const FADE_OUT_MS = 250;
const FADE_IN_MS = 450;

/** Angle of wheel position 0 — the same value calculatePointOnWheel gives
 *  it, independent of tech count. Entrants appear here and sweep forward;
 *  see lastAngle for where departures head instead, in the same clockwise
 *  direction the wheel already reads in. */
const TOP_ANGLE = -Math.PI / 2 + PI_DIFF;

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function mod(n, m) {
    return ((n % m) + m) % m;
}

/** Signed delta in (-π, π]: the shorter way from `from` to `to`. Used for
 *  continuing techs — whichever direction is closer. */
function shortestDelta(from, to) {
    return mod(to - from + Math.PI, TWO_PI) - Math.PI;
}

/** Non-negative delta that only ever goes forward (clockwise) from `from`
 *  to the next angle equivalent to `to`. Used for entrances (from
 *  TOP_ANGLE, always forward since every valid position's angle is ≥
 *  TOP_ANGLE) and exits (to lastAngle, continuing forward rather than
 *  snapping back — see lastAngle). */
function forwardDelta(from, to) {
    return mod(to - from, TWO_PI);
}

function pointAt(angle, radius) {
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** translate+rotate for icons/labels at a raw angle — same geometry as
 *  helpers.js's wheelTransform, just driven by an angle instead of a
 *  (count, index) pair so it can be tweened frame by frame. The flip test
 *  (text/icon upright on the left half) is wheelTransform's `index >
 *  count/2` rewritten in angle terms: that condition is exactly "more
 *  than halfway through the clockwise sweep from the top", which is the
 *  left semicircle, i.e. cos(angle) < 0. */
function transformAtAngle(angle, radius) {
    const { x, y } = pointAt(angle, radius);
    const deg = angle * (180 / Math.PI);
    const flip = Math.cos(angle) < 0;
    return `translate(${x}, ${y}) rotate(${deg - (flip ? 180 : 0)})`;
}

function spokeD(angle, innerR, outerR) {
    const inner = pointAt(angle, innerR);
    const outer = pointAt(angle, outerR);
    return `M ${inner.x} ${inner.y} ${outer.x} ${outer.y}`;
}

/** Angle a translate-based node (icon/label) is currently drawn at. */
function readTransformAngle(node) {
    const t = node.getAttribute("transform") || "";
    const m = /translate\(\s*(-?[\d.eE+-]+)\s*,\s*(-?[\d.eE+-]+)\s*\)/.exec(t);
    if (!m) return TOP_ANGLE;
    return Math.atan2(parseFloat(m[2]), parseFloat(m[1]));
}

/** Angle a spoke path is currently drawn at, from its outer point. */
function readSpokeAngle(node) {
    const d = node.getAttribute("d") || "";
    const m = /M\s*(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/.exec(d);
    if (!m) return TOP_ANGLE;
    return Math.atan2(parseFloat(m[4]), parseFloat(m[3]));
}

function targetAngle(count, position) {
    return calculatePointOnWheel(count, position, 1).angle;
}

/** Angle of the wheel's last position — where a departing tech now heads,
 *  rather than continuing all the way around to TOP_ANGLE. Every valid
 *  on-wheel angle already falls at or before this one, so exits reach it
 *  by forward (clockwise) travel same as always, just a hair short of a
 *  full lap instead of a full one. */
function lastAngle(count) {
    return targetAngle(count, count - 1);
}

function spokeInnerRadius(step, arcSpace) {
    return step >= 0 ? ARC_BASE + arcSpace * step : 0;
}

// --------------------------- Spokes ---------------------------

export function animateSpokes(group, spokeData, count, techImgRadius, arcSpace, highlightedIds = []) {
    // A .fade class wins over the opacity attribute this tween drives
    // regardless — a CSS class always outranks a plain SVG presentation
    // attribute — so classing a dimmed advance here is enough to keep it
    // dim through its whole flight without touching the tween itself; see
    // makeWheel.js for why this can be non-empty at all mid-switch (a
    // pinned advance that survives into the new game keeps its highlight).
    const fade = (d) => fadeCheck(d, highlightedIds);

    group.selectAll(".spoke-line")
        .data(spokeData, (d) => d.id)
        .join(
            (enter) => enter.append("path")
                .attr("class", "spoke-line")
                .classed("fade", fade)
                .attr("opacity", 0)
                .attr("d", (d) => spokeD(TOP_ANGLE, spokeInnerRadius(d.step, arcSpace), techImgRadius))
                .call((sel) => sel.transition().duration(ROTATE_MS).ease(easeInOutCubic)
                    .attr("opacity", 1)
                    .attrTween("d", (d) => {
                        const inner = spokeInnerRadius(d.step, arcSpace);
                        const delta = forwardDelta(TOP_ANGLE, targetAngle(count, d.position));
                        return (t) => spokeD(TOP_ANGLE + delta * t, inner, techImgRadius);
                    })),
            (update) => update
                // A node reclaimed mid-flight from a still-running enter or
                // exit (see the module doc comment) needs that old schedule
                // killed outright, not just superseded — interrupting *and*
                // starting a new transition in the same tick left a window
                // where the dying transition's already-queued frame could
                // still land after this point and re-freeze opacity exactly
                // where it left off (observed stuck at fractional values
                // like 4.6e-5, not just 0). explicit .interrupt() collapses
                // that window: it kills the old schedule synchronously,
                // before opacity is reasserted or the new transition starts.
                .interrupt()
                .attr("opacity", 1)
                .classed("fade", fade)
                .call((sel) => sel.transition().duration(ROTATE_MS).ease(easeInOutCubic)
                    .attrTween("d", function (d) {
                        const inner = spokeInnerRadius(d.step, arcSpace);
                        const start = readSpokeAngle(this);
                        const delta = shortestDelta(start, targetAngle(count, d.position));
                        return (t) => spokeD(start + delta * t, inner, techImgRadius);
                    })),
            (exit) => exit.interrupt().call((sel) => sel.transition().duration(ROTATE_MS).ease(easeInOutCubic)
                .attr("opacity", 0)
                .attrTween("d", function (d) {
                    const inner = spokeInnerRadius(d.step, arcSpace);
                    const start = readSpokeAngle(this);
                    const delta = forwardDelta(start, lastAngle(count));
                    return (t) => spokeD(start + delta * t, inner, techImgRadius);
                })
                .remove())
        );
}

// --------------------------- Labels ---------------------------

export function animateTechLabels(group, allTechs, count, labelRadius, highlightedIds = []) {
    const fade = (d) => fadeCheck(d, highlightedIds);
    const anchorAt = (angle) => (Math.cos(angle) < 0 ? "end" : "start");
    // A tech sitting at position count/2 exactly (Nationalism does, in
    // Civ 4: 43 of 86) has a *mathematically* exact target angle of π/2 —
    // but cos(π/2) is only ~6e-17 from zero even computed directly, and
    // the tween's start+delta arithmetic accumulates its own rounding on
    // top of that, enough to occasionally land on the other side of zero.
    // Harmless mid-flight — anchorAt still drives every frame, and being
    // off by a hair of angle for one tick is invisible — but the *settled*
    // state can't be left to whichever way that coin flip landed: the
    // transform's rotation carries the exact same cos(angle)<0 flip
    // (`transformAtAngle`'s `flip`), and if it disagrees with text-anchor
    // — anchor says "start" but the rotation was chosen for "end" — the
    // text renders mirrored, growing back into the wheel instead of out
    // toward the rim. Fixing text-anchor alone (an earlier version of this
    // did) can *introduce* that disagreement rather than prevent it. So on
    // settle (.on("end", ...) below — never on an interrupt, only whichever
    // transition actually finishes), both attributes are set together from
    // wheelTransform/the same `position > count/2` test drawTechLabels'
    // non-animated path uses — the two can never disagree with each other
    // because neither is computed from the tween's accumulated angle.
    const settledAnchor = (d) => (d.position > count / 2 ? "end" : "start");
    function settle(node, d) {
        node.setAttribute("transform", wheelTransform(count, d.position, labelRadius));
        node.setAttribute("text-anchor", settledAnchor(d));
    }

    // text-anchor is a keyword, not a number — there's no way to smoothly
    // interpolate "start" into "end". Setting it once, up front, to the
    // label's *final* orientation (as an earlier version did) means it's
    // wrong for the label's entire flight whenever that flight crosses the
    // wheel's vertical meridian: the text hangs off the wrong end and runs
    // back over the wheel instead of out toward the rim, for the full
    // ROTATE_MS — or longer, if several switches chain together before the
    // rotation catches up, which is what made it read as "stuck" rather
    // than a quick flash. Tying it to the label's *instantaneous* angle
    // every frame instead — via a plain .tween() that writes both
    // attributes together — flips it at the exact moment the label
    // visually crosses the meridian, matching what's on screen throughout
    // the flight rather than jumping ahead of it.
    function angleTween(startAngle, delta) {
        return function (t) {
            const angle = startAngle + delta * t;
            this.setAttribute("transform", transformAtAngle(angle, labelRadius));
            this.setAttribute("text-anchor", anchorAt(angle));
        };
    }

    group.selectAll("text")
        .data(allTechs, (d) => d.id)
        .join(
            (enter) => enter.append("text")
                .classed("fade", fade)
                .attr("y", 5)
                .attr("opacity", 0)
                .attr("text-anchor", anchorAt(TOP_ANGLE))
                .attr("transform", transformAtAngle(TOP_ANGLE, labelRadius))
                .text((d) => d.name)
                .on("mouseover", onNodeHover)
                .on("mouseleave", onNodeLeave)
                .on("click", onNodeClick)
                .call((sel) => sel.transition().duration(ROTATE_MS).ease(easeInOutCubic)
                    .attr("opacity", 1)
                    .tween("angle", (d) => angleTween(
                        TOP_ANGLE,
                        forwardDelta(TOP_ANGLE, targetAngle(count, d.position))
                    ))
                    .on("end", function (d) { settle(this, d); })),
            (update) => update
                // See animateSpokes' update branch for why .interrupt()
                // comes first: superseding via a new transition alone left
                // a window where the dying transition's already-queued
                // frame could still land afterward and re-freeze opacity
                // wherever it left off.
                .interrupt()
                .attr("opacity", 1)
                .classed("fade", fade)
                .text((d) => d.name)
                .call((sel) => sel.transition().duration(ROTATE_MS).ease(easeInOutCubic)
                    .tween("angle", function (d) {
                        const start = readTransformAngle(this);
                        return angleTween(start, shortestDelta(start, targetAngle(count, d.position)));
                    })
                    .on("end", function (d) { settle(this, d); })),
            (exit) => exit.interrupt().call((sel) => sel.transition().duration(ROTATE_MS).ease(easeInOutCubic)
                .attr("opacity", 0)
                .tween("angle", function () {
                    const start = readTransformAngle(this);
                    return angleTween(start, forwardDelta(start, lastAngle(count)));
                })
                .remove())
        );
}

// --------------------------- Icons ---------------------------

/**
 * Icons get different treatment from spokes/labels: a continuing tech's
 * `xlink:href` is built from `${game}/img/${folder}/${id}.png`, and `game`
 * (often `folder` too) changes on every switch, so the href differs for
 * essentially every continuing tech, essentially every time. Updating it
 * in place would always be a hard pop. Instead a continuing tech gets two
 * nodes riding the identical angle tween: the existing node rides out as
 * the outgoing icon (old art, fades 1→0, removed at the end) while a
 * freshly appended node is the incoming icon (new art, fades 0→1),
 * starting from the same live position so the two travel together and the
 * icon visibly dissolves from old to new over the move rather than
 * swapping at any single instant. The incoming node becomes the resident
 * node for that id once the transition ends.
 */
export function animateTechImages(group, allTechs, count, techImgRadius, game, iconFolder, highlightedIds = []) {
    const fade = (d) => fadeCheck(d, highlightedIds);
    const existingById = new Map();
    group.selectAll(".tech-image").each(function (d) {
        existingById.set(d.id, this);
    });
    const newIds = new Set(allTechs.map((t) => t.id));

    for (const [id, node] of existingById) {
        if (newIds.has(id)) continue;
        const start = readTransformAngle(node);
        const delta = forwardDelta(start, lastAngle(count));
        // .tech-image carries a CSS `transition: opacity 0.5s ease` (for
        // hover-fade) that would otherwise fight this d3-driven opacity
        // tween — every attribute tick is itself a "change" the CSS
        // transition tries to ease toward, chasing a moving target. Killed
        // here so d3 has sole control of opacity for the duration.
        //
        // .interrupt() first: this node may itself be mid-fade already
        // (e.g. it was the "incoming" half of a crossfade from the switch
        // before this one, still easing toward opacity 1) — superseding
        // via the new .transition() alone left a window where that dying
        // schedule's already-queued frame could still land afterward.
        select(node).interrupt().style("transition", "none")
            .transition().duration(ROTATE_MS).ease(easeInOutCubic)
            .attr("opacity", 0)
            .attrTween("transform", () => (t) => transformAtAngle(start + delta * t, techImgRadius))
            .remove();
    }

    for (const d of allTechs) {
        const href = `${game}/img/${iconFolder}/${d.id}.png`;
        const oldNode = existingById.get(d.id);
        const start = oldNode ? readTransformAngle(oldNode) : TOP_ANGLE;
        const end = targetAngle(count, d.position);
        const delta = oldNode ? shortestDelta(start, end) : forwardDelta(start, end);

        if (oldNode) {
            select(oldNode).interrupt().style("transition", "none")
                .transition().duration(ROTATE_MS).ease(easeInOutCubic)
                .attr("opacity", 0)
                .attrTween("transform", () => (t) => transformAtAngle(start + delta * t, techImgRadius))
                .remove();
        }

        group.append("image")
            .attr("class", "tech-image")
            .classed("fade", fade(d))
            .datum(d)
            .attr("width", TECH_IMG_WIDTH)
            .attr("height", TECH_IMG_WIDTH)
            .attr("x", -TECH_IMG_WIDTH / 2)
            .attr("y", -TECH_IMG_WIDTH / 2)
            .attr("xlink:href", href)
            .style("transition", "none")
            .attr("opacity", 0)
            .attr("transform", transformAtAngle(start, techImgRadius))
            .on("mouseover", onNodeHover)
            .on("mouseleave", onNodeLeave)
            .on("click", onNodeClick)
            .transition().duration(ROTATE_MS).ease(easeInOutCubic)
            .attr("opacity", 1)
            .attrTween("transform", () => (t) => transformAtAngle(start + delta * t, techImgRadius))
            // Pin the settled transform to the exact non-animated formula,
            // same reasoning as animateTechLabels' `settle`: transformAtAngle's
            // flip is a razor's-edge cos(angle)<0 test that the tween's
            // accumulated start+delta arithmetic can land on the wrong side
            // of for a tech sitting exactly at position count/2, rendering
            // the icon upside down relative to where wheelTransform would
            // put it. Only reachable on natural completion, never mid-flight.
            .on("end", function (d) {
                select(this).style("transition", null)
                    .attr("transform", wheelTransform(count, d.position, techImgRadius));
            });
    }
}

// --------------------- Range-shaped layers (fade only) ---------------------

/**
 * Arcs, pins, unlock marks, and era wedges/labels are all shaped by an
 * angular *range* (two ends, not one point) or are otherwise incidental
 * decoration — there's no sane way to tween a shape whose ends are moving
 * independently, so they simply fade out, then the new set (already laid
 * out at its final position by `redraw`, the layer's normal non-animated
 * draw function from drawTools.js/drawEras.js) fades in.
 *
 * `.end()` rejects if a transition is interrupted (e.g. a second switch
 * arriving before this one finishes) — caught rather than left to surface
 * as an unhandled rejection; the redraw still happens using whatever data
 * this call closed over; a still-newer render will draw over it shortly.
 */
export async function fadeSwapLayer(group, childTag, redraw) {
    const existing = group.selectAll(childTag);
    if (!existing.empty()) {
        try {
            // .style(), not .attr(): this is reused for the mobile table's
            // era-boundary <div>s too (see animateTableSwitch.js), and a
            // bare `opacity` attribute is an SVG presentation attribute —
            // HTML ignores it outright. Inline style opacity works
            // identically on both, so one code path covers both views.
            await existing.transition().duration(FADE_OUT_MS).style("opacity", 0).end();
        } catch {
            // interrupted — fall through and redraw anyway
        }
    }
    group.selectAll(childTag).remove();
    redraw(group)
        .style("opacity", 0)
        .transition().duration(FADE_IN_MS).ease(easeInOutCubic)
        .style("opacity", 1)
        // Cleared once settled, not left at "1": several of these layers
        // (arcs, pins, req/opt marks) carry their own selection-driven
        // `.fade` class independently of any row/label's own — an inline
        // style always outranks a class rule, so a lingering "opacity: 1"
        // here would silently defeat that class's `opacity: 0.05` on every
        // hover from then on. Dropping it hands opacity back to whatever
        // class (or its absence) says it should be, exactly where the
        // non-animated draw path leaves it.
        .on("end", function () { this.style.opacity = ""; });
}

/** Same fade-out/fade-in treatment for the hub's game logo. */
export function fadeSwapCenterImage(centerImage, href) {
    centerImage.transition().duration(FADE_OUT_MS).attr("opacity", 0)
        .on("end", function () {
            select(this).attr("xlink:href", href)
                .transition().duration(FADE_IN_MS).ease(easeInOutCubic)
                .attr("opacity", 1);
        });
}
