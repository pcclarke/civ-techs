/**
 * @file Various steps to building a list of the relationships between
 * technologies that is used to draw lines from a technology to what it
 * is required or an optional prerequisite for
 */

/**
 * Get a list of where optional and hard requirements start and stop
 * @param {} technologyData
 * @returns
 */
export default function createUnlocks(technologyData) {
  var unlocks = [];
  const count = technologyData.length - 1;

  for (let i = 0; i < technologyData.length; i++) {
    let minRange = i;
    let maxRange = i;
    let reqFor = [];
    let optFor = [];
    const position = i;
    const unlockTech = technologyData[i];
    const unlockId = unlockTech.id;

    for (let j = 0; j < technologyData.length; j++) {
      let compareTech = technologyData[j];
      let pushed = false;

      if (compareTech.requires && compareTech.requires.indexOf(unlockId) >= 0) {
        reqFor.push({ id: compareTech.id, pos: j });
        pushed = true;
      }

      if (compareTech.optional && compareTech.optional.indexOf(unlockId) >= 0) {
        optFor.push({ id: compareTech.id, pos: j });
        pushed = true;
      }

      if (!pushed) continue;

      if (j < minRange) minRange = j;
      if (j > maxRange) maxRange = j;
    }

    if (reqFor.length <= 0 && optFor.length <= 0) continue;

    const step = findOpenStep(unlocks, minRange, maxRange);

    unlocks.push({
      count: count,
      id: unlockTech.id,
      position: position,
      reqFor: reqFor,
      optFor: optFor,
      range: [minRange, maxRange],
      step: step,
    });
  }

  return unlocks;
}

/**
 * Find an open step where the arc can be drawn
 * @param {*} allUnlocks
 * @param {number} newRangeMin
 * @param {number} newRangeMax
 * @returns
 */
function findOpenStep(allUnlocks, newRangeMin, newRangeMax) {
  function rangesOverlap(range1Min, range1Max, range2Min, range2Max) {
    return !(range1Max < range2Min || range2Max < range1Min);
  }

  // Group existing unlocks by step (row)
  const stepMap = new Map();
  let maxStep = -1;

  for (let unlock of allUnlocks) {
    const range = unlock.range;
    const step = unlock.step;

    maxStep = Math.max(maxStep, step);

    if (!stepMap.has(step)) {
      stepMap.set(step, []);
    }
    stepMap.get(step).push(range);
  }

  // Try each step starting from 0
  for (let step = 0; step <= maxStep + 1; step++) {
    let canUseStep = true;

    // Check if this step has any conflicting ranges
    if (stepMap.has(step)) {
      for (let existingRange of stepMap.get(step)) {
        if (
          rangesOverlap(
            newRangeMin,
            newRangeMax,
            existingRange[0],
            existingRange[1]
          )
        ) {
          canUseStep = false;
          break;
        }
      }
    }

    if (canUseStep) {
      return step;
    }
  }

  // If we get here, return the next available step
  return maxStep + 1;
}
