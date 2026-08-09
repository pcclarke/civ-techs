import { arc } from "d3-shape";

import { GAME_IMG_WIDTH, LABEL_PADDING, PI_DIFF, TWO_PI_ADJ } from "./constants";
import { eraDisplayName } from "./eraData";
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
 * Build the d3 arc generator for era wedges. The wedge starts half a slot
 * before the era's first tech and ends half a slot after its last so the
 * tech icons (which extend half their width past the spoke) sit fully
 * inside the coloured region. The first and last eras intentionally bleed
 * a small amount into the angular gap above 12 o'clock — the gap is wider
 * than a half-slot for any realistic tech count, so the wedges stop well
 * short of meeting at the top. innerRadius=0 gives a solid pie slice all
 * the way to the centre; the centre image and arc rings sit on top.
 */
function eraBackgroundArc(outerRadius) {
    return arc()
        .innerRadius(0)
        .outerRadius(outerRadius)
        .startAngle((d) => ((d.first - 0.5) / d.count) * TWO_PI_ADJ + PI_DIFF)
        .endAngle((d) => ((d.last + 0.5) / d.count) * TWO_PI_ADJ + PI_DIFF);
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
    const wedge = eraBackgroundArc(outerRadius);
    return element
        .selectAll("path")
        .data(eraRanges)
        .join("path")
        .attr("class", "era-background")
        .attr("d", (d) => wedge(d))
        .attr("fill", (_, i) => color(i));
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
        .data(eraRanges)
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
