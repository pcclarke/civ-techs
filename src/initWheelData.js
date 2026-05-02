import { json } from "d3-fetch";

import {
    ARC_BASE,
    ARC_GAP_FROM_ICONS,
    ARC_SPACE_MAX,
    TECH_IMG_WIDTH,
} from "./constants";
import { computeWheelLayout } from "./computeWheelLayout";
import { computeEraRanges, getEraOrdering } from "./eraData";
import { depthSortTechnologies } from "./depthSortTechnologies";
import createUnlocks from "./createUnlocks";
import { renderWheel } from "./makeWheel";
import { setupSpokes } from "./setupSpokes";

/**
 * Load and process data for the wheel visualization.
 * Call this once on startup and when the game changes.
 */
export async function initWheelData() {
  var { game, tree } = window.app;
  var path = game + "/civdata.json";

  var data = await json(path);
  // Pick the right node array for the active tree (default: technologies).
  // For pre-tree games this is just `data.technologies`; for Civ 6 it can
  // also be `data.civics`.
  var dataKey = (tree && tree.dataKey) || "technologies";
  var rawNodes = data[dataKey] || data.technologies;

  // Civ 3 stores eras as fake-tech entries (kind: "Era") inline with the
  // real techs so prereqs like "Pottery → Ancient Times" can resolve. We
  // don't render eras as nodes — they're a separate visualization layer —
  // so strip them out before anything else looks at the list.
  var nodes = rawNodes.filter((n) => n.kind !== "Era");

  // Build a canonical era-ordering map from the techs (in their authored
  // JSON order, which is chronological for every game). Pass it to the
  // sorter so techs cluster by era, then sub-sort by depth/cost. Games
  // with no era info (Civ 1, Civ 4) end up with an empty map and the sort
  // falls back to its original depth-then-cost behaviour.
  const eraIndex = getEraOrdering(nodes);
  var sortedTechs = depthSortTechnologies(nodes, eraIndex);
  var { allTechs, prerequisites } = createUnlocks(sortedTechs);
  var spokeData = setupSpokes(allTechs, prerequisites);

  // After the era-aware sort, eras are contiguous on the wheel — derive
  // each era's first/last tech index so the era ring/background can draw
  // them as wedges. We feed `sortedTechs` (not `allTechs`) because
  // createUnlocks rebuilds each tech as a new object that omits the .era
  // field; the two arrays share order and length, so positions match.
  // Empty for games without era data.
  const eraRanges = computeEraRanges(sortedTechs);

  // Pre-compute square and circle data from prerequisites
  var squareData = [];
  var circleData = [];
  for (let u of prerequisites) {
    if (u.reqFor) {
      for (let r of u.reqFor) {
        squareData.push({
          ...r,
          step: u.step,
          arcId: u.id
        });
      }
    }

    if (u.optFor) {
      for (let o of u.optFor) {
        circleData.push({
          ...o,
          step: u.step,
          arcId: u.id
        });
      }
    }
  }

  // Size the wheel to its data: measure the actual rendered label widths so
  // the largest one sits ~EDGE_PADDING from the SVG edge, then derive the
  // icon ring inward from that. Done per data load, after the SVG exists,
  // because widths depend on the live font + the specific tech names.
  // When the wheel has eras, we also reserve an outer band for era labels
  // so they sit outside the tech labels rather than overlapping them.
  const hasEras = eraRanges.length > 0;
  const { labelRadius, techImgRadius, eraLabelRadius } =
      computeWheelLayout(window.app.svg.techLabels, allTechs, hasEras);

  // Space the arc rings to fill the gap between ARC_BASE and the icon ring,
  // capped at ARC_SPACE_MAX so trees with few steps don't end up with absurdly
  // wide gaps. The icon ring's inner edge sits at (techImgRadius - half the
  // icon width); reserve ARC_GAP_FROM_ICONS between that edge and the
  // outermost arc. If there are no arcs (maxStep === 0) the value is unused;
  // keep the max so any future single-arc render still looks reasonable.
  let maxStep = 0;
  for (const p of prerequisites) {
      if (p.step > maxStep) maxStep = p.step;
  }
  const iconInnerEdge = techImgRadius - TECH_IMG_WIDTH / 2;
  const arcSpace = maxStep > 0
      ? Math.min(
          ARC_SPACE_MAX,
          (iconInnerEdge - ARC_BASE - ARC_GAP_FROM_ICONS) / maxStep
        )
      : ARC_SPACE_MAX;

  // Store processed data on window.app
  window.app.wheelData = {
      allTechs,
      prerequisites,
      spokeData,
      squareData,
      circleData,
      labelRadius,
      techImgRadius,
      eraLabelRadius,
      eraRanges,
      arcSpace,
  };

  renderWheel();
}
