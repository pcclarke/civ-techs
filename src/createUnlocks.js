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

    if (technologyData[i].requires) {
      const obj = createUnlocksObject(
        technologyData[i],
        technologyIds,
        i,
        true
      );
      obj.step = obj.step =
        i === 0 ? 0 : findOpenStep(unlockPositions, obj.range[0]);
      unlockPositions.push(obj);
    }

    if (technologyData[i].optional) {
      const obj = createUnlocksObject(
        technologyData[i],
        technologyIds,
        i,
        false
      );
      obj.step = i === 0 ? 0 : findOpenStep(unlockPositions, obj.range[0]);
      unlockPositions.push(obj);
    }
  }

  console.log(unlockPositions);

  return unlockPositions;
}

function createUnlocksObject(technology, techIds, position, isRequired, step) {
  let obj = {
    id: technology.id,
    techPosition: position,
    required: isRequired,
    step: step,
  };

  const requires = getUnlocksPosition(
    technology[isRequired ? "requires" : "optional"],
    techIds
  );

  const requiresPositions = requires.map((r) => r.index);

  obj.range = [
    Math.min(...requiresPositions, position),
    Math.max(...requiresPositions, position),
  ];

  return obj;
}

function getUnlocksPosition(unlocks, techIds) {
  var unlocksWithPositions = [];

  unlocks.forEach((u) =>
    unlocksWithPositions.push({ id: u, index: techIds.indexOf(u) })
  );

  return unlocksWithPositions;
}

function findOpenStep(unlockPositions, rangeStart) {
  var openStep = -1;
  var highestStep = 0;

  for (let i = 0; i < unlockPositions.length; i++) {
    if (unlockPositions[i].range[1] < rangeStart) {
      openStep = unlockPositions[i].step;
    } else if (
      openStep == unlockPositions[i].step &&
      unlockPositions[i].range[1] > rangeStart
    ) {
      openStep = -1;
    }

    if (unlockPositions[i].step > highestStep) {
      highestStep = unlockPositions[i].step;
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
