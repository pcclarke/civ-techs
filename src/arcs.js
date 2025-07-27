import { arc } from "d3-shape";
import { arcBase, arcSpace, arcWidth, TWO_PI_ADJ, PI_DIFF } from "./constants";

export const linkArc = arc()
  .innerRadius((d) => arcSpace * d.arcRank + arcBase)
  .outerRadius((d) => arcBase + arcWidth + arcSpace * d.arcRank)
  .startAngle((d) => -1 * d.arcBack)
  .endAngle((d) => d.arcDist);

export const tempArc = arc()
  .innerRadius((d) => arcBase + arcSpace * d.arcRank)
  .outerRadius((d) => arcBase + arcWidth + arcSpace * d.arcRank)
  .startAngle((d) => -1 * d.tempArcBack)
  .endAngle((d) => d.tempArcDist);

export const unlockArc = arc()
  .innerRadius((d) => arcBase + arcSpace * d.step)
  .outerRadius(
    (d) => arcBase + arcWidth + arcSpace * d.step
  )
  .startAngle((d) => (d.range[0] / d.count) * TWO_PI_ADJ + PI_DIFF)
  .endAngle((d) => (d.range[1] / d.count) * TWO_PI_ADJ + PI_DIFF);

export var prereqArc = arc()
  .innerRadius((d) => arcBase + setAlignment(d.align) + arcSpace * d.step)
  .outerRadius(
    (d) => arcBase + setAlignment(d.align) + arcWidth + arcSpace * d.step
  )
  .startAngle((d) => (d.range[0] / d.count) * TWO_PI_ADJ + PI_DIFF)
  .endAngle((d) => (d.range[1] / d.count) * TWO_PI_ADJ + PI_DIFF);

function setAlignment(align) {
  if (align === "left") {
    return -1;
  } else if (align === "right") {
    return 1;
  }
  return 0;
}
