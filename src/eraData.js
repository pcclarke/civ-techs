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
 * Canonical cross-game identity for an era, used to key the wheel's era
 * joins so a switch morphs the eras two games share rather than fading
 * one out while its counterpart fades in (see animateEraBackgrounds in
 * animateWheelSwitch.js).
 *
 * The series spells the same era three different ways. Civ 4-6 use enum
 * ids (`ERA_MEDIEVAL`), while Civ 2, 3 and 7 use prose that drifts
 * between titles — `Ancient` vs `Ancient Times`, `Modern` vs `Modern
 * Times`, `Industrial Revolution` vs `Industrial Ages`, `Middle Ages`
 * for what every other game calls Medieval. Stripping the prefix and
 * case-folding handles the enum/prose split; the alias table handles the
 * prose-to-prose drift.
 *
 * Civ 7's `Antiquity` folds into `ancient` on purpose: it covers the same
 * stretch of history under a different name, and folding it means a
 * Civ 4 -> Civ 7 switch slides that wedge to its new span instead of
 * crossfading two wedges that mean the same thing. `Exploration` has no
 * counterpart anywhere else in the series and keeps its own key.
 *
 * Only used for identity, never for display — eraDisplayName below still
 * shows each game's own wording.
 */
const ERA_ALIASES = new Map([
    ["ancient times",        "ancient"],
    ["antiquity",            "ancient"],
    ["middle ages",          "medieval"],
    ["industrial revolution", "industrial"],
    ["industrial ages",      "industrial"],
    ["modern times",         "modern"],
]);

export function eraKey(era) {
    if (!era) return "";
    const base = era.startsWith("ERA_") ? era.slice(4) : era;
    const normalised = base.toLowerCase().replace(/_/g, " ").trim();
    return ERA_ALIASES.get(normalised) || normalised;
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
