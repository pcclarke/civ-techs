import { json } from "d3-fetch";

import {
    ARC_BASE,
    ARC_GAP_FROM_ICONS,
    ARC_SPACE_MAX,
    TECH_IMG_WIDTH,
} from "./constants";
import { computeWheelLayout } from "./computeWheelLayout";
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
  var nodes = data[dataKey] || data.technologies;
  var sortedTechs = depthSortTechnologies(nodes);
  var { allTechs, prerequisites } = createUnlocks(sortedTechs);
  var spokeData = setupSpokes(allTechs, prerequisites);

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
  const { labelRadius, techImgRadius } =
      computeWheelLayout(window.app.svg.techLabels, allTechs);

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
      arcSpace,
  };

  renderWheel();
}
