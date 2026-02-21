import { json } from "d3-fetch";

import { TECH_IMG_WIDTH, TECH_IMG_RADIUS, LABEL_PADDING } from "./constants";
import { depthSortTechnologies } from "./depthSortTechnologies";
import createUnlocks from "./createUnlocks";
import { getMaxTextWidth } from "./helpers";
import { renderWheel } from "./makeWheel";
import { setupSpokes } from "./setupSpokes";

/**
 * Load and process data for the wheel visualization.
 * Call this once on startup and when the game changes.
 */
export async function initWheelData() {
  var { game } = window.app;
  var path = game + "/civdata.json";

  var data = await json(path);
  var sortedTechs = depthSortTechnologies(data.technologies);
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
  const maxLabelWidth = getMaxTextWidth(allTechs.map(t => t.name));
  const labelRadius = TECH_IMG_RADIUS + TECH_IMG_WIDTH / 2 + LABEL_PADDING + maxLabelWidth / 2;

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
