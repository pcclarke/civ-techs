import { json } from "d3-fetch";
import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";

import { unlockArc } from "./arcs";
import {
  ARC_BASE,
  ARC_SPACE,
  TECH_IMG_WIDTH
} from "./constants";
import { depthSortTechnologies } from "./depthSortTechnologies";
import {
  calculateSingleRadialLinePath,
  calculatePointOnWheel,
} from "./helpers";
import createUnlocks from "./createUnlocks";
import { setupSpokes } from "./setupSpokes";

export default async function makeWheel() {
  const game = window.app.game;
  const selected = window.app.selected;
  var svg = window.app.svg;

  var path = game + "/civdata.json";
  var color = scaleOrdinal(schemeCategory10);

  var data = await json(path);
  var techData = depthSortTechnologies(data.technologies);
  var techDataWithUnlocks = createUnlocks(techData);
  var unlocksData = techDataWithUnlocks.filter(u => {
    return u.reqFor.length > 0 || u.optFor.length > 0;
  });
  var spokeData = setupSpokes(techData, unlocksData);
  console.log(techData, unlocksData, spokeData);

  svg.spokes
    .selectAll(".spoke-line")
    .data(spokeData)
    .join("path")
    .attr("class", "spoke-line")
    .classed("fade", function(d) {
      if (!selected) return false;

      return selected != d.id;
    })
    .attr("d", (d, i) =>
      calculateSingleRadialLinePath(
        spokeData.length,
        ARC_BASE + ARC_SPACE * d.step,
        420,
        i
      )
    );

  svg.techImages
    .selectAll(".tech-image")
    .data(techDataWithUnlocks)
    .join("image")
    .attr("class", "tech-image")
    .classed("fade", function(d) {
      if (!selected) return false;

      const currentSelection = d.id == selected;
      const reqTo = d.reqTo && d.reqTo.find(r => r.id == selected);
      const optTo = d.optTo && d.optTo.find(o => o.id == selected);
      const reqFor = d.reqFor && d.reqFor.find(r => r.id == selected);
      const optFor = d.optFor && d.optFor.find(o => o.id == selected);

      return !(currentSelection || reqFor || optFor || reqTo || optTo);
    })
    .attr("transform", (_, i) => {
      var point = calculatePointOnWheel(techDataWithUnlocks.length, i, 420);
      var rotate =
        point.angle * (180 / Math.PI) - (i > techDataWithUnlocks.length / 2 ? 180 : 0);

      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("height", TECH_IMG_WIDTH)
    .attr("width", TECH_IMG_WIDTH)
    .attr("x", -TECH_IMG_WIDTH / 2)
    .attr("y", -TECH_IMG_WIDTH / 2)
    .attr("xlink:href", (d) => `${game}/img/technologies/${d.id}.png`)
    .on("mouseover", function(_, d) {
      window.app.selected = d.id;
      makeWheel();
    })
    .on("mouseleave", function() {
      window.app.selected = null;
      makeWheel();
    });

  svg.arcs
    .selectAll("path")
    .data(unlocksData)
    .join("path")
    .classed("fade", Boolean(selected))
    .attr("d", (d) => unlockArc(d))
    .attr("fill", (d) => color(d.step))
    .on("mouseover", function(_, d) {
      console.log(d);
      window.app.selected = d.id;
      makeWheel();
    })
    .on("mouseleave", function() {
      window.app.selected = null;
      makeWheel();
    });

  svg.unlockPins
    .selectAll("path")
    .data(unlocksData)
    .join("path")
    .classed("fade", function(d) {
      if (!selected) return false;

      return selected != d.id;
    })
    .attr("d", function pinPath(d, i) {
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

  svg.unlockSquares
    .selectAll("rect")
    .data(squareData)
    .join("rect")
    .classed("fade", function(d) {
      if (!selected) return false;

      return selected != d.id;
    })
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

  svg.unlockCircles
    .selectAll("circle")
    .data(circleData)
    .join("circle")
    .classed("fade", function(d) {
      if (!selected) return false;

      return selected != d.id;
    })
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

  svg.centerImage
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
