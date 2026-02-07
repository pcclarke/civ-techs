import { json } from "d3-fetch";

import { depthSortTechnologies } from "./depthSortTechnologies";
import createUnlocks from "./createUnlocks";
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

  // Store processed data on window.app
  return {
    allTechs,
    prerequisites,
    spokeData,
    squareData,
    circleData
  };
}
