import { arc } from "d3-shape";

import { GAME_IMG_WIDTH, LABEL_PADDING, PI_DIFF, TWO_PI_ADJ } from "./constants";
import { eraDisplayName, eraKey } from "./eraData";
import { wheelTransform } from "./helpers";

/**
 * Era visualization is two layers, drawn together so eras read as both a
 * background tint behind their techs and a name inside the wheel:
 *
 *   - drawEraBackgrounds: full wedges from the chart centre out to the icon
 *     ring, one per era, with a half-tech-slot of angular buffer so adjacent
 *     eras meet exactly between consecutive techs.
 *   - drawEraLabels: single text per era on the spoke at its angular
 *     midpoint, reading radially like the tech labels but centred in the
 *     annulus between the centre game image and the icon ring, so era
 *     names take no space away from the tech labels at the outer edge.
 *
 * Both are driven by the eraRanges array produced by computeEraRanges; each
 * entry is `{era, first, last, count}` where first/last are tech indices and
 * count is the total number of tech slots on the wheel.
 */

/**
 * The angular span of one era's wedge, as a bare pair of numbers.
 *
 * The span starts half a slot before the era's first tech and ends half a
 * slot after its last so the tech icons (which extend half their width
 * past the spoke) sit fully inside the coloured region. The first and
 * last eras intentionally bleed a small amount into the angular gap above
 * 12 o'clock — the gap is wider than a half-slot for any realistic tech
 * count, so the wedges stop well short of meeting at the top.
 *
 * Split out from the generator below so the switch animation can
 * interpolate the two numbers and rebuild the path once per frame: a
 * wedge's `d` string has no meaningful interpolation of its own. See
 * animateEraBackgrounds in animateWheelSwitch.js.
 */
/**
 * Join key for both era layers.
 *
 * The layer gets bound to two different datum shapes: an eraRanges entry
 * by the static draw path, and an eraMorphPlan slot by the animated one
 * (slots also cover *departing* eras, which are absent from eraRanges
 * altogether). A key function sees both — the incoming data and whatever
 * the existing nodes still carry — so it has to read either. Without
 * this, a hover re-render landing after a switch keyed every node on
 * screen to "" and treated the whole layer as departing.
 */
export function eraJoinKey(d) {
    return d.key || eraKey(d.era);
}

export function eraAngles(d) {
    return {
        startAngle: ((d.first - 0.5) / d.count) * TWO_PI_ADJ + PI_DIFF,
        endAngle: ((d.last + 0.5) / d.count) * TWO_PI_ADJ + PI_DIFF,
    };
}

/**
 * Arc generator for era wedges, taking an eraAngles pair rather than an
 * era range so the same generator serves both the static draw and the
 * per-frame animated rebuild. innerRadius=0 gives a solid pie slice all
 * the way to the centre; the centre image and arc rings sit on top.
 */
export function eraWedge(outerRadius) {
    return arc()
        .innerRadius(0)
        .outerRadius(outerRadius)
        .startAngle((a) => a.startAngle)
        .endAngle((a) => a.endAngle);
}

/**
 * Stash the span a wedge is currently drawn at on the node itself, so a
 * later switch can interpolate *from* it. The angles can't be recovered
 * from the rendered `d` attribute, and the datum they came from belongs
 * to the outgoing dataset — it's replaced wholesale on every load — so
 * the node is the only thing that persists across a switch.
 */
function rememberEraAngles(selection) {
    return selection.each(function (d) {
        this.__eraAngles = eraAngles(d);
    });
}

