/**
 * Sort the order of the technologies by how deeply nested their
 * prerequisites are.
 *
 * If `eraIndex` is supplied, eras become the *primary* grouping: techs sort
 * first by their era's canonical position, then by depth, then by cost. This
 * keeps each era as one contiguous arc on the wheel — required for the era
 * ring/background visualization. Without `eraIndex`, behaviour is the
 * original depth-then-cost ordering.
 *
 * @param {Object[]} technologyData
 * @param {Map<string, number>} [eraIndex] Optional era → position map.
 * @returns
 */
export function depthSortTechnologies(technologyData, eraIndex) {
  // Calculate dependency depth for each technology
  const depthMap = new Map();

  function calculateDepth(techId, techMap, visited = new Set()) {
    if (visited.has(techId)) return 0; // Cycle detection
    if (depthMap.has(techId)) return depthMap.get(techId);

    visited.add(techId);
    const tech = techMap.get(techId);
    if (!tech) return 0;

    let maxDepth = 0;
    const dependencies = [...(tech.requires || []), ...(tech.optional || [])];

    for (let depId of dependencies) {
      maxDepth = Math.max(
        maxDepth,
        calculateDepth(depId, techMap, visited) + 1
      );
    }

    visited.delete(techId);
    depthMap.set(techId, maxDepth);
    return maxDepth;
  }

  const techMap = new Map(technologyData.map((t) => [t.id, t]));

  // Calculate depths
  for (let tech of technologyData) {
    calculateDepth(tech.id, techMap);
  }

  // When an eraIndex is provided, sort by (era, depth, cost). Techs whose
  // era isn't in the map (or who have no era at all) sort to the end with a
  // sentinel — they're rare in practice but we don't want them poisoning the
  // ordering for known eras.
  const eraFor = (tech) => {
    if (!eraIndex) return 0;
    const e = tech.era || "";
    return eraIndex.has(e) ? eraIndex.get(e) : Number.MAX_SAFE_INTEGER;
  };

  const sortedTechnologies = [...technologyData].sort((a, b) => {
    if (eraIndex) {
      const eraA = eraFor(a);
      const eraB = eraFor(b);
      if (eraA !== eraB) return eraA - eraB;
    }

    const depthA = depthMap.get(a.id) || 0;
    const depthB = depthMap.get(b.id) || 0;

    if (depthA !== depthB) {
      return depthA - depthB;
    }

    return (a.cost || 0) - (b.cost || 0);
  });

  return sortedTechnologies;
}
