/**
 * Sort the order of the technologies by how deeply nested their
 * prerequisites are
 * @param {Object[]} technologyData
 * @returns
 */
export function depthSortTechnologies(technologyData) {
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

  // Sort by depth first, then by cost
  const sortedTechnologies = [...technologyData].sort((a, b) => {
    const depthA = depthMap.get(a.id) || 0;
    const depthB = depthMap.get(b.id) || 0;

    if (depthA !== depthB) {
      return depthA - depthB;
    }

    return (a.cost || 0) - (b.cost || 0);
  });

  return sortedTechnologies;
}
