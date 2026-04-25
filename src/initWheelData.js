import { json } from "d3-fetch";

import { TECH_IMG_WIDTH, TECH_IMG_RADIUS, LABEL_PADDING } from "./constants";
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

  // Calculate label radius based on longest tech name
  const labelRadius = TECH_IMG_RADIUS + TECH_IMG_WIDTH / 2 + LABEL_PADDING;

    // Store processed data on window.app
    window.app.wheelData = {
        allTechs,
        prerequisites,
        spokeData,
        squareData,
        circleData,
        labelRadius
    };

    renderWheel();
}
