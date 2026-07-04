/**
 * Build per-node lookups of "what does this unlock" and "what does this
 * make obsolete" by walking every unlock-shaped array in the loaded data.
 *
 * The wheel renders one tree at a time (technologies, or civics on
 * Civ 6/7), but most games carry several other arrays of game items —
 * buildings, units, terrain improvements, projects, etc. — and each item
 * names the tech (or civic) that enables or retires it via `requires` and
 * `obsolete`/`obsolete2` fields. Indexing these by node id once at load
 * time means the tooltip can list a node's downstream effects in O(1).
 *
 * The current tree's own array is excluded — on the tech wheel, a
 * technology isn't an "unlock" of itself, and the tooltip already shows
 * tech-to-tech edges via the existing Required/Required-for sections.
 *
 * `requires` and `obsolete` come in two shapes across games: a bare
 * string id in Civ 1/2 era, or an array of ids in Civ 3+. Both are
 * normalised here so callers don't have to care.
 *
 * Item display: for cross-civ unlocks (Civ 4+) buildings/units may be
 * wrapped in `{ CIVILIZATION_ALL: { name, id }, id, requires }` rather
 * than carrying name/id flat. We pick whichever is present, falling back
 * to id so something always renders.
 *
 * `source` is the originating array key (e.g. "buildings"); the tooltip
 * groups by it and uses it to construct the icon path
 * (`<game>/img/<source>/<itemId>.png`).
 */

// Top-level keys that may contain things unlocked or retired by techs/civics.
// Civilizations and game-text-only keys are deliberately omitted. Civ 6
// adds districts, wonders (split out of buildings), policies, and
// governments; "improvements" is the Civ 6 name for what older games
// called "build" — both keys are walked so the same tooltip works across
// every game.
const UNLOCK_KEYS = [
    "buildings",
    "wonders",
    "units",
    "build",
    "improvements",
    "districts",
    "projects",
    "policies",
    "governments",
    "promotions",
    "religions",
    "resources",
    "civics",
];

/**
 * @param {object} data       raw civdata.json contents
 * @param {string} dataKey    the active tree's key (omit this from sources)
 * @returns {{
 *   unlocksByTech: Map<string, Array<UnlockItem>>,
 *   obsoletesByTech: Map<string, Array<UnlockItem>>,
 * }}
 */
export function buildUnlockIndex(data, dataKey) {
    const unlocksByTech = new Map();
    const obsoletesByTech = new Map();

    for (const source of UNLOCK_KEYS) {
        if (source === dataKey) continue;
        const items = data[source];
        if (!Array.isArray(items)) continue;

        for (const item of items) {
            const display = displayFor(item, source);

            for (const tid of asList(item.requires)) {
                bucket(unlocksByTech, tid).push(display);
            }
            // Some games (Civ 1) use both `obsolete` and `obsolete2`; later
            // games drop obsolete2. Treat both as additional obsolete edges.
            for (const tid of asList(item.obsolete)) {
                bucket(obsoletesByTech, tid).push(display);
            }
            if (item.obsolete2) {
                bucket(obsoletesByTech, item.obsolete2).push(display);
            }
        }
    }

    return { unlocksByTech, obsoletesByTech };
}


/**
 * Normalise the {id, name, source} we'll show in the tooltip. Handles
 * three name/id conventions in our data:
 *   - flat: { id, name, ... }                       (Civ 1/2/3, civics, etc.)
 *   - civ-wrapped: { id: CLASS_ID, CIVILIZATION_ALL: { id, name } }
 *                                                   (Civ 4+ shared buildings/units)
 *   - civ-specific: { id: CLASS_ID, CIVILIZATION_GERMANY: { id, name } }
 *                                                   (Civ 4+ unique buildings/units)
 * For the wrapped shapes we prefer the inner concrete unit/building id
 * because that matches the icon filename on disk. Uniques land under
 * `CIVILIZATION_<CIV>` instead of `CIVILIZATION_ALL`; falling back to
 * "any CIVILIZATION_ key with an id" lets Foreign Legion / Landsknecht /
 * Dutch Sea Beggar / etc. resolve to their proper on-disk icons.
 */
function displayFor(item, source) {
    const inner = pickCivWrapper(item);
    if (inner && (inner.name || inner.id)) {
        return {
            id:     inner.id || item.id,
            name:   inner.name || inner.id || item.id,
            source,
        };
    }
    return {
        id:     item.id,
        name:   item.name || item.id,
        source,
    };
}


/**
 * Return the CIVILIZATION_ALL sub-object if present, otherwise the first
 * CIVILIZATION_<CIV> sub-object that carries a real id or name. Ignores
 * every other top-level key (id, name, requires, etc.) so we don't
 * misread cost/cat/etc. as a civ wrapper.
 */
function pickCivWrapper(item) {
    if (item.CIVILIZATION_ALL && typeof item.CIVILIZATION_ALL === "object") {
        return item.CIVILIZATION_ALL;
    }
    for (const key of Object.keys(item)) {
        if (!key.startsWith("CIVILIZATION_")) continue;
        const v = item[key];
        if (v && typeof v === "object" && (v.id || v.name)) return v;
    }
    return null;
}


function asList(v) {
    if (v == null) return [];
    return Array.isArray(v) ? v : [v];
}


function bucket(map, key) {
    let list = map.get(key);
    if (!list) {
        list = [];
        map.set(key, list);
    }
    return list;
}
