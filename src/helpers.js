import { PI_DIFF, TWO_PI_ADJ } from "./constants";

export function imageLink(game, category, id) {
  return `${game}/img/${category}/${id}.png`;
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
  const startAngle = -Math.PI / 2 + PI_DIFF;
  const angleIncrement = TWO_PI_ADJ / numLines;
  const angle = startAngle + lineIndex * angleIncrement;

  const startX = Math.cos(angle) * startDistance;
  const startY = Math.sin(angle) * startDistance;

  const endX = Math.cos(angle) * lineLength;
  const endY = Math.sin(angle) * lineLength;

  return `M ${startX} ${startY} ${endX} ${endY}`;
}
