/**
 * Helpers for treating eras as a separate visualization layer rather than
 * as nodes on the wheel. The wheel renderer doesn't know what an era is
 * conceptually; this module turns the per-tech `era` field into the data
 * structures rendering needs.
 */

/**
 * Build a Map from era name → canonical position index, taking the order
 * each era first appears in the raw JSON node list. The data files are
 * authored in chronological era order, so first-appearance is the right
 * canonical order for every game.
 *
 * @param {Object[]} rawNodes Tech nodes straight from the JSON file
 *                            (era-kind nodes already filtered out).
 * @returns {Map<string, number>}
 */
export function getEraOrdering(rawNodes) {
    const seen = new Set();
    const ordered = [];
    for (const t of rawNodes) {
        const e = t.era || "";
        if (!e || seen.has(e)) continue;
        seen.add(e);
        ordered.push(e);
    }
    return new Map(ordered.map((e, i) => [e, i]));
}

/**
 * After techs are sorted onto the wheel, find each era's contiguous index
 * range (first/last tech position). Returns one entry per era in the order
 * eras appear on the wheel.
 *
 * Assumes the tech sort grouped techs by era (see depthSortTechnologies
 * with eraIndex). If that contract is broken, eras would appear as
 * disjoint runs and this function would silently merge them — that's fine
 * for the visual but undermines the eras-as-regions concept.
 *
 * @param {Object[]} allTechs Sorted techs with a `.era` field.
 * @returns {Array<{era: string, first: number, last: number, count: number}>}
 */
export function computeEraRanges(allTechs) {
    const count = allTechs.length;
    const out = [];
    const byEra = new Map();
    for (let i = 0; i < count; i++) {
        const e = allTechs[i].era || "";
        if (!e) continue;
        if (!byEra.has(e)) {
            const entry = { era: e, first: i, last: i, count };
            byEra.set(e, entry);
            out.push(entry);
        } else {
            byEra.get(e).last = i;
        }
    }
    return out;
}

/**
 * Civ 5+ store eras as enum-style ids (`ERA_INFORMATION`); Civ 2 and 3
 * use plain English (`Industrial Ages`). Normalise to a friendly label
 * for display.
 */
export function eraDisplayName(era) {
    if (!era) return "";
    if (!era.startsWith("ERA_")) return era;
    return era
        .slice(4)
        .toLowerCase()
        .replace(/^./, (c) => c.toUpperCase());
}
