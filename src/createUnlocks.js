/**
 * @file Various steps to building a list of the relationships between
 * technologies that is used to draw lines from a technology to what it
 * is required or an optional prerequisite for
 */

/**
 * Get a list of where optional and hard requirements start and stop
 * @param {Object[]} data
 * @returns
 */
export default function createUnlocks(data) {
  var unlocks = [];

  for (let i = 0; i < data.length; i++) {
    const unlock = createUnlockObject(data, data[i].id, i);

    if (unlock.reqFor.length <= 0 && unlock.optFor.length <= 0) continue;

    unlock.step = findOpenStep(unlocks, unlock.range[0], unlock.range[1]);
    unlocks.push(unlock);
  }

  return unlocks;
}

/**
 * Create the object used to describe what technologies are unlocked
 * when one technology is researched
 * @param {Object[]} data
 * @param {string} id
 * @param {number} position
 * @returns
 */
function createUnlockObject(data, id, position) {
  let minRange = position;
  let maxRange = position;
  var reqFor = [];
  var optFor = [];

  for (let i = 0; i < data.length; i++) {
    let compareTech = data[i];
    let pushed = false;

    if (compareTech.requires && compareTech.requires.indexOf(id) >= 0) {
      reqFor.push({ id: compareTech.id, pos: i });
      pushed = true;
    }

    if (compareTech.optional && compareTech.optional.indexOf(id) >= 0) {
      optFor.push({ id: compareTech.id, pos: i });
      pushed = true;
    }

    if (!pushed) continue;

    if (i < minRange) minRange = i;
    if (i > maxRange) maxRange = i;
  }

  return {
    count: data.length,
    id: id,
    position: position,
    reqFor: reqFor,
    optFor: optFor,
    range: [minRange, maxRange],
  };
}

/**
 * Find an open step where the arc can be drawn
 * @param {Object[]} allUnlocks All of the unlocks up to this point
 * @param {number} newRangeMin The minimum range of the new arc
 * @param {number} newRangeMax The maximum range of the new arc
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
