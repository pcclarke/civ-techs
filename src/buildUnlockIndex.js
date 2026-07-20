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
 * Item display: for cross-civ unlocks (Civ 3+) buildings/units may be
 * wrapped in `{ CIVILIZATION_ALL: { name, id }, id, requires }` rather
 * than carrying name/id flat. We pick whichever is present, falling back
 * to id so something always renders.
 *
 * Civ-unique variants ride along: a class with per-civilization overrides
 * (Swordsman → Praetorian for Rome) gets a `uniques` array of
 * `{ id, name, civ }` where `civ` is the display name resolved from
 * `data.civilizations`; a class with ONLY a civ-specific entry and no
 * CIVILIZATION_ALL (Foreign Legion, Landsknecht) is itself exclusive and
 * gets a `civ` tag instead. The tooltip renders both inline so the
 * unique-unit story is visible without any civilization selector.
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
    const civName = buildCivNameLookup(data.civilizations);

    for (const source of UNLOCK_KEYS) {
        if (source === dataKey) continue;
        const items = data[source];
        if (!Array.isArray(items)) continue;

        for (const item of items) {
            const display = displayFor(item, source, civName);

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
 *   - flat: { id, name, ... }                       (Civ 1/2, civics, etc.)
 *   - civ-wrapped: { id: CLASS_ID, CIVILIZATION_ALL: { id, name },
 *                    CIVILIZATION_ROME: { id, name }, ... }
 *                                                   (Civ 3+ buildings/units)
 *   - civ-specific: { id: CLASS_ID, CIVILIZATION_GERMANY: { id, name } }
 *                                                   (Civ 3+ uniques with no
 *                                                    shared base version)
 * For the wrapped shapes we prefer the inner concrete unit/building id
 * because that matches the icon filename on disk.
 *
 * Civ-specific entries beyond CIVILIZATION_ALL become the `uniques`
 * array ({id, name, civ} with civ resolved to a display name); when
 * there's no CIVILIZATION_ALL at all, the first civ entry IS the item
 * (Foreign Legion / Landsknecht / Dutch Sea Beggar) and its owner lands
 * in `civ` instead.
 */
function displayFor(item, source, civName) {
    let all = null;
    const civEntries = [];
    for (const key of Object.keys(item)) {
        // Civ 6 attributes some uniques to a leader rather than a
        // civilization (Rough Rider is Teddy Roosevelt's, not America's);
        // both key families are owner wrappers.
        if (!key.startsWith("CIVILIZATION_") && !key.startsWith("LEADER_")) continue;
        const v = item[key];
        if (!v || typeof v !== "object" || !(v.id || v.name)) continue;
        if (key === "CIVILIZATION_ALL") {
            all = v;
        } else {
            civEntries.push({
                id:   v.id || item.id,
                name: v.name || v.id || item.id,
                civ:  civName(key),
            });
        }
    }

    if (all) {
        return {
            id:      all.id || item.id,
            name:    all.name || all.id || item.id,
            source,
            uniques: civEntries.length > 0 ? civEntries : undefined,
        };
    }
    if (civEntries.length > 0) {
        const [first, ...rest] = civEntries;
        return {
            id:      first.id,
            name:    first.name,
            source,
            civ:     first.civ,
            uniques: rest.length > 0 ? rest : undefined,
        };
    }
    return {
        id:     item.id,
        name:   item.name || item.id,
        source,
    };
}


/**
 * Resolve CIVILIZATION_* keys to display names via data.civilizations.
 * Civ 4/5 name their civs "<Adjective> Empire"; the suffix is dropped so
 * inline tags stay short ("Praetorian (Roman)" rather than
 * "(Roman Empire)"). Unknown keys fall back to title-casing the id so a
 * data gap never renders as CIVILIZATION_HOLY_ROMAN.
 */
function buildCivNameLookup(civilizations) {
    const byId = new Map();
    if (Array.isArray(civilizations)) {
        for (const c of civilizations) {
            if (c && c.id && c.name) {
                byId.set(c.id, c.name.replace(/ Empire$/, ""));
            }
        }
    }
    return (civKey) =>
        byId.get(civKey) ||
        civKey
            .replace(/^(CIVILIZATION_|LEADER_)/, "")
            .toLowerCase()
            .split("_")
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
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
