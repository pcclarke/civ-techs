import { PI_DIFF, TWO_PI_ADJ } from "./constants";

/** Determine if item should be faded out when a tech is selected */
export function fadeCheck(tech, relatedIds = [], selectedOnly = false) {
    var { selected } = window.app;

    if (!selected || selected.id == tech.id) return false;
    if (selectedOnly && selected.step != tech.step) return true;
    return !relatedIds.includes(tech.id);
}

/**
 * Get a path string for a line extending from the center of an SVG
 * @param {number} numLines
 * @param {number} startDistance
 * @param {number} lineLength
 * @param {number} lineIndex
 * @returns
 */
export function calculateSingleRadialLinePath(
  numLines,
  startDistance,
  lineLength,
  lineIndex
) {
  const start = calculatePointOnWheel(numLines, lineIndex, startDistance);
  const end = calculatePointOnWheel(numLines, lineIndex, lineLength);

  return `M ${start.x} ${start.y} ${end.x} ${end.y}`;
}

/**
 * Get the x, y, and angle for a point on the wheel
 * @param {number} numLines
 * @param {number} lineIndex
 * @param {number} distFromCenter
 * @returns
 */
export function calculatePointOnWheel(numLines, lineIndex, distFromCenter) {
  const startAngle = -Math.PI / 2 + PI_DIFF;
  const angleIncrement = TWO_PI_ADJ / numLines;
  const angle = startAngle + lineIndex * angleIncrement;

  const x = Math.cos(angle) * distFromCenter;
  const y = Math.sin(angle) * distFromCenter;

  return {
    x: x,
    y: y,
    angle: angle,
  };
}

/**
 * Get a transform string for positioning an element on the wheel
 * @param {number} count - Total number of items on the wheel
 * @param {number} index - Index of this item
 * @param {number} radius - Distance from center
 * @returns {string} CSS transform string
 */
export function wheelTransform(count, index, radius) {
  const point = calculatePointOnWheel(count, index, radius);
  const rotate = point.angle * (180 / Math.PI) - (index > count / 2 ? 180 : 0);
  return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
}

/**
 * Restrict a static draw's join to resident nodes, skipping any a switch
 * animation has marked `.leaving` (see LEAVING in animateWheelSwitch.js).
 * A hover during a switch runs these draws mid-animation; joined against
 * a node that's fading out ahead of its own removal, the static path kept
 * that node and dropped its replacement, and the advance vanished when
 * the fade finished. Leaving nodes are left alone to finish.
 */
export const RESIDENT = (selector) => `${selector}:not(.leaving)`;
