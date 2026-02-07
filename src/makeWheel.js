import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";

import {
    ARC_BASE,
    ARC_SPACE,
    TECH_IMG_WIDTH
} from "./constants";
import {
    calculateSingleRadialLinePath,
    calculatePointOnWheel,
    fadeCheck
} from "./helpers";
import { initWheelData } from "./initWheelData";
import { drawArcs, drawSpokes } from "./drawTools";
import { setupHighlights } from "./setupHighlights";

const color = scaleOrdinal(schemeCategory10);

/**
 * Render the wheel visualization using cached data.
 * Call this when the selection changes.
 */
export async function renderWheel() {
    const { game, selected, svg } = window.app;
    const {
        allTechs,
        prerequisites,
        spokeData,
        squareData,
        circleData
    } = await initWheelData();
    const {
        highlightedIds,
        selectionPrerequisites,
        selectedSpokes,
        prerequisiteIds
    } = setupHighlights(allTechs);


  drawSpokes(svg.spokes, spokeData, allTechs.length)
      .classed("fade", Boolean(selected));

  drawSpokes(svg.selectedSpokes, selectedSpokes, allTechs.length);

  svg.techImages
    .selectAll(".tech-image")
    .data(allTechs)
    .join("image")
    .attr("class", "tech-image")
    .classed("fade", (d) => fadeCheck(d, highlightedIds))
    .attr("transform", (_, i) => {
      var point = calculatePointOnWheel(allTechs.length, i, 420);
      var rotate =
        point.angle * (180 / Math.PI) - (i > allTechs.length / 2 ? 180 : 0);

      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("height", TECH_IMG_WIDTH)
    .attr("width", TECH_IMG_WIDTH)
    .attr("x", -TECH_IMG_WIDTH / 2)
    .attr("y", -TECH_IMG_WIDTH / 2)
    .attr("xlink:href", (d) => `${game}/img/technologies/${d.id}.png`)
    .on("mouseover", function(_, d) {
      window.app.selected = d;
      renderWheel();
    })
    .on("mouseleave", function() {
      window.app.selected = null;
      renderWheel();
    });

  svg.techLabels
    .selectAll("text")
    .data(allTechs)
    .join("text")
    .classed("fade", (d) => fadeCheck(d, highlightedIds))
    .attr("transform", function labelAngle(d, i) {
      var point = calculatePointOnWheel(allTechs.length, i, 440)
      var rotate = point.angle * (180 / Math.PI) - (i > allTechs.length / 2 ? 180 : 0);

      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("y", 5)
    .attr("text-anchor", (_, i) => {
      return (i > allTechs.length / 2) ?
        "end" : "start";
    })
    .text(d => d.name);

  drawArcs(svg.arcs, prerequisites, color)
      .classed("fade", Boolean(selected))
      .on("mouseover", function(_, d) {
          console.log(d);
          window.app.selected = d;
          renderWheel();
      })
      .on("mouseleave", function() {
          window.app.selected = null;
          renderWheel();
      });

  if (Boolean(selected)) {
      drawArcs(svg.selectedArcs, selectionPrerequisites.filter(d => d.step !== undefined), color)
  }

  svg.unlockPins
    .selectAll("path")
    .data(prerequisites)
    .join("path")
    .classed("fade", (d) => {
        if (!selected) return false;
        if (d.id == selected.id || prerequisiteIds.includes(d.id)) return false;

        return true;
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

  svg.unlockSquares
    .selectAll("rect")
    .data(squareData)
    .join("rect")
    .classed("fade", (circle) => {
        if (!selected || selected.id == circle.id || selected.id == circle.arcId) return false;
        return true;
    })
    .attr("x", -2.5)
    .attr("y", -2.5)
    .attr("transform", (d, i) => {
      var point = calculatePointOnWheel(
        allTechs.length,
        d.pos,
        ARC_BASE + ARC_SPACE * d.step
      );
      var rotate =
        point.angle * (180 / Math.PI) - (i > allTechs.length / 2 ? 180 : 0);
      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("width", 5)
    .attr("height", 5)
    .attr("fill", (d) => color(d.step));

  svg.unlockCircles
    .selectAll("circle")
    .data(circleData)
    .join("circle")
    .classed("fade", (circle) => {
        if (!selected || selected.id == circle.id || selected.id == circle.arcId) return false;
        return true;
    })
    .attr("r", 2.5)
    .attr("transform", (d, i) => {
      var point = calculatePointOnWheel(
        allTechs.length,
        d.pos,
        ARC_BASE + ARC_SPACE * d.step
      );
      var rotate =
        point.angle * (180 / Math.PI) - (i > allTechs.length / 2 ? 180 : 0);
      return `translate(${point.x}, ${point.y}) rotate(${rotate})`;
    })
    .attr("fill", "#FFF")
    .attr("stroke", (d) => color(d.step));

  svg.centerImage
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
