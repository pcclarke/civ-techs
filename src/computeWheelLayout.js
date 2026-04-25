import { calculatePointOnWheel } from "./helpers";
import {
    EDGE_PADDING,
    LABEL_PADDING,
    MIN_TECH_IMG_RADIUS,
    TECH_IMG_RADIUS,
    TECH_IMG_WIDTH,
    TOTAL_WIDTH,
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
 * box corner sits within ±MAX_EXTENT on both axes.
 *
 * Geometry: a label is anchored at radius R on a spoke at polar angle α and
 * is rotated to read radially outward. Its rendered text occupies the radial
 * strip [R, R+w] and a tangential strip of height h. The two corners that
 * matter are at world coords:
 *     |x| = (R + w) · |cos α| + (h/2) · |sin α|
 *     |y| = (R + w) · |sin α| + (h/2) · |cos α|
 *
 * Setting each ≤ MAX_EXTENT and solving for R gives a per-label cap; the
 * wheel uses min across all labels.
 */
function maxLabelRadius(allTechs, widths, lineHeight) {
    const n = allTechs.length;
    let best = Infinity;

    for (let i = 0; i < n; i++) {
        const { angle } = calculatePointOnWheel(n, i, 1);
        const c = Math.abs(Math.cos(angle));
        const s = Math.abs(Math.sin(angle));
        const w = widths[i];
        const h = lineHeight;

        // For each axis, max(R + w) is what's left of MAX_EXTENT after the
        // tangential corner contribution, divided by the radial projection.
        // When cos or sin is ~0 the corresponding axis can't constrain us
        // (the label runs along the other axis), so skip it.
        const xCap = c > 1e-9 ? (MAX_EXTENT - (h / 2) * s) / c : Infinity;
        const yCap = s > 1e-9 ? (MAX_EXTENT - (h / 2) * c) / s : Infinity;
        const r = Math.min(xCap, yCap) - w;

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
 * Returns { labelRadius, techImgRadius }.
 */
export function computeWheelLayout(labelGroup, allTechs) {
    if (!allTechs.length) {
        return { labelRadius: TECH_IMG_RADIUS, techImgRadius: TECH_IMG_RADIUS };
    }

    const { widths, lineHeight } = measureLabels(labelGroup, allTechs);
    const rawLabelRadius = maxLabelRadius(allTechs, widths, lineHeight);

    // The icon sits inside the label by half its own width plus LABEL_PADDING.
    const iconInset = TECH_IMG_WIDTH / 2 + LABEL_PADDING;

    // Floor the icon radius so the inner arc region is always usable. If the
    // labels would force us below the floor, accept slight over-extension on
    // the worst label rather than collapse the wheel.
    const techImgRadius = Math.max(MIN_TECH_IMG_RADIUS, rawLabelRadius - iconInset);
    const labelRadius = techImgRadius + iconInset;

    return { labelRadius, techImgRadius };
}
