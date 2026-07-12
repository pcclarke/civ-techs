import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";

import { ARC_BASE } from "./constants";
import { calculateSingleRadialLinePath, wheelTransform } from "./helpers";
import { drawArcs, drawSpokes, drawTechImages, drawTechLabels } from "./drawTools";
import { drawEraBackgrounds, drawEraLabels } from "./drawEras";
import { setupHighlights } from "./setupHighlights";
import { hideTooltip, showTooltip } from "./tooltip";

const color = scaleOrdinal(schemeCategory10);
// Era colours are a hand-picked muted "antique" palette — desaturated,
// mid-dark tones that read clearly as 22px serif text and tint softly as
// wedge backgrounds, while staying visually distinct from the vivid
// Category10 hues the arcs use (the era labels sit right on top of the
// arc region, so the two palettes must not be confusable). Nine entries
// covers the largest era count (Civ 6 GS); the ordinal scale wraps if a
// future game exceeds that.
const eraColor = scaleOrdinal([
    "#8a6d3f", // bronze
    "#5c7154", // moss
    "#4e6e8c", // slate
    "#8c5a5a", // clay
    "#6e5c82", // dusty violet
    "#4e7d74", // pine
    "#9a7b4f", // ochre
    "#75757f", // pewter
    "#5b6b45", // olive
]);

/**
 * Render the wheel visualization using cached data.
 * Call this when the selection changes.
 */
export async function renderWheel() {
    var { game, tree, selected, svg, wheelData } = window.app;
    var iconFolder = (tree && tree.folder) || "technologies";
    const {
        allTechs,
        prerequisites,
        spokeData,
        squareData,
        circleData,
        labelRadius,
        techImgRadius,
        eraLabelRadius,
        eraRanges,
        arcSpace
    } = wheelData;
    const {
        highlightedIds,
        selectionPrerequisites,
        selectedSpokes,
        prerequisiteIds
    } = setupHighlights(allTechs);

  // Era layers — backgrounds sit behind everything (groups are drawn in
  // SVG paint order set by svgInit), labels render radially in the annulus
  // between the centre image and the icons. For games without era data,
  // eraRanges is empty and both selections exit-clear, leaving no era
  // visuals.
  drawEraBackgrounds(svg.eraBackgrounds, eraRanges, eraColor, labelRadius);
  // Era names fade alongside the unrelated techs while a tech is hovered,
  // so the highlighted prerequisite chain stands out against a quiet wheel.
  drawEraLabels(svg.eraLabels, eraRanges, eraColor, eraLabelRadius)
      .classed("fade", Boolean(selected));

  drawSpokes(svg.spokes, spokeData, allTechs.length, techImgRadius, arcSpace)
      .classed("fade", Boolean(selected));

  drawSpokes(svg.selectedSpokes, selectedSpokes, allTechs.length, techImgRadius, arcSpace);

  drawTechImages(svg.techImages, allTechs, game, highlightedIds, iconFolder, techImgRadius);
  drawTechLabels(svg.techLabels, allTechs, highlightedIds, labelRadius);

  drawArcs(svg.arcs, prerequisites, color, arcSpace)
      .classed("fade", Boolean(selected))
      .on("mouseover", (_, d) => {
          window.app.selected = d;
          showTooltip(d);
      })
      .on("mouseleave", () => {
          window.app.selected = null;
          hideTooltip();
      });

  if (Boolean(selected)) {
      drawArcs(svg.selectedArcs, selectionPrerequisites.filter(d => d.step !== undefined), color, arcSpace)
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
        ARC_BASE - 5 + arcSpace * d.step,
        ARC_BASE + 5 + arcSpace * d.step,
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
    .attr("transform", (d) => wheelTransform(allTechs.length, d.pos, ARC_BASE + arcSpace * d.step))
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
    .attr("transform", (d) => wheelTransform(allTechs.length, d.pos, ARC_BASE + arcSpace * d.step))
    .attr("fill", "#FFF")
    .attr("stroke", (d) => color(d.step));

  svg.centerImage
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
