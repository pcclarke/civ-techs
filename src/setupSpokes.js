/**
 * Get lowest steps that technology spokes should be drawn to
 * @param {Object[]} data
 * @param {Object[]} unlocks
 * @returns
 */
export function setupSpokes(data, unlocks) {
  var spokes = [];

  for (let i = 0; i < data.length; i++) {
    const tech = data[i];

    if (!tech.requires && !tech.optional) {
      spokes.push({
        id: tech.id,
        step: 0,
      });
      continue;
    }

    let minStep = getMinStep(tech.id, unlocks);

    spokes.push({
      id: tech.id,
      step: minStep,
    });
  }

  return spokes;
}

/**
 * Find the minimum step that a technology intersects with
 * @param {string} id
 * @param {Object[]} unlocks
 * @returns
 */
function getMinStep(id, unlocks) {
  var unlockSteps = unlocks.reduce((p, c) => {
    p[c.id] = c.step;
    return p;
  }, {});
  var minStep = unlockSteps[id] ?? 100;

  for (let i = 0; i < unlocks.length; i++) {
    const ul = unlocks[i];
    const relations = [ul.id];

    if (ul.reqFor) {
      ul.reqFor.forEach((r) => relations.push(r.id));
    }
    if (ul.optFor) {
      ul.optFor.forEach((o) => relations.push(o.id));
    }
    if (relations.indexOf(id) <= 0) continue;

    if (ul.step < minStep) {
      minStep = ul.step;
    }
  }

  return minStep;
}
