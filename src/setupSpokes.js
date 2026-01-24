/**
 * Get lowest steps that techDatum spokes should be drawn to
 * @param {Object[]} techData
 * @param {Object[]} unlocksData
 * @returns
 */
export function setupSpokes(techData, unlocksData, filter = false) {
    var spokes = [];
    const unlockIds = unlocksData.map(u => u.id);

    for (let i = 0; i < techData.length; i++) {
        const tech = techData[i];
        if (filter && !unlockIds.includes(tech.id)) continue;
        let minStep = -10;

        if (tech.requires || tech.optional) {
            minStep = getMinStep(tech, unlocksData);
        }

        spokes.push({
            id: tech.id,
            position: i,
            step: minStep
        });
    }

    return spokes;
}

/**
 * Find the minimum step that a techDatum intersects with
 * @param {Object} techDatum
 * @param {Object[]} unlocksData
 * @returns
 */
function getMinStep(techDatum, unlocksData) {
    var unlockForTech = unlocksData.find(unlock => techDatum.id == unlock.id);
    var minStep = (unlockForTech && !Object.is(unlockForTech.step, undefined)) ? unlockForTech.step : 100;

    for (const ul of unlocksData) {
        var isRequirementFor = ul.reqFor && ul.reqFor.map(r => r.id).includes(techDatum.id);
        var isOptionalFor = ul.optFor && ul.optFor.map(o => o.id).includes(techDatum.id);

        if (!isRequirementFor && !isOptionalFor) continue;

        if (ul.step < minStep) {
            minStep = ul.step;
        }
    }

    return minStep;
}
