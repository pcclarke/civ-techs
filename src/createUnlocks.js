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
      unlock.required = createUnlocksObject(
        technologyData[i].requires,
        technologyIds,
        i
      );

      minRange = unlock.required.range[0];
      hasPrerequisites = true;
    }

    if (technologyData[i].optional) {
      unlock.optional = createUnlocksObject(
        technologyData[i].optional,
        technologyIds,
        i
      );

      if (minRange) {
        minRange = Math.min(unlock.required.range[0], unlock.optional.range[0]);
      } else {
        minRange = unlock.optional.range[0];
      }
      hasPrerequisites = true;
    }

    if (hasPrerequisites) {
      unlock.step = i == 0 ? 0 : findOpenStep(unlockPositions, minRange);

      unlockPositions.push(unlock);
    }

    //   if (technologyData[i].requires) {
    //     const obj = createUnlocksObject(
    //       technologyData[i],
    //       technologyIds,
    //       i,
    //       true
    //     );
    //     obj.step = obj.step =
    //       i === 0 ? 0 : findOpenStep(unlockPositions, obj.range[0]);
    //     unlockPositions.push(obj);
    //   }

    //   if (technologyData[i].optional) {
    //     const obj = createUnlocksObject(
    //       technologyData[i],
    //       technologyIds,
    //       i,
    //       false
    //     );
    //     obj.step = i === 0 ? 0 : findOpenStep(unlockPositions, obj.range[0]);
    //     unlockPositions.push(obj);
    //   }
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
    if (unlock.required && unlock.optional) {
      maxRange = Math.max(unlock.required.range[1], unlock.optional.range[1]);
    } else if (unlock.required) {
      maxRange = unlock.required.range[1];
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