/**
 * Work out where every era wedge travels across one game switch.
 *
 * Pure geometry, no DOM: the caller supplies the spans currently on
 * screen (keyed by canonical era identity — it reads them off the nodes,
 * since the dataset they came from is already gone) plus the incoming
 * eraRanges, and gets back one *slot* per wedge to render, each with the
 * span it starts from and the span it ends at.
 *
 * Why slots rather than three independent populations. The era layer is a
 * partition: adjacent wedges share an edge exactly, which is the only
 * reason it reads as continuous bands instead of stripes. Animating each
 * wedge from its own old span to its own new span breaks that, because an
 * era appearing or disappearing has no counterpart to share an edge with
 * — the partition develops gaps the page shows through and overlaps that
 * tint twice, for the length of the morph.
 *
 * Anchoring each entrance and departure to its nearest surviving
 * neighbour is not enough either. Civ 4 -> Civ 7 replaces five
 * consecutive eras (Classical through Industrial) with one (Exploration);
 * collapse them all toward the one survivor behind them and they vacate
 * the middle of the wheel together, opening a 65-degree hole.
 *
 * So the lists are aligned into a single ordered slot sequence instead —
 * survivors as anchors, with each block's departures and arrivals between
 * them — and the degenerate ends are then filled in *from their
 * neighbours*: an arrival's start span collapses onto the previous slot's
 * old end, a departure's end span onto the previous slot's new end.
 * Consecutive slots therefore share both an old edge and a new edge, so
 * the edge between them is interpolated from one pair of numbers and the
 * partition stays airtight at every frame, whatever the two games' era
 * sets look like.
 *
 * `fade` comes back true on every slot when the two games share no era at
 * all (Civ 4 -> Civ 1, which has no era data): there is no common
 * geometry to travel through, so those wedges simply fade.
 *
 * @param {Map<string, {startAngle: number, endAngle: number}>} oldByKey
 * @param {Object[]} newRanges  eraRanges for the incoming dataset
 * @returns {{slots: Array<{key: string, kind: "morph"|"enter"|"exit",
 *            index: number|null, from: Object, to: Object, fade: boolean}>}}
 */
export function eraMorphPlan(oldByKey, newRanges) {
    const newKeys = newRanges.map((d) => eraKey(d.era));
    const newAngles = newRanges.map(eraAngles);
    const newIndexOf = new Map(newKeys.map((k, i) => [k, i]));
    // Old-wheel order is just ascending start angle; the outgoing
    // eraRanges array is no longer around to consult.
    const oldKeys = [...oldByKey.keys()].sort(
        (a, b) => oldByKey.get(a).startAngle - oldByKey.get(b).startAngle);

    const survives = (k) => oldByKey.has(k) && newIndexOf.has(k);
    const anySurvivor = oldKeys.some(survives);

    // Align the two orderings. Era order is chronological in every game,
    // so survivors appear in the same relative order on both sides and a
    // two-pointer walk is enough. Departures in a block are emitted
    // before its arrivals; either order chains correctly once the
    // degenerate ends are filled in below, so this just picks one.
    const slots = [];
    let i = 0;
    let j = 0;
    while (i < oldKeys.length || j < newKeys.length) {
        if (i < oldKeys.length && !survives(oldKeys[i])) {
            slots.push({ key: oldKeys[i], kind: "exit", index: null,
                from: oldByKey.get(oldKeys[i]), to: null, fade: !anySurvivor });
            i++;
        } else if (j < newKeys.length && !survives(newKeys[j])) {
            slots.push({ key: newKeys[j], kind: "enter", index: j,
                from: null, to: newAngles[j], fade: !anySurvivor });
            j++;
        } else if (i < oldKeys.length && j < newKeys.length && oldKeys[i] === newKeys[j]) {
            slots.push({ key: newKeys[j], kind: "morph", index: j,
                from: oldByKey.get(oldKeys[i]), to: newAngles[j], fade: false });
            i++;
            j++;
        } else {
            // Two survivors that disagree about their order — impossible
            // with the series' chronological era lists, but treating the
            // old one as a departure keeps the walk monotone rather than
            // looping, and degrades to a crossfade for that one wedge.
            slots.push({ key: oldKeys[i], kind: "exit", index: null,
                from: oldByKey.get(oldKeys[i]), to: null, fade: !anySurvivor });
            i++;
        }
    }

    if (!anySurvivor) return { slots };

    // Fill the degenerate ends from the neighbouring slot, so every pair
    // of adjacent slots shares an edge in both the old and the new
    // geometry. Forward first: each missing end collapses onto the
    // previous slot's corresponding edge, which may itself have just been
    // filled — that chaining is what makes a run of several arrivals or
    // departures hold together.
    const collapse = (angle) => ({ startAngle: angle, endAngle: angle });
    for (let k = 1; k < slots.length; k++) {
        if (slots[k].from === null) slots[k].from = collapse(slots[k - 1].from.endAngle);
        if (slots[k].to === null) slots[k].to = collapse(slots[k - 1].to.endAngle);
    }
    // Then backward, for a leading run that had no previous slot to take
    // an edge from: collapse onto the *next* slot's leading edge instead.
    for (let k = slots.length - 2; k >= 0; k--) {
        if (slots[k].from === null) slots[k].from = collapse(slots[k + 1].from.startAngle);
        if (slots[k].to === null) slots[k].to = collapse(slots[k + 1].to.startAngle);
    }

    return { slots };
}

