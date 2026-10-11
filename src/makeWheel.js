import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";

import {
    drawArcs,
    drawSpokes,
    drawTechImages,
    drawTechLabels,
    drawUnlockCircles,
    drawUnlockPins,
    drawUnlockSquares,
    onNodeClick,
    onNodeHover,
    onNodeLeave,
} from "./drawTools";
import { drawEraBackgrounds, drawEraLabels } from "./drawEras";
import { setupHighlights } from "./setupHighlights";
import {
    animateSpokes,
    animateTechImages,
    animateTechLabels,
    fadeSwapCenterImage,
    fadeSwapLayer,
} from "./animateWheelSwitch";

// Exported so the mobile table view (makeTable.js) colours a given arc
// step identically — the two views are the same data drawn differently.
export const color = scaleOrdinal(schemeCategory10);
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
 *
 * `animate: true` is set only by initWheelData.js, only when a game/
 * expansion/tree switch just replaced `wheelData` with a new dataset (not
 * on the initial page load, and not on the ordinary hover/pin re-renders
 * that make up the vast majority of calls here). `selected`/`pinned`
 * usually are null on an animated call — initWheelData releases them
 * unless the pinned advance's id also exists in the new dataset — but
 * when a pin does survive, the animated branch below applies the same
 * `.fade`/highlight logic the non-animated path does, so the highlight
 * chain stays legible through the transition instead of popping back only
 * once it settles. See animateWheelSwitch.js for what that path actually
 * does; every other call takes the instant path below exactly as before.
 */
export async function renderWheel({ animate = false } = {}) {
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
        eraBackgroundRadius,
        eraRanges,
        arcSpace
    } = wheelData;
    const {
        highlightedIds,
        selectionPrerequisites,
        selectedSpokes,
        prerequisiteIds
    } = setupHighlights(allTechs);

  if (animate) {
      const count = allTechs.length;

      // `selected` (and `pinned`) can survive a switch now — initWheelData
      // carries a pinned advance over to its own copy in the new dataset
      // when the id still exists there — so this isn't always the "nothing
      // selected" case the rest of this branch used to assume. Every layer
      // below applies the exact same `.fade`/highlight logic the
      // non-animated path below uses, just layered onto the animated draw
      // calls, so a surviving pin's spoke, arc chain, and dimmed
      // surroundings stay correct and legible all through the transition
      // instead of popping back only once it ends.
      animateSpokes(svg.spokes, spokeData, count, techImgRadius, arcSpace, Boolean(selected));
      drawSpokes(svg.selectedSpokes, selectedSpokes, count, techImgRadius, arcSpace);

      animateTechImages(svg.techImages, allTechs, count, techImgRadius, game, iconFolder, highlightedIds);
      animateTechLabels(svg.techLabels, allTechs, count, labelRadius, highlightedIds);

      fadeSwapLayer(svg.arcs, "path", (g) => drawArcs(g, prerequisites, color, arcSpace)
          .classed("fade", Boolean(selected))
          .on("mouseover", onNodeHover)
          .on("mouseleave", onNodeLeave)
          .on("click", onNodeClick));
      fadeSwapLayer(svg.unlockPins, "path", (g) => drawUnlockPins(g, prerequisites, count, color, arcSpace)
          .classed("fade", (d) => Boolean(selected) && d.id !== selected.id && !prerequisiteIds.includes(d.id)));
      fadeSwapLayer(svg.unlockSquares, "rect", (g) => drawUnlockSquares(g, squareData, count, color, arcSpace)
          .classed("fade", (d) => Boolean(selected) && selected.id !== d.id && selected.id !== d.arcId));
      fadeSwapLayer(svg.unlockCircles, "circle", (g) => drawUnlockCircles(g, circleData, count, color, arcSpace)
          .classed("fade", (d) => Boolean(selected) && selected.id !== d.id && selected.id !== d.arcId));
      fadeSwapLayer(svg.eraBackgrounds, "path", (g) => drawEraBackgrounds(g, eraRanges, eraColor, eraBackgroundRadius));
      fadeSwapLayer(svg.eraLabels, "text", (g) => drawEraLabels(g, eraRanges, eraColor, eraLabelRadius)
          .classed("fade", Boolean(selected)));

      drawArcs(
          svg.selectedArcs,
          selected ? selectionPrerequisites.filter((d) => d.step !== undefined) : [],
          color,
          arcSpace
      );
      fadeSwapCenterImage(svg.centerImage, `${game}/img/${game}-center.png`);
      return;
  }

  // Era layers — backgrounds sit behind everything (groups are drawn in
  // SVG paint order set by svgInit), labels render radially in the annulus
  // between the centre image and the icons. For games without era data,
  // eraRanges is empty and both selections exit-clear, leaving no era
  // visuals.
  drawEraBackgrounds(svg.eraBackgrounds, eraRanges, eraColor, eraBackgroundRadius);
  // Era names fade alongside the unrelated techs while a tech is hovered,
  // so the highlighted prerequisite chain stands out against a quiet wheel.
  drawEraLabels(svg.eraLabels, eraRanges, eraColor, eraLabelRadius)
      .classed("fade", Boolean(selected));

  drawSpokes(svg.spokes, spokeData, allTechs.length, techImgRadius, arcSpace)
      .classed("fade", Boolean(selected));

  drawSpokes(svg.selectedSpokes, selectedSpokes, allTechs.length, techImgRadius, arcSpace);

  drawTechImages(svg.techImages, allTechs, game, highlightedIds, iconFolder, techImgRadius);
  drawTechLabels(svg.techLabels, allTechs, highlightedIds, labelRadius);

  // Arcs share the node handlers so hovering or clicking an arc behaves
  // exactly like hovering or clicking its origin tech.
  drawArcs(svg.arcs, prerequisites, color, arcSpace)
      .classed("fade", Boolean(selected))
      .on("mouseover", onNodeHover)
      .on("mouseleave", onNodeLeave)
      .on("click", onNodeClick);

  // Always join the highlight arcs — with an empty array when nothing is
  // selected — so the previous hover's paths exit-clear. Drawing this layer
  // conditionally used to leave stale paths behind on mouseleave; invisible
  // while they coincided with the base arcs, but plainly wrong once a game
  // switch rebuilt the base arcs underneath them.
  drawArcs(
      svg.selectedArcs,
      selected ? selectionPrerequisites.filter(d => d.step !== undefined) : [],
      color,
      arcSpace
  );

  drawUnlockPins(svg.unlockPins, prerequisites, spokeData.length, color, arcSpace)
      .classed("fade", (d) => Boolean(selected) && d.id !== selected.id && !prerequisiteIds.includes(d.id));

  drawUnlockSquares(svg.unlockSquares, squareData, allTechs.length, color, arcSpace)
      .classed("fade", (d) => Boolean(selected) && selected.id !== d.id && selected.id !== d.arcId);

  drawUnlockCircles(svg.unlockCircles, circleData, allTechs.length, color, arcSpace)
      .classed("fade", (d) => Boolean(selected) && selected.id !== d.id && selected.id !== d.arcId);

  svg.centerImage
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
