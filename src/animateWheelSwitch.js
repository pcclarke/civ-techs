import { select } from "d3-selection";
import "d3-transition";

import { ARC_BASE, PI_DIFF, TECH_IMG_WIDTH, TWO_PI } from "./constants";
import {
    arcKey, markKey, PIN_REACH, ringRadius, unlockArcAt, unlockArcGeom,
} from "./arcs";
import { calculatePointOnWheel, fadeCheck, wheelTransform } from "./helpers";
import {
    eraJoinKey, eraLabelIndex, eraLabelWidthCap, eraMorphPlan, eraWedge,
    squeezeEraLabel,
} from "./drawEras";
import { eraDisplayName } from "./eraData";
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
 * Arcs and the other things shaped by an angular *range* rather than a
 * single point (pins, unlock marks, era wedges and labels) once simply
 * faded out while the new set faded in, on the reasoning that a shape
 * whose two ends move independently has no sane tween. They all travel
 * now — the ends are just two numbers, and interpolating both turned out
 * to be exactly what the era wedges needed to stay airtight. See the Arc
 * layer and Era sections below; nothing in either view crossfades a whole
 * layer any more.
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

function lerp(from, to, t) {
    return from + (to - from) * t;
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

export function animateSpokes(group, spokeData, count, techImgRadius, arcSpace, dimAll = false) {
    // Unlike icons/labels (dimmed per-tech, via fadeCheck against the
    // highlight chain), the base spoke layer dims *uniformly* whenever
    // anything is selected — drawSpokes' non-animated call does the exact
    // same `Boolean(selected)`, not a per-tech check. The actual
    // highlighted chain is a completely separate overlay (svg.selectedSpokes),
    // often anchored to a *different* lane than a dependent tech's own arc
    // (setupSpokes roots a dependent's highlighted spoke at the selected
    // tech's lane, not its own). Dimming this layer per-tech instead of
    // uniformly — an earlier version did — left a highlighted-but-not-
    // current tech's base spoke undimmed at its own lane, competing
    // visibly with the correct overlay spoke at the selected tech's lane:
    // exactly the "spoke doesn't end at its own line" symptom reported
    // after a switch carried a pin over (see initWheelData.js).
    //
    // A .fade class wins over the opacity attribute this tween drives
    // regardless — a CSS class always outranks a plain SVG presentation
    // attribute — so classing a dimmed advance here is enough to keep it
    // dim through its whole flight without touching the tween itself.
    const fade = () => dimAll;

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

// --------------------------- Arc layer ---------------------------

/**
 * The arc layer — the arcs themselves, the origin pins, and the req/opt
 * marks — travels rather than crossfading.
 *
 * Why it is one section and not four: the three decorations sit *on* an
 * arc. A pin is the tick where its arc starts, and a square or circle is
 * where a dependent meets it, all on the same ring. Animating the arcs
 * alone would peel them apart, so they move together or not at all.
 *
 * Be aware of what the data does here, because it is not kind. Measured
 * across every switch in the project: only 53% of arcs survive by tech
 * id at all, and of those, just 15% stay on the same ring — 37% move four
 * rings or more (median 3, max 15), because `step` comes out of
 * createUnlocks' bin-packing and is repacked from scratch for each game.
 * An arc end travels a median 29 degrees, and arcs change *length* by a
 * median 11 degrees. So unlike the spokes, which all sweep the same
 * direction by similar amounts and read as one coherent rotation, this
 * layer's motion is genuinely incoherent: a few dozen arcs sliding
 * radially past each other while a similar number fade in and out.
 *
 * It is still an improvement on what it replaced, and not mainly because
 * of the motion. The old layer-wide crossfade faded everything to nothing
 * over 250ms and only *then* brought the new set up over 450ms, so the
 * arcs physically vanished from the middle of a 700ms switch while the
 * spokes swept on around them — which is what read as "the arcs don't
 * animate". Every
 * population here runs on the same ROTATE_MS/easeInOutCubic as the
 * spokes, concurrently, so the layer stays continuously populated.
 *
 * The radius is interpolated, which the rest of this file does not do.
 * Spokes and icons snap theirs because each game recomputes it from its
 * own label widths, making the old value meaningless to ease from. A ring
 * radius is not like that: it is where the arc *is*, and jumping three
 * rings instantly would be a pop in the middle of an otherwise continuous
 * layer. The integer `step` is deliberately not what travels — arcSpace
 * differs per game, so only the radius is comparable across a switch.
 */

/** Interpolate every number in a geometry record. A missing `from` key
 *  (a node that never recorded one) holds at the target, so the element
 *  simply doesn't move rather than flying in from a garbage value. */
export function lerpGeom(from, to, t) {
    const out = {};
    for (const k of Object.keys(to)) {
        const a = Number.isFinite(from[k]) ? from[k] : to[k];
        out[k] = lerp(a, to[k], t);
    }
    return out;
}

/**
 * One keyed switch over a part of the arc layer.
 *
 * `geomOf` gives a datum's target geometry, `apply` writes a geometry
 * onto a node, and the stash drawTools.js leaves in `__ringGeom` (see
 * rememberRing there) supplies where a survivor starts. Departures fade
 * out, arrivals fade in — an arc has no span to collapse onto a
 * neighbouring boundary the way an era wedge does, and nothing tiles here,
 * so there is no partition to keep airtight.
 *
 * Arrivals go through fadeInToResting rather than a fade to 1: every part
 * of this layer carries a selection-driven `.fade` class whose 0.05 an
 * inline opacity would outrank. Survivors never touch inline opacity at
 * all, so they stay clear of that entirely.
 */
function animateRingPart({ group, tag, data, keyOf, geomOf, apply, paintAttr, paintOf, shape, fadeOf }) {
    const resident = new Map();
    group.selectAll(tag).each(function (d) {
        if (d) resident.set(keyOf(d), this);
    });

    const arriving = new Set(data.map(keyOf));
    for (const [key, node] of resident) {
        if (arriving.has(key)) continue;
        select(node).interrupt()
            .transition().duration(ROTATE_MS).ease(easeInOutCubic)
            .style("opacity", 0)
            .remove();
    }

    data.forEach((d, i) => {
        const to = geomOf(d);
        const old = resident.get(keyOf(d));

        if (old) {
            const from = old.__ringGeom || to;
            old.__ringGeom = to;
            // Rebind: the next switch keys off this datum, and so do the
            // hover handlers already attached to the node.
            select(old).interrupt().datum(d).classed("fade", fadeOf(d, i))
                .transition().duration(ROTATE_MS).ease(easeInOutCubic)
                // Colour interpolates: the ordinal scale is keyed by step,
                // so a survivor that changes ring changes hue too.
                .attr(paintAttr, paintOf(d))
                .tween("ring", function () {
                    return (t) => apply(this, lerpGeom(from, to, t));
                })
                // Land on the exact target rather than the tween's last
                // step, so the next switch eases from a clean value.
                .on("end", function () { apply(this, to); });
            return;
        }

        const sel = group.append(tag).datum(d)
            .classed("fade", fadeOf(d, i))
            .attr(paintAttr, paintOf(d));
        if (shape) shape(sel);
        apply(sel.node(), to);
        sel.node().__ringGeom = to;
        fadeInToResting(sel, ROTATE_MS);
    });
}

export function animateArcs(group, prerequisites, color, arcSpace, dimAll = false) {
    const at = unlockArcAt();
    animateRingPart({
        group, tag: "path", data: prerequisites, keyOf: arcKey,
        geomOf: (d) => unlockArcGeom(d, arcSpace),
        apply: (node, g) => node.setAttribute("d", at(g)),
        paintAttr: "fill", paintOf: (d) => color(d.step),
        // Arcs share the node handlers, so hovering an arc behaves like
        // hovering its origin advance — same as the static path.
        shape: (sel) => sel
            .on("mouseover", onNodeHover)
            .on("mouseleave", onNodeLeave)
            .on("click", onNodeClick),
        fadeOf: () => dimAll,
    });
}

export function animateUnlockPins(group, prerequisites, count, color, arcSpace, fadeOf) {
    animateRingPart({
        group, tag: "path", data: prerequisites, keyOf: arcKey,
        geomOf: (d) => ({
            angle: targetAngle(count, d.position),
            radius: ringRadius(d.step, arcSpace),
        }),
        apply: (node, g) => node.setAttribute(
            "d", spokeD(g.angle, g.radius - PIN_REACH, g.radius + PIN_REACH)),
        paintAttr: "stroke", paintOf: (d) => color(d.step),
        fadeOf,
    });
}

/** Squares and circles differ only in tag and resting shape; both sit at a
 *  single (angle, ring) point, positioned by transform exactly as
 *  wheelTransform would. */
function animateMarks(group, tag, data, count, arcSpace, paintAttr, paintOf, shape, fadeOf) {
    animateRingPart({
        group, tag, data, keyOf: markKey,
        geomOf: (d) => ({
            angle: targetAngle(count, d.pos),
            radius: ringRadius(d.step, arcSpace),
        }),
        apply: (node, g) => node.setAttribute("transform", transformAtAngle(g.angle, g.radius)),
        paintAttr, paintOf, shape, fadeOf,
    });
}

export function animateUnlockSquares(group, squareData, count, color, arcSpace, fadeOf) {
    animateMarks(group, "rect", squareData, count, arcSpace,
        "fill", (d) => color(d.step),
        (sel) => sel.attr("x", -2.5).attr("y", -2.5).attr("width", 5).attr("height", 5),
        fadeOf);
}

export function animateUnlockCircles(group, circleData, count, color, arcSpace, fadeOf) {
    animateMarks(group, "circle", circleData, count, arcSpace,
        "stroke", (d) => color(d.step),
        (sel) => sel.attr("r", 2.5).attr("fill", "#FFF"),
        fadeOf);
}

// --------------------------- Shared fades ---------------------------

/**
 * Fade a freshly-drawn selection in to each element's *resting* opacity —
 * whatever value the CSS rules applying to it say it should have, read
 * before any inline opacity exists.
 *
 * Fading to a hard-coded 1 instead (as this did) is wrong for every layer
 * that rests below it: `.era-background` sits at 0.2 and anything
 * carrying `.fade` at 0.05, and the inline opacity a tween drives
 * outranks a class rule the whole way up. The era wedges ramped to five
 * times their intended tint, hit full saturation at the end of the
 * fade-in, then snapped back the instant the inline value was cleared on
 * settle — a dark flash just as the switch landed. Reading the target
 * first puts the end of the ramp exactly where the non-animated draw path
 * leaves the layer, which makes that clearing invisible.
 *
 * Every read happens before the first write, so this costs one style
 * recalc for the selection rather than one per element.
 */
export function fadeInToResting(selection, duration) {
    const resting = new Map();
    selection.each(function () {
        resting.set(this, getComputedStyle(this).opacity || "1");
    });

    return selection
        .style("opacity", 0)
        .transition().duration(duration).ease(easeInOutCubic)
        .style("opacity", function () { return resting.get(this); })
        // Cleared once settled rather than left at a literal number: a
        // lingering inline value would defeat `.fade`'s 0.05 on every
        // later hover. Dropping it hands opacity back to whatever class
        // (or its absence) says it should be.
        //
        // `end` only, deliberately not `interrupt`: a second switch
        // arriving mid-fade schedules its own fade-out on these same
        // elements, and that tween reads its start value from wherever
        // this one had actually reached. Clearing on interrupt would
        // instead snap the element up to resting opacity for a frame
        // before fading it out — a visible blip on rapid switching.
        // Nothing strands as a result: an interrupted element is either
        // removed by the call that interrupted it, or left running to
        // completion (a hover re-render writes attributes but does not
        // cancel transitions), so this handler still fires.
        .on("end", function () { this.style.opacity = ""; });
}

// --------------------------- Era wedges ---------------------------

/**
 * Era backgrounds are the one range-shaped layer that *can* be tweened,
 * because an era has an identity that outlives the dataset it came from.
 *
 * An era's identity is what makes this possible at all. Civ 3's
 * "Modern Times" and Civ 6's ERA_MODERN are the same era under different
 * spellings, and eraKey makes that identity explicit. eraMorphPlan turns
 * a switch into one ordered slot per wedge, each carrying the span it
 * starts from and the span it ends at:
 *
 *   - eras both games have       -> a real span at both ends, so the
 *                                   wedge slides, its fill interpolating
 *                                   to the new colour
 *   - eras only the new game has -> collapsed at the start, so it grows
 *   - eras only the old game had -> collapsed at the end, so it shrinks
 *                                   away and is removed
 *
 * All three are then the *same* tween over a pair of spans, which is what
 * lets one transition drive the whole layer. Adjacent slots are built to
 * share both their old and their new edge, so the edge between two wedges
 * is interpolated from one pair of numbers and the partition never opens
 * a gap — see eraMorphPlan for how the collapsed ends are placed, and why
 * anchoring each wedge to its nearest surviving neighbour instead is not
 * enough.
 *
 * This is what removes the blank gap the old treatment had. The
 * layer-wide crossfade emptied the whole layer before redrawing it, so
 * even an era present in both games fell to opacity 0 and came back, the
 * page showing through underneath for the length of the fade.
 *
 * Note what *isn't* animated here: opacity. Growing from nothing is the
 * reveal, and shrinking to nothing is the exit, so a wedge sits at the
 * resting 0.2 `.era-background` gives it from the first frame to the
 * last. That's deliberate — fading an entrance in while it grows would
 * put a lighter band along the very seam the growth exists to keep tight,
 * and it keeps this layer clear of the inline-opacity-versus-class
 * precedence trap fadeInToResting has to work around. Only the degenerate
 * case where nothing survives the switch (Civ 4 -> Civ 1, no era data at
 * all) has no boundary to travel to, and falls back to a plain fade.
 *
 * Only the angles tween; the radius snaps to this render's value, the
 * same choice the rest of this file makes (each game recomputes its radii
 * from its own label widths, so the old radius isn't a meaningful place
 * to ease from). Colour interpolation is d3's own: `.attr("fill", …)` on
 * a transition detects a colour string and interpolates it in RGB.
 *
 * Everything moves at ROTATE_MS on easeInOutCubic — the same duration and
 * easing as the spokes and icons rotating above it, and necessarily the
 * same as each other: two wedges sharing a boundary only stay flush if
 * both sides of it are interpolated on the identical curve.
 */
export function animateEraBackgrounds(group, eraRanges, color, outerRadius) {
    const wedge = eraWedge(outerRadius);

    // Read the spans currently on screen *before* the join rebinds data —
    // afterwards every node carries its incoming slot, and the dataset
    // the old spans came from is gone.
    const oldByKey = new Map();
    group.selectAll("path").each(function (d) {
        if (d && this.__eraAngles) oldByKey.set(eraJoinKey(d), this.__eraAngles);
    });

    const { slots } = eraMorphPlan(oldByKey, eraRanges);

    const all = group.selectAll("path").data(slots, eraJoinKey).join(
        (enter) => enter.append("path")
            .attr("class", "era-background")
            // Departures have no new colour to take; they keep the one
            // they were drawn with.
            .attr("fill", (d) => (d.index === null ? null : color(d.index)))
            // `from` is null in the fade case — nothing survived, so
            // there is no old span to start at and the wedge is simply
            // drawn where it belongs and faded up.
            .attr("d", (d) => wedge(d.from || d.to)),
        (update) => update,
        // With a slot per old key, d3's own exit should never fire.
        // Anything landing here has no plan entry to travel along.
        (exit) => exit.remove(),
    );

    // No era in common, so no shared geometry to travel through: fade.
    const arriving = all.filter((d) => d.fade && d.kind !== "exit");
    if (!arriving.empty()) fadeInToResting(arriving, FADE_IN_MS);
    const leaving = all.filter((d) => d.fade && d.kind === "exit");
    if (!leaving.empty()) {
        leaving.transition().duration(FADE_OUT_MS).style("opacity", 0).remove();
    }

    // Everything else travels from its old span to its new one. A
    // departure's new span is collapsed to zero width and an arrival's
    // old span is, so the same tween covers all three kinds — which is
    // the point: one tween, one easing, one duration, applied to slots
    // that share their edges, is what keeps the partition airtight.
    // Record where every wedge is headed, arrivals included. Doing this
    // only for the travelling slots left a fade-case arrival with no
    // stashed span at all, so the *next* switch read an empty oldByKey,
    // found no survivors, and fell back to crossfading — and stayed that
    // way until some non-animated render happened to repopulate it.
    // Departures are removed before anyone reads theirs.
    all.each(function (d) { if (d.to) this.__eraAngles = d.to; });

    const travelling = all.filter((d) => !d.fade);

    const moving = travelling
        .transition().duration(ROTATE_MS).ease(easeInOutCubic)
        .attrTween("d", (d) => (t) => wedge({
            startAngle: lerp(d.from.startAngle, d.to.startAngle, t),
            endAngle: lerp(d.from.endAngle, d.to.endAngle, t),
        }))
        // A departure is zero-width by now, so it needs no fade of its
        // own — it has nothing left to show.
        .on("end", function (d) { if (d.kind === "exit") this.remove(); });

    // Colour interpolation is d3's own: `.attr("fill", …)` on a
    // transition detects a colour string and interpolates it in RGB.
    moving.filter((d) => d.index !== null).attr("fill", (d) => color(d.index));

    return all;
}

// --------------------------- Era labels ---------------------------

/**
 * Era names travel with their wedge.
 *
 * These used to go through the layer-wide crossfade like every other
 * range-shaped layer, which blanks the layer and redraws it. That was
 * fine while
 * the wedges crossfaded too — but now that a wedge morphs, it left the
 * name of an era blinking out and back while the band it names slid
 * underneath, visibly breaking the association between the two for the
 * length of the switch.
 *
 * Staying put isn't the answer either. Measured across every switch in
 * the project, a surviving era's label travels a median of 21 degrees and
 * as much as 97, so a stationary name would be sitting over a different
 * era's band by the time the morph landed. So the label is keyed on era
 * identity and moved, and what happens to its *text* depends on whether
 * the two games even spell the era differently:
 *
 *   - 72% of surviving labels read identically on both sides — Civ 4, 5
 *     and 6 all spell it ERA_MODERN and eraDisplayName renders the same
 *     word — so the one node is carried across with no fade whatsoever.
 *     There is nothing to cross between, and crossfading a word into
 *     itself is just a blink.
 *   - the other 28% genuinely change wording ("Industrial Revolution" ->
 *     "Industrial", "Ancient" -> "Antiquity"). Glyphs can't tween, so the
 *     outgoing text fades out along the same path the incoming text fades
 *     in along: the two-node technique animateTechImages uses for a tech
 *     icon whose href changes, and fadeSwapCenterImage for the hub.
 *
 * Arrivals and departures just fade. A wedge can collapse to zero width
 * on a boundary because it *is* a span; a label is a single point with no
 * equivalent, and growing text out of nothing reads as a glitch.
 *
 * Opacity is deliberately untouched for a survivor that keeps its text.
 * These carry `.fade` while something is selected, and `.fade`'s 0.05 is
 * a class rule that any inline opacity outranks — the precedence trap
 * that made the era wedges flash. A survivor never writes inline opacity,
 * so it cannot fall into it; the two paths that do fade go through
 * fadeInToResting, which handles it.
 *
 * Travel runs at ROTATE_MS on easeInOutCubic, matching the wedge beneath
 * it, so a band and its name arrive together.
 */
export function animateEraLabels(group, eraRanges, color, radius, dimAll = false) {
    const widthCap = eraLabelWidthCap(radius);

    // Live state, read before anything rebinds data or appends a node.
    // Angles come off the rendered transform rather than a snapshot of the
    // outgoing data, so rapid switching redirects from wherever a label
    // actually is — the principle the rest of this file follows.
    const resident = new Map();
    group.selectAll("text").each(function (d) {
        if (d) resident.set(eraJoinKey(d), this);
    });

    const arriving = new Set(eraRanges.map(eraJoinKey));
    for (const [key, node] of resident) {
        if (arriving.has(key)) continue;
        select(node).interrupt()
            .transition().duration(FADE_OUT_MS)
            .style("opacity", 0)
            .remove();
    }

    // Both halves of a crossfade follow one path, so the motion is one
    // shared tween. A plain .tween rather than attrTween because it writes
    // the whole transform string itself — see transformAtAngle for why the
    // 180-degree flip has to be recomputed every frame from the
    // *instantaneous* angle rather than fixed up front: a label crossing
    // the wheel's vertical meridian mid-flight has to flip exactly when it
    // crosses, or it reads mirrored for the rest of the journey.
    const travel = (start, delta) => function () {
        return (t) => {
            this.setAttribute("transform", transformAtAngle(start + delta * t, radius));
        };
    };

    // Pin the settled transform to the exact formula drawEraLabels uses,
    // same reasoning as animateTechLabels' `settle`: transformAtAngle's
    // flip is a razor's-edge cos(angle) < 0 test, and the tween's
    // accumulated start+delta arithmetic can land on the wrong side of it
    // for a label sitting exactly on the meridian — which renders the name
    // mirrored, running back into the hub. Only reachable on natural
    // completion, never mid-flight. The squeeze is reapplied here too, so
    // an arriving label ends on the same glyph spacing the static path
    // would give it.
    const settle = (d) => function () {
        this.setAttribute("transform", wheelTransform(d.count, eraLabelIndex(d), radius));
        squeezeEraLabel(this, widthCap);
    };

    eraRanges.forEach((d, i) => {
        const old = resident.get(eraJoinKey(d));
        const text = eraDisplayName(d.era);
        const end = targetAngle(d.count, eraLabelIndex(d));
        const start = old ? readTransformAngle(old) : end;
        const delta = old ? shortestDelta(start, end) : 0;

        // Survivor keeping its wording: move the one node, no fade.
        if (old && old.textContent === text) {
            select(old).interrupt()
                .classed("fade", dimAll)
                .transition().duration(ROTATE_MS).ease(easeInOutCubic)
                .attr("fill", color(i))
                .tween("era-label-travel", travel(start, delta))
                .on("end", settle(d));
            return;
        }

        // Renamed: the outgoing text leaves along the incoming one's path.
        if (old) {
            select(old).interrupt()
                .transition().duration(ROTATE_MS).ease(easeInOutCubic)
                .style("opacity", 0)
                .tween("era-label-travel", travel(start, delta))
                .remove();
        }

        const node = group.append("text")
            .attr("class", "era-label")
            .classed("fade", dimAll)
            .datum(d)
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .attr("fill", color(i))
            .attr("transform", transformAtAngle(start, radius))
            .text(text);
        squeezeEraLabel(node.node(), widthCap);

        // fadeInToResting, not a fade to 1: an arrival drawn while
        // something is pinned carries `.fade`, whose resting opacity is
        // 0.05. A replacement travels alongside the text it replaces; a
        // genuine arrival has nowhere to travel from and only fades.
        // "end.settle" rather than "end" so this adds a listener instead
        // of replacing the one fadeInToResting uses to clear its inline
        // opacity.
        const tr = fadeInToResting(node, old ? ROTATE_MS : FADE_IN_MS);
        if (old) tr.tween("era-label-travel", travel(start, delta));
        tr.on("end.settle", settle(d));
    });
}

/**
 * Crossfade the hub's game logo.
 *
 * This used to fade the resident image out to opacity 0, swap its href on
 * `end`, and fade it back in — so for a quarter of a second the middle of
 * the wheel was simply empty. That was unremarkable while every other
 * layer crossfaded through nothing too; now that the spokes rotate and
 * the era wedges morph continuously, a hole in the hub is the one thing
 * left that blinks.
 *
 * Same two-node technique animateTechImages uses for the tech icons: the
 * outgoing logo fades down while a second image showing the incoming one
 * fades up over it, both on the same ROTATE_MS/easeInOutCubic curve as
 * the rest of the switch, so the hub dissolves from one logo to the next
 * instead of vanishing between them. Two stacked alpha images do dip to
 * about 75% combined coverage at the midpoint — that's inherent to any
 * crossfade, and it's exactly the dip the tech icons already have, so the
 * hub now matches them rather than being the one element that blanks.
 *
 * The difference from a tech icon is that this node can't be thrown away.
 * svgInit hands out a persistent `svg.centerImage` and the non-animated
 * render path writes straight to it (see makeWheel.js), so the resident
 * node has to survive the switch. Hence the overlay: the resident takes
 * over the new href once the crossfade lands, leaving the DOM exactly as
 * svgInit built it.
 */
export function fadeSwapCenterImage(centerImage, href) {
    const parent = select(centerImage.node().parentNode);

    // A switch arriving mid-crossfade. Settle the previous one outright
    // instead of just dropping its overlay — the resident still holds the
    // logo from *before* that crossfade, so discarding the overlay would
    // snap the hub back to a game two switches old for the length of the
    // next fade. The href rides on the node rather than being read back
    // out of the attribute, so no namespace getter is involved.
    const pending = parent.selectAll("image.center-incoming");
    if (!pending.empty()) {
        const settled = pending.node().__centerHref;
        pending.interrupt().remove();
        centerImage.interrupt().attr("opacity", 1);
        // Guarded: d3 reads a null *or undefined* attribute value as a
        // removal, so handing it a missing href would strip the hub image
        // outright. The stash is written the moment an overlay is created,
        // so this should be unreachable — but blanking the hub is too
        // visible a failure to leave to "should".
        if (settled) centerImage.attr("xlink:href", settled);
    }

    // Nothing to cross to. Worth checking because a *tree* switch (Civ 6
    // and 7 toggling technologies against civics) reloads the whole
    // dataset without changing the game, and the old code dutifully
    // blinked the hub out and back for it.
    if (centerImage.attr("xlink:href") === href) return;

    centerImage.interrupt()
        .transition().duration(ROTATE_MS).ease(easeInOutCubic)
        .attr("opacity", 0);

    // Geometry copied off the resident rather than recomputed from
    // GAME_IMG_WIDTH, so the overlay can't drift out of alignment with
    // whatever svgInit decided. Appended to the same parent, which puts
    // it immediately above the resident in paint order.
    const incoming = parent.append("image")
        .attr("class", "center-incoming")
        .attr("x", centerImage.attr("x"))
        .attr("y", centerImage.attr("y"))
        .attr("width", centerImage.attr("width"))
        .attr("height", centerImage.attr("height"))
        .attr("xlink:href", href)
        .attr("opacity", 0);
    incoming.node().__centerHref = href;

    incoming.transition().duration(ROTATE_MS).ease(easeInOutCubic)
        .attr("opacity", 1)
        .on("end", function () {
            // Hand the logo back to the resident and drop the overlay.
            // Both are fully opaque and showing the same image by now, so
            // the handover is invisible. The resident's own fade-out ended
            // on this same frame; interrupt guards against any skew
            // letting its last tick land after this.
            centerImage.interrupt().attr("xlink:href", href).attr("opacity", 1);
            this.remove();
        });
}
