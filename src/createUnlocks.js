/**
 * @file Various steps to building a list of the relationships between
 */

/**
 * Get a list of where optional and hard requirements start and stop
 * @param {} technologyData
 * @returns
 */
export default function createUnlocks(technologyData) {
  var unlocks = [];
  var technologyIds = technologyData.map((t) => t.id);

  for (let i = 0; i < technologyData.length; i++) {
    let hasPrerequisites = false;
    let minRange;
    let maxRange;
    const count = technologyData.length - 1;
    const position = i;
    const tech = technologyData[i];

    const unlock = {
      count: count,
      id: tech.id,
      position: position,
    };

    if (tech.requires) {
      unlock.requires = createUnlocksObject(
        tech.requires,
        technologyIds,
        position
      );
      unlock.requires.count = count;

      minRange = unlock.requires.range[0];
      maxRange = unlock.requires.range[1];

      hasPrerequisites = true;
    }

    if (tech.optional) {
      unlock.optional = createUnlocksObject(
        tech.optional,
        technologyIds,
        position
      );
      unlock.optional.count = count;

      if (minRange) {
        minRange = Math.min(unlock.requires.range[0], unlock.optional.range[0]);
      } else {
        minRange = unlock.optional.range[0];
      }

      if (maxRange) {
        maxRange = Math.max(unlock.requires.range[1], unlock.optional.range[1]);
      } else {
        maxRange = unlock.optional.range[1];
      }

      hasPrerequisites = true;
    }

    if (hasPrerequisites) {
      unlock.step = findOpenStep(unlocks, minRange, maxRange, tech.id);

      if (tech.requires) {
        unlock.requires.step = unlock.step;
      }
      if (tech.optional) {
        unlock.optional.step = unlock.step;
      }

      unlock.range = [minRange, maxRange];

      unlocks.push(unlock);
    }
  }

  return unlocks;
}

/**
 * Create an object that describes a technology that unlocks another
 * @param prereqs
 * @param {string[]} techIds
 * @param {number} position
 */
function createUnlocksObject(prereqs, techIds, position) {
  var requires = getUnlocksPosition(prereqs, techIds);

  var requiresPositions = requires.map((r) => r.position);

  var range = [
    Math.min(...requiresPositions, position),
    Math.max(...requiresPositions, position),
  ];

  return {
    range: range,
    requires: requires,
  };
}

function getUnlocksPosition(unlocks, techIds) {
  var unlocksWithPositions = [];

  unlocks.forEach((u) =>
    unlocksWithPositions.push({ id: u, position: techIds.indexOf(u) })
  );

  return unlocksWithPositions;
}

/**
 * Find an open step where the arc can be drawn
 * @param {*} allUnlocks
 * @param {number} newRangeMin
 * @param {number} newRangeMax
 * @returns
 */
function findOpenStep(allUnlocks, newRangeMin, newRangeMax) {
  // Helper function to get the range for a given unlock
  function getRange(unlock) {
    let rangeMin, rangeMax;

    if (unlock.requires && unlock.optional) {
      rangeMax = Math.max(unlock.requires.range[1], unlock.optional.range[1]);
      rangeMin = Math.min(unlock.requires.range[0], unlock.optional.range[0]);
    } else if (unlock.requires) {
      rangeMin = unlock.requires.range[0];
      rangeMax = unlock.requires.range[1];
    } else if (unlock.optional) {
      rangeMin = unlock.optional.range[0];
      rangeMax = unlock.optional.range[1];
    } else {
      // Handle case where neither requires nor optional exist
      return null;
    }

    return { min: rangeMin, max: rangeMax };
  }

  // Helper function to check if two ranges overlap
  function rangesOverlap(range1Min, range1Max, range2Min, range2Max) {
    return !(range1Max < range2Min || range2Max < range1Min);
  }

  // Group existing unlocks by step (row)
  const stepMap = new Map();
  let maxStep = -1;

  for (let unlock of allUnlocks) {
    const range = getRange(unlock);
    if (range === null) continue;

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
            existingRange.min,
            existingRange.max
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
