import { arc } from "d3-shape";
import { ARC_BASE, TWO_PI_ADJ, PI_DIFF } from "./constants";

const arcWidth = 1.5;

/**
 * The ring an arc (or any of its decorations — origin pin, req square, opt
 * circle) sits on. One number, so it can be interpolated directly rather
 * than via the integer `step` it comes from: `step` belongs to the
 * dataset, and arcSpace differs per game, so the *radius* is the only
 * thing meaningfully shared between an outgoing and an incoming layout.
 */
export function ringRadius(step, arcSpace) {
  return ARC_BASE + arcSpace * step;
}

/**
 * One arc's geometry as three plain numbers. Split out from the generator
 * below so the switch animation can interpolate them and rebuild the path
 * per frame — an annular sector's `d` string has no interpolation of its
 * own, and unlike the angles, the radius can't be read back out of it.
 * See animateArcs in animateWheelSwitch.js.
 */
export function unlockArcGeom(d, arcSpace) {
  return {
    startAngle: (d.range[0] / d.count) * TWO_PI_ADJ + PI_DIFF,
    endAngle: (d.range[1] / d.count) * TWO_PI_ADJ + PI_DIFF,
    radius: ringRadius(d.step, arcSpace),
  };
}

/**
 * Arc generator over an unlockArcGeom triple rather than a datum, so the
 * same generator serves the static draw and the per-frame animated
 * rebuild.
 */
export function unlockArcAt() {
  return arc()
    .innerRadius((a) => a.radius - arcWidth / 2)
    .outerRadius((a) => a.radius + arcWidth / 2)
    .startAngle((a) => a.startAngle)
    .endAngle((a) => a.endAngle);
}

/**
 * Build an unlock-arc generator parameterised by the radial spacing between
 * arc rings. The wheel computes arcSpace dynamically per render so arcs scale
 * with the available room between ARC_BASE and the icon ring.
 */
export function makeUnlockArc(arcSpace) {
  const at = unlockArcAt();
  return (d) => at(unlockArcGeom(d, arcSpace));
}

/** Stable identity of an arc and its origin pin: the tech the arc runs
 *  from, whose id survives a game switch. */
export const arcKey = (d) => d.id;

/** Stable identity of a req square / opt circle. Both ends are needed: one
 *  advance can be required by several others, so it carries one mark per
 *  arc that reaches it. */
export const markKey = (d) => `${d.arcId}>${d.id}`;

/** Half-length of an origin pin's radial tick (see drawUnlockPins). */
export const PIN_REACH = 5;
