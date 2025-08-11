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

/** Radius from chart center to first arc position */
export const ARC_BASE = 100;
/** Radial distance between arcs */
export const ARC_SPACE = 14;

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
