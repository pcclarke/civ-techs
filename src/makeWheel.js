import { json } from "d3-fetch";
import { select } from "d3-selection";

import { unlockArc } from "./arcs";
import {
  ARC_BASE,
  ARC_SPACE,
  MARGIN_TOP,
  MARGIN_LEFT,
  CENTER_X,
  CENTER_Y,
  TOTAL_WIDTH,
  TOTAL_HEIGHT,
} from "./constants";
import { depthSortTechnologies } from "./depthSortTechnologies";
import {
  calculateSingleRadialLinePath,
  calculatePointOnWheel,
} from "./helpers";
import createUnlocks from "./createUnlocks";
import { setupSpokes } from "./setupSpokes";

export default async function makeWheel(wheelState) {
  const { color, game } = wheelState;
  const path = game + "/civdata.json";

  const svg = select("#chart")
    .append("svg")
    .attr("class", "civ-wheel")
    .attr("width", TOTAL_WIDTH)
    .attr("height", TOTAL_HEIGHT)
    .append("g")
    .attr("transform", `translate(${MARGIN_LEFT}, ${MARGIN_TOP})`);

  const data = await json(path);

  var techData = depthSortTechnologies(data.technologies);
  var unlocksData = createUnlocks(techData);
  var spokeData = setupSpokes(techData, unlocksData);
  console.log(techData, unlocksData, spokeData);

  const wheel = svg
    .selectAll(".wheel")
    .data([0])
    .join("g")
    .attr("class", "wheel")
    .attr("transform", `translate(${CENTER_X}, ${CENTER_Y})`);

  // pie "slice" to indicate start of spokes
  wheel
    .selectAll(".start-slice")
    .data([0])
    .join("image")
    .attr("class", "start-slice")
    .attr("x", 0)
    .attr("y", -CENTER_Y)
    .attr("width", 167)
    .attr("height", CENTER_Y)
    .attr("xlink:href", "img/startSlice.png");

  wheel
    .selectAll(".spokes")
    .data([0])
    .join("g")
    .attr("class", "spokes")
    .selectAll(".spoke-line")
    .data(spokeData)
    .join("path")
    .attr("class", "spoke-line")
    .attr("d", (d, i) =>
      calculateSingleRadialLinePath(
        spokeData.length,
        ARC_BASE + ARC_SPACE * d.step,
        420,
        i
      )
    );

  const techImgWidth = 25;

  wheel
    .selectAll(".tech-images")
    .data([0])
    .join("g")
    .attr("class", "tech-images")
    .selectAll(".tech-image")
    .data(techData)
    .join("image")
    .attr("class", "tech-image")
    .attr("transform", (_, i) => {
      var point = calculatePointOnWheel(techData.length, i, 420);
      var rotate =
        point.angle * (180 / Math.PI) - (i > techData.length / 2 ? 180 : 0);

      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("height", techImgWidth)
    .attr("width", techImgWidth)
    .attr("x", -techImgWidth / 2)
    .attr("y", -techImgWidth / 2)
    .attr("xlink:href", (d) => `${game}/img/technologies/${d.id}.png`);

  wheel
    .selectAll(".arcs")
    .data([0])
    .join("g")
    .attr("class", "arcs")
    .selectAll("path")
    .data(unlocksData)
    .join("path")
    .attr("d", (d) => unlockArc(d))
    .attr("fill", (d) => color(d.step));

  wheel
    .selectAll("unlock-pins")
    .data([0])
    .join("g")
    .attr("class", "unlock-pins")
    .selectAll("path")
    .data(unlocksData)
    .join("path")
    .attr("d", (d, i) => {
      return calculateSingleRadialLinePath(
        spokeData.length,
        ARC_BASE - 5 + ARC_SPACE * d.step,
        ARC_BASE + 5 + ARC_SPACE * d.step,
        d.position
      );
    })
    .attr("stroke", (d) => color(d.step));

  var squareData = [];
  var circleData = [];
  for (let u of unlocksData) {
    if (u.reqFor) {
      for (let r of u.reqFor) {
        squareData.push({
          ...r,
          step: u.step,
        });
      }
    }

    if (u.optFor) {
      for (let o of u.optFor) {
        circleData.push({
          ...o,
          step: u.step,
        });
      }
    }
  }

  wheel
    .selectAll(".unlock-squares")
    .data([0])
    .join("g")
    .attr("class", "unlock-squares")
    .selectAll("rect")
    .data(squareData)
    .join("rect")
    .attr("x", -2.5)
    .attr("y", -2.5)
    .attr("transform", (d, i) => {
      var point = calculatePointOnWheel(
        techData.length,
        d.pos,
        ARC_BASE + ARC_SPACE * d.step
      );
      var rotate =
        point.angle * (180 / Math.PI) - (i > techData.length / 2 ? 180 : 0);
      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("width", 5)
    .attr("height", 5)
    .attr("fill", (d) => color(d.step));

  wheel
    .selectAll(".unlock-circles")
    .data([0])
    .join("g")
    .attr("class", "unlock-circles")
    .selectAll("circle")
    .data(circleData)
    .join("circle")
    .attr("r", 2.5)
    .attr("transform", (d, i) => {
      var point = calculatePointOnWheel(
        techData.length,
        d.pos,
        ARC_BASE + ARC_SPACE * d.step
      );
      var rotate =
        point.angle * (180 / Math.PI) - (i > techData.length / 2 ? 180 : 0);
      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("fill", "#FFF")
    .attr("stroke", (d) => color(d.step));

  wheel
    .append("image")
    .attr("x", -75)
    .attr("y", -75)
    .attr("width", 150)
    .attr("height", 150)
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
