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
export function rememberEraAngles(selection) {
    return selection.each(function (d) {
        this.__eraAngles = eraAngles(d);
    });
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
        .data(eraRanges, (d) => eraKey(d.era))
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
    const widthCap = 2 * (radius - GAME_IMG_WIDTH / 2 - LABEL_PADDING);
    return element
        .selectAll("text")
        .data(eraRanges, (d) => eraKey(d.era))
        .join("text")
        .attr("class", "era-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", (d) => wheelTransform(d.count, (d.first + d.last) / 2, radius))
        .attr("fill", (_, i) => color(i))
        .text((d) => eraDisplayName(d.era))
        .each(function () {
            const w = this.getComputedTextLength();
            if (widthCap > 0 && w > widthCap) {
                this.setAttribute("textLength", widthCap);
                this.setAttribute("lengthAdjust", "spacingAndGlyphs");
            } else {
                this.removeAttribute("textLength");
                this.removeAttribute("lengthAdjust");
            }
        });
}
