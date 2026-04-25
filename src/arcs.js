import { arc } from "d3-shape";
import { ARC_BASE, ARC_SPACE, TWO_PI_ADJ, PI_DIFF } from "./constants";

const arcWidth = 1.5;

export const tempArc = arc()
  .innerRadius((d) => ARC_BASE + ARC_SPACE * d.arcRank)
  .outerRadius((d) => ARC_BASE + arcWidth + ARC_SPACE * d.arcRank)
  .startAngle((d) => -1 * d.tempArcBack)
  .endAngle((d) => d.tempArcDist);

/**
 * Build an unlock-arc generator parameterised by the radial spacing between
 * arc rings. The wheel computes arcSpace dynamically per render so arcs scale
 * with the available room between ARC_BASE and the icon ring.
 */
export function makeUnlockArc(arcSpace) {
  return arc()
    .innerRadius((d) => ARC_BASE - arcWidth / 2 + arcSpace * d.step)
    .outerRadius((d) => ARC_BASE + arcWidth / 2 + arcSpace * d.step)
    .startAngle((d) => (d.range[0] / d.count) * TWO_PI_ADJ + PI_DIFF)
    .endAngle((d) => (d.range[1] / d.count) * TWO_PI_ADJ + PI_DIFF);
}
