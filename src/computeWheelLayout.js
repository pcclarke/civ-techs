import { calculatePointOnWheel } from "./helpers";
import {
    EDGE_PADDING,
    ERA_LABEL_HEIGHT,
    LABEL_PADDING,
    LABEL_SLOT_FRACTION,
    MIN_TECH_IMG_RADIUS,
    TECH_IMG_RADIUS,
    TECH_IMG_WIDTH,
    TECH_LABEL_FONT_MAX,
    TECH_LABEL_FONT_MIN,
    TOTAL_WIDTH,
    TWO_PI_ADJ,
} from "./constants";

/**
 * The wheel `<g>` is centered in the SVG, so the maximum local-coord extent
 * before falling off any SVG edge is half the SVG side length. Subtracting
 * EDGE_PADDING gives the budget every label corner must stay within.
 */
const MAX_EXTENT = TOTAL_WIDTH / 2 - EDGE_PADDING;

/**
 * Render hidden <text> elements into the supplied selection so we can call
 * getComputedTextLength()/getBBox() against them with the same inherited
 * styling the live labels use, then strip them out.
 *
 * Returns:
 *   widths     – per-tech rendered text widths in px
 *   lineHeight – the largest measured bbox height (one value, used as a
 *                tangential safety margin in the geometry below)
 */
function measureLabels(group, allTechs) {
    const sel = group
        .selectAll("text.label-measure")
        .data(allTechs)
        .join("text")
        .attr("class", "label-measure")
        .attr("visibility", "hidden")
        .text((d) => d.name);

    const widths = [];
    let lineHeight = 0;
    sel.each(function () {
        widths.push(this.getComputedTextLength());
        const h = this.getBBox().height;
        if (h > lineHeight) lineHeight = h;
    });
    sel.remove();
    return { widths, lineHeight };
}

/**
 * Compute the largest label radius R such that every label's outer bounding
 * box corner sits within ±maxExtent on both axes.
 *
 * Geometry: a label is anchored at radius R on a spoke at polar angle α and
 * is rotated to read radially outward. Its rendered text occupies the radial
 * strip [R, R+w] and a tangential strip of height h. The two corners that
 * matter are at world coords:
 *     |x| = (R + w) · |cos α| + (h/2) · |sin α|
 *     |y| = (R + w) · |sin α| + (h/2) · |cos α|
 *
 * Setting each ≤ maxExtent and solving for R gives a per-label cap; the
 * wheel uses min across all labels.
 *
 * When `maxRadius` is finite, labels must additionally stay inside a circle
 * of that radius (used to keep tech labels out of the circular era-label
 * ring — the square constraint alone lets diagonal labels reach up to
 * √2·maxExtent from the centre, straight through the ring). The label's
 * farthest corner sits at distance √((R+w)² + (h/2)²), so the cap on
 * (R + w) is √(maxRadius² − (h/2)²).
 */
function maxLabelRadius(allTechs, widths, lineHeight, maxExtent, maxRadius = Infinity) {
    const n = allTechs.length;
    let best = Infinity;

    for (let i = 0; i < n; i++) {
        const { angle } = calculatePointOnWheel(n, i, 1);
        const c = Math.abs(Math.cos(angle));
        const s = Math.abs(Math.sin(angle));
        const w = widths[i];
        const h = lineHeight;

        // For each axis, max(R + w) is what's left of maxExtent after the
        // tangential corner contribution, divided by the radial projection.
        // When cos or sin is ~0 the corresponding axis can't constrain us
        // (the label runs along the other axis), so skip it.
        const xCap = c > 1e-9 ? (maxExtent - (h / 2) * s) / c : Infinity;
        const yCap = s > 1e-9 ? (maxExtent - (h / 2) * c) / s : Infinity;
        const radialCap = Number.isFinite(maxRadius)
            ? Math.sqrt(Math.max(0, maxRadius * maxRadius - (h / 2) * (h / 2)))
            : Infinity;
        const r = Math.min(xCap, yCap, radialCap) - w;

        if (r < best) best = r;
    }
    return best;
}

/**
 * Given the SVG label group and the techs being drawn, compute the radii
 * the wheel should use this render. The label radius is the largest value
 * that satisfies the EDGE_PADDING constraint for every label; the icon
 * radius is set just inside that with room for the icon and LABEL_PADDING.
 *
 * The label font size is chosen here too (and left applied to labelGroup):
 * sparse wheels get a larger font, bounded by TECH_LABEL_FONT_MAX and the
 * LABEL_SLOT_FRACTION crowding test against neighbouring labels.
 *
 * When `hasEras` is true, the outermost ERA_LABEL_HEIGHT pixels are reserved
 * for era labels — tech labels are pushed inward by that amount, and the
 * returned `eraLabelRadius` sits at the centre of the reserved band.
 *
 * Returns { labelRadius, techImgRadius, eraLabelRadius }.
 */
export function computeWheelLayout(labelGroup, allTechs, hasEras = false) {
    if (!allTechs.length) {
        return {
            labelRadius: TECH_IMG_RADIUS,
            techImgRadius: TECH_IMG_RADIUS,
            eraLabelRadius: TECH_IMG_RADIUS,
        };
    }

    // Reserve a radial band at the outer edge for era labels when the
    // current data has eras. Tech labels then have to fit within a shrunken
    // extent. The era ring sits at the centre of the reserved band so its
    // text is roughly equidistant from the tech labels and the SVG edge.
    // Because the era ring is a circle, the shrunken extent is applied as a
    // circular cap too — otherwise labels near the diagonals would satisfy
    // the per-axis constraint yet still cross the ring.
    const eraReserve = hasEras ? ERA_LABEL_HEIGHT : 0;
    const techExtent = MAX_EXTENT - eraReserve;

    // The icon sits inside the label by half its own width plus LABEL_PADDING.
    const iconInset = TECH_IMG_WIDTH / 2 + LABEL_PADDING;

    // Pick the largest label font that still leaves breathing room between
    // neighbouring labels. A bigger font widens every label, which shrinks
    // the wheel and with it the tangential slot each label gets, so every
    // candidate size has to be measured and laid out before the fit test.
    // The font is set on the label group so the real labels drawn into it
    // later inherit the size the measurement was taken at. The smallest
    // size is accepted unconditionally — it's today's default.
    let techImgRadius, labelRadius;
    for (let fontSize = TECH_LABEL_FONT_MAX; fontSize >= TECH_LABEL_FONT_MIN; fontSize--) {
        labelGroup.style("font-size", `${fontSize}px`);
        const { widths, lineHeight } = measureLabels(labelGroup, allTechs);
        const rawLabelRadius = maxLabelRadius(
            allTechs,
            widths,
            lineHeight,
            techExtent,
            hasEras ? techExtent : Infinity
        );

        // Floor the icon radius so the inner arc region is always usable.
        // If the labels would force us below the floor, accept slight
        // over-extension on the worst label rather than collapse the wheel.
        techImgRadius = Math.max(MIN_TECH_IMG_RADIUS, rawLabelRadius - iconInset);
        labelRadius = techImgRadius + iconInset;

        const slot = (labelRadius * TWO_PI_ADJ) / allTechs.length;
        if (lineHeight <= slot * LABEL_SLOT_FRACTION) break;
    }

    // Centre of the reserved era band, measured from the wheel centre. Falls
    // through to labelRadius when there are no eras (no caller will use it).
    const eraLabelRadius = hasEras
        ? techExtent + eraReserve / 2
        : labelRadius;

    return { labelRadius, techImgRadius, eraLabelRadius };
}
