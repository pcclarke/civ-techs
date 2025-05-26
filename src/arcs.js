import { arc } from "d3-shape";
import { arcBase, arcSpace, arcWidth } from "./constants";

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
  .innerRadius((d) => arcBase + 342.5 + 14 * d.rank)
  .outerRadius((d) => arcBase + 342.6 + arcWidth + 14 * d.rank)
  .startAngle((d) => -1 * d.arcBack)
  .endAngle((d) => d.arcEnd);

export var prereqArc = arc()
  .innerRadius((d) => arcBase + arcSpace * d.step)
  .outerRadius((d) => arcBase + arcWidth + arcSpace * d.step)
  .startAngle((d) => (d.range[0] / d.count) * 2 * Math.PI)
  .endAngle((d) => (d.range[1] / d.count) * 2 * Math.PI);
