import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";

import { ARC_BASE, ARC_SPACE } from "./constants";
import { calculateSingleRadialLinePath, wheelTransform } from "./helpers";
import { drawArcs, drawSpokes, drawTechImages, drawTechLabels } from "./drawTools";
import { setupHighlights } from "./setupHighlights";

const color = scaleOrdinal(schemeCategory10);

/**
 * Render the wheel visualization using cached data.
 * Call this when the selection changes.
 */
export async function renderWheel() {
    var { game, selected, svg, wheelData } = window.app;
    const {
        allTechs,
        prerequisites,
        spokeData,
        squareData,
        circleData,
        labelRadius
    } = wheelData;
    const {
        highlightedIds,
        selectionPrerequisites,
        selectedSpokes,
        prerequisiteIds
    } = setupHighlights(allTechs);


  drawSpokes(svg.spokes, spokeData, allTechs.length)
      .classed("fade", Boolean(selected));

  drawSpokes(svg.selectedSpokes, selectedSpokes, allTechs.length);

  drawTechImages(svg.techImages, allTechs, game, highlightedIds);
  drawTechLabels(svg.techLabels, allTechs, highlightedIds, labelRadius);

  drawArcs(svg.arcs, prerequisites, color)
      .classed("fade", Boolean(selected))
      .on("mouseover", (_, d) => {
          console.log(d);
          window.app.selected = d;
      })
      .on("mouseleave", () => window.app.selected = null);

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
    .classed("fade", (d) => {
        if (!selected || selected.id == d.id || selected.id == d.arcId) return false;
        return true;
    })
    .attr("x", -2.5)
    .attr("y", -2.5)
    .attr("transform", (d) => wheelTransform(allTechs.length, d.pos, ARC_BASE + ARC_SPACE * d.step))
    .attr("width", 5)
    .attr("height", 5)
    .attr("fill", (d) => color(d.step));

  svg.unlockCircles
    .selectAll("circle")
    .data(circleData)
    .join("circle")
    .classed("fade", (d) => {
        if (!selected || selected.id == d.id || selected.id == d.arcId) return false;
        return true;
    })
    .attr("r", 2.5)
    .attr("transform", (d) => wheelTransform(allTechs.length, d.pos, ARC_BASE + ARC_SPACE * d.step))
    .attr("fill", "#FFF")
    .attr("stroke", (d) => color(d.step));

  svg.centerImage
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
