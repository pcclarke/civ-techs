import { PI_DIFF, TWO_PI_ADJ } from "./constants";

export function imageLink(game, category, id) {
  return `${game}/img/${category}/${id}.png`;
}


/** Determine if item should be faded out when a tech is selected */
export function fadeCheck(tech, selectedOnly = false) {
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

