export const GAMES = [
    { name: "Civilization 1", id: "civ1" },
    { name: "Civilization 2", id: "civ2" },
    {
        name: "Civilization 3",
        id: "civ3",
        expansions: [
            { name: "Play the World", id: "civ3ptw" },
            { name: "Conquests", id: "civ3con" }
        ]
    },
    {
        name: "Civilization 4",
        id: "civ4",
        expansions: [
            { name: "Warlords", id: "civ4war" },
            { name: "Beyond the Sword", id: "civ4bts" }
        ]
    },
    {
        name: "Civilization 5",
        id: "civ5",
        expansions: [
            { name: "Gods & Kings", id: "civ5gnk" },
            { name: "Brave New World", id: "civ5bnw" }
        ]
    },
    {
        // Civ 6 ships two parallel progression trees — technologies and
        // civics. They share the wheel renderer; the in-Civ-6 `trees` toggle
        // picks which array of nodes to render. Rise & Fall doesn't change
        // the trees (it only adds Boosts/Modifiers/governor mechanics), so
        // civ6rf is data-identical to civ6 — kept as a separate entry so
        // the user can pick the matching center logo. Gathering Storm adds
        // 10 techs and 10 civics, including a Future era and the random-
        // prereq mechanic on late-game nodes (we just ignore the random-
        // prereq metadata and draw the static prereqs).
        name: "Civilization 6",
        id: "civ6",
        expansions: [
            { name: "Rise & Fall",      id: "civ6rf" },
            { name: "Gathering Storm",  id: "civ6gs" }
        ],
        trees: [
            { name: "Technologies", id: "tech",   folder: "technologies", dataKey: "technologies" },
            { name: "Civics",       id: "civics", folder: "civics",       dataKey: "civics" }
        ]
    },
    {
        // Civ 7 splits each game into three sequential Ages (Antiquity,
        // Exploration, Modern), each with its own tech and civic trees that
        // reset between Ages. We render the three Ages as eras on a single
        // wheel — they appear as three colored bands with no spokes
        // crossing between them, since cross-Age prereqs don't exist.
        // Data was scraped from the community Fandom wiki rather than the
        // game files (see data_scrapers/civ7/scraper.py); no expansions
        // wired up yet.
        name: "Civilization 7",
        id: "civ7",
        trees: [
            { name: "Technologies", id: "tech",   folder: "technologies", dataKey: "technologies" },
            { name: "Civics",       id: "civics", folder: "civics",       dataKey: "civics" }
        ]
    }
];

export const DEFAULT_GAME = GAMES[3];

export const dataTypes = [
  "units",
  "buildings",
  "religions",
  "build",
  "resources",
  "projects",
  "promotions",
  "civics",
];

export const TOTAL_WIDTH = 1200;
export const TOTAL_HEIGHT = TOTAL_WIDTH;

export const MARGIN_TOP = 10;
export const MARGIN_RIGHT = 10;
export const MARGIN_BOTTOM = 10;
export const MARGIN_LEFT = 10;

export const CHART_WIDTH = TOTAL_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
export const CHART_HEIGHT = TOTAL_HEIGHT - MARGIN_TOP - MARGIN_BOTTOM;

export const CENTER_X = CHART_WIDTH / 2;
export const CENTER_Y = CHART_HEIGHT / 2;

export const TECH_IMG_WIDTH = 25;
/** Default radius from chart center to tech images. The live wheel computes
 *  this dynamically each render based on label widths (see computeWheelLayout),
 *  but the constant is still a useful fallback / sanity ceiling. */
export const TECH_IMG_RADIUS = 420;
/** Padding between tech image edge and label */
export const LABEL_PADDING = 8;
/** Clearance between the outermost label corner and the SVG edge */
export const EDGE_PADDING = 4;
/** Floor on the dynamically-computed tech image radius so the inner arc
 *  region always has room. If labels are extremely wide we'd rather clip
 *  one or two of them than collapse the whole wheel. */
export const MIN_TECH_IMG_RADIUS = 200;

/** Radius from chart center to first arc position */
export const ARC_BASE = 100;
/** Default radial distance between arcs. The live wheel computes this
 *  dynamically each render so arcs scale with the available radial space
 *  between ARC_BASE and the icon ring; this constant is a fallback. */
export const ARC_SPACE = 14;
/** Maximum radial distance between arcs. Caps the dynamic spacing so arcs
 *  don't get unreasonably spread out on small trees with lots of room. */
export const ARC_SPACE_MAX = 20;
/** Clearance between the outermost arc and the inner edge of the icon ring. */
export const ARC_GAP_FROM_ICONS = 16;

/** Radial band reserved at the outer edge of the wheel for era labels. The
 *  layout shrinks the label-radius cap by this amount so the era ring sits
 *  outside the tech labels without clipping at the SVG edge. Set to 0 to
 *  disable the era ring entirely. */
export const ERA_LABEL_HEIGHT = 24;

/** Percent of circle that should be left open */
const ANGLE_GAP = 0.05;

export const TWO_PI = 2 * Math.PI;
/** Two PI minus the gap */
export const TWO_PI_ADJ = (1 - ANGLE_GAP) * TWO_PI;
/** Two PI minus half the gap */
export const PI_DIFF = (ANGLE_GAP / 2) * TWO_PI;

/** 360 degrees minus the gap */
export const ANG_ADJ = (1 - ANGLE_GAP) * 360;
/** 360 degrees minus half the gap */
export const ANG_DIFF = (ANGLE_GAP / 2) * 360;

export const GAME_IMG_WIDTH = 150;
