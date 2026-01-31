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
  var allTechs = [];
  var prerequisites = [];

  for (let i = 0; i < data.length; i++) {
    const tech = createUnlockObject(data, data[i], i);

    if (tech.reqFor.length > 0 || tech.optFor.length > 0) {
      tech.step = findOpenStep(prerequisites, tech.range[0], tech.range[1]);
      prerequisites.push(tech);
    }

    allTechs.push(tech);
  }

  return { allTechs, prerequisites };
}

/**
 * Create the object used to describe what technologies are unlocked
 * when one technology is researched
 * @param {Object[]} data
 * @param {string} id
 * @param {number} position
 * @returns
 */
function createUnlockObject(data, tech, position) {
  const id = tech.id;
  var minRange = position;
  var maxRange = position;
  var reqTo = [];
  var optTo = [];
  var reqFor = [];
  var optFor = [];

  for (let i = 0; i < data.length; i++) {
    let compareTech = data[i];
    let isAPreqrequisite = false;

    if (tech.requires && tech.requires.includes(compareTech.id)) {
      reqTo.push({ id: compareTech.id, pos: i});
    }

    if (compareTech.requires && compareTech.requires.indexOf(id) >= 0) {
      reqFor.push({ id: compareTech.id, pos: i });
      isAPreqrequisite = true;
    }

    if (tech.optional && tech.optional.includes(compareTech.id)) {
      optTo.push({ id: compareTech.id, pos: i });
    }

    if (compareTech.optional && compareTech.optional.indexOf(id) >= 0) {
      optFor.push({ id: compareTech.id, pos: i });
      isAPreqrequisite = true;
    }

    if (!isAPreqrequisite) continue;

    if (i < minRange) minRange = i;
    if (i > maxRange) maxRange = i;
  }

  return {
    count: data.length,
    id: id,
    name: tech.name,
    position: position,
    reqTo: reqTo,
    optTo: optTo,
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

  // Group existing unlocks by step
  const stepMap = new Map();
  let maxStep = -1;

  for (let unlock of allUnlocks) {
      if (!Number.isFinite(unlock.step)) continue;
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
