import { arc } from "d3-shape";

import { PI_DIFF, TWO_PI_ADJ } from "./constants";
import { eraDisplayName } from "./eraData";
import { calculatePointOnWheel } from "./helpers";

/**
 * Era visualization is two layers, drawn together so eras read as both a
 * background tint behind their techs and a name on the outer ring:
 *
 *   - drawEraBackgrounds: full wedges from the chart centre out to the icon
 *     ring, one per era, with a half-tech-slot of angular buffer so adjacent
 *     eras meet exactly between consecutive techs.
 *   - drawEraLabels: single text per era at the angular midpoint, sitting on
 *     the reserved outer band. Text is tangent to the ring and flipped on
 *     the bottom half so it always reads upright.
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
 * @param outerRadius   radius the wedge extends to (typically labelRadius)
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
 * Render the era name at the angular midpoint of each era, on the reserved
 * outer ring. The text is laid out tangent to the ring; for points in the
 * lower half of the SVG (sin(angle) > 0 since y points down) it's flipped
 * 180° so the reader doesn't have to tilt their head — same trick the tech
 * labels use, just rotated 90° because era labels run along the ring rather
 * than radially.
 */
export function drawEraLabels(element, eraRanges, color, radius) {
    return element
        .selectAll("text")
        .data(eraRanges)
        .join("text")
        .attr("class", "era-label")
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("transform", (d) => {
            const midIdx = (d.first + d.last) / 2;
            const point = calculatePointOnWheel(d.count, midIdx, radius);
            const angleDeg = point.angle * (180 / Math.PI);
            const tangentRot = Math.sin(point.angle) > 0
                ? angleDeg - 90
                : angleDeg + 90;
            return `translate(${point.x}, ${point.y}) rotate(${tangentRot})`;
        })
        .attr("fill", (_, i) => color(i))
        .text((d) => eraDisplayName(d.era));
}
