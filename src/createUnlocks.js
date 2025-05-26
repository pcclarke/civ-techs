/**
 * Get a list of where optional and hard requirements start and stop
 * @param {} technologyData
 * @returns
 */
export default function createUnlocks(technologyData) {
  var unlockPositions = [];
  var unlocks = [];
  var technologyIds = technologyData.map((t) => t.id);

  for (let i = 0; i < technologyData.length; i++) {
    let hasPrerequisites = false;
    let minRange;

    const unlock = {
      id: technologyData[i].id,
      position: i,
    };

    if (technologyData[i].requires) {
      unlock.requires = createUnlocksObject(
        technologyData[i].requires,
        technologyIds,
        i
      );
      unlock.requires.count = technologyData.length;

      minRange = unlock.requires.range[0];
      hasPrerequisites = true;
    }

    if (technologyData[i].optional) {
      unlock.optional = createUnlocksObject(
        technologyData[i].optional,
        technologyIds,
        i
      );
      unlock.optional.count = technologyData.length;

      if (minRange) {
        minRange = Math.min(unlock.requires.range[0], unlock.optional.range[0]);
      } else {
        minRange = unlock.optional.range[0];
      }
      hasPrerequisites = true;
    }

    unlock.step = i == 0 ? 0 : findOpenStep(unlockPositions, minRange);

    if (technologyData[i].requires) {
      unlock.requires.step = unlock.step;
    }
    if (technologyData[i].optional) {
      unlock.optional.step = unlock.step;
    }

    if (hasPrerequisites) {
      unlockPositions.push(unlock);
    }
  }

  console.log(unlockPositions);

  return unlockPositions;
}

function createUnlocksObject(prereqs, techIds, position) {
  const requires = getUnlocksPosition(prereqs, techIds);

  const requiresPositions = requires.map((r) => r.position);

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
 * @param {*} unlockPositions
 * @param {*} newRangeStart
 * @returns
 */
function findOpenStep(unlockPositions, newRangeStart) {
  var openStep = -1;
  var highestStep = 0;

  for (let i = 0; i < unlockPositions.length; i++) {
    let unlock = unlockPositions[i];

    let maxRange;
    if (unlock.requires && unlock.optional) {
      maxRange = Math.max(unlock.requires.range[1], unlock.optional.range[1]);
    } else if (unlock.requires) {
      maxRange = unlock.requires.range[1];
    } else {
      maxRange = unlock.optional.range[1];
    }

    if (maxRange < newRangeStart) {
      openStep = unlock.step;
    } else if (openStep == unlock.step && maxRange > newRangeStart) {
      openStep = -1;
    }

    if (unlock.step > highestStep) {
      highestStep = unlock.step;
    }
  }

  if (openStep > -1) {
    return openStep;
  }

  return highestStep + 1;
}

function calculateAngle(position, techCount, angleShift) {
  return position * (360 / techCount) + angleShift;
}