/**
 * Render one wedge per era behind every other layer.
 *
 * @param element       d3 selection for the era-backgrounds <g>
 * @param eraRanges     array from computeEraRanges
 * @param color         d3 ordinal scale, called with the era index
 * @param outerRadius   radius the wedge extends to (eraBackgroundRadius,
 *                      which stops short of the tech labels)
 */
export function drawEraBackgrounds(element, eraRanges, color, outerRadius) {
    const wedge = eraWedge(outerRadius);
    return rememberEraAngles(element
        .selectAll("path")
        // Keyed by canonical era identity, not array index, so the eras
        // two games share stay the same DOM node across a switch — which
        // is what lets animateEraBackgrounds morph them instead of
        // crossfading. Index keying matched Civ 3's "Middle Ages" against
        // Civ 5's ERA_CLASSICAL purely because both sit at position 1.
        .data(eraRanges, eraJoinKey)
        .join("path")
        .attr("class", "era-background")
        .attr("d", (d) => wedge(eraAngles(d)))
        .attr("fill", (_, i) => color(i)));
}

/**
 * Render the era name on the spoke at the angular midpoint of each era,
 * reading radially exactly like the tech labels (wheelTransform flips the
 * rotation 180° on the left half so text never renders upside down). The
 * text is anchored at its middle so it spreads evenly around `radius`,
 * which computeWheelLayout centres in the annulus between the centre game
 * image and the icon ring.
 *
 * A long era name can outgrow that annulus — its text runs radially and
 * would collide with the centre image on one end and the icons on the
 * other. `radius` splits the annulus evenly, so the room available is
 * twice the distance from the anchor to the image edge; anything wider is
 * squeezed with textLength (a few percent at worst, invisible next to an
 * overlap).
 */
export function drawEraLabels(element, eraRanges, color, radius) {
    const widthCap = eraLabelWidthCap(radius);
    return element
        .selectAll("text")
        .data(eraRanges, eraJoinKey)
        .join("text")
        .attr("class", "era-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", (d) => wheelTransform(d.count, eraLabelIndex(d), radius))
        .attr("fill", (_, i) => color(i))
        .text((d) => eraDisplayName(d.era))
        .each(function () { squeezeEraLabel(this, widthCap); });
}

/** The wheel index an era's label sits at: its angular midpoint. Shared
 *  with animateEraLabels, which has to know where a label is travelling
 *  to without going through wheelTransform. */
export function eraLabelIndex(d) {
    return (d.first + d.last) / 2;
}

/** Room an era label has to run radially: twice the distance from its
 *  anchor to the centre image's edge, since `radius` splits the annulus
 *  evenly. See drawEraLabels for why anything wider is squeezed. */
export function eraLabelWidthCap(radius) {
    return 2 * (radius - GAME_IMG_WIDTH / 2 - LABEL_PADDING);
}

/** Apply (or clear) that squeeze on one label node. Factored out so the
 *  animated path lands on exactly the same glyph spacing the static path
 *  would give it — a label that arrives un-squeezed would overlap the
 *  centre image. */
export function squeezeEraLabel(node, widthCap) {
    const w = node.getComputedTextLength();
    if (widthCap > 0 && w > widthCap) {
        node.setAttribute("textLength", widthCap);
        node.setAttribute("lengthAdjust", "spacingAndGlyphs");
    } else {
        node.removeAttribute("textLength");
        node.removeAttribute("lengthAdjust");
    }
}
