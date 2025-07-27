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

export const totalWidth = 1200;
export const totalHeight = 1200;

export const margin = { top: 10, right: 10, bottom: 10, left: 10 };

export const width = totalWidth - margin.left - margin.right;
export const height = totalHeight - margin.top - margin.bottom;

export const arcBase = 100;
export const arcSpace = 14;
export const arcWidth = 1.5;
export const angleShift = 2;

const angleGap = 0.05;

export const TWO_PI = 2 * Math.PI;
export const TWO_PI_ADJ = (1 - angleGap) * TWO_PI;
export const PI_DIFF = (angleGap / 2) * TWO_PI;

export const ANG_ADJ = (1 - angleGap) * 360;
export const ANG_DIFF = (angleGap / 2) * 360;
