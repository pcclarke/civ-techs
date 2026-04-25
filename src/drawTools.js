import { ARC_BASE, ARC_SPACE, TECH_IMG_RADIUS, TECH_IMG_WIDTH } from "./constants";
import { makeUnlockArc } from "./arcs";
import { calculateSingleRadialLinePath, wheelTransform, fadeCheck } from "./helpers";

export function drawArcs(element, data, color, arcSpace = ARC_SPACE) {
      const unlockArc = makeUnlockArc(arcSpace);
      return element
          .selectAll("path")
          .data(data)
          .join("path")
          .attr("d", (d) => unlockArc(d))
          .attr("fill", (d) => color(d.step));
}

export function drawSpokes(element, spokeData, length, techImgRadius = TECH_IMG_RADIUS, arcSpace = ARC_SPACE) {
    return element.selectAll(".spoke-line")
        .data(spokeData)
        .join("path")
        .attr("class", "spoke-line")
        .attr("d", (d) =>
            calculateSingleRadialLinePath(
                length,
                ARC_BASE + arcSpace * d.step,
                techImgRadius,
                d.position
            )
        );
}

export function drawTechImages(element, allTechs, game, highlightedIds, folder = "technologies", techImgRadius = TECH_IMG_RADIUS) {
    return element
        .selectAll(".tech-image")
        .data(allTechs)
        .join("image")
        .attr("class", "tech-image")
        .classed("fade", (d) => fadeCheck(d, highlightedIds))
        .attr("transform", (_, i) => wheelTransform(allTechs.length, i, techImgRadius))
        .attr("height", TECH_IMG_WIDTH)
        .attr("width", TECH_IMG_WIDTH)
        .attr("x", -TECH_IMG_WIDTH / 2)
        .attr("y", -TECH_IMG_WIDTH / 2)
        .attr("xlink:href", (d) => `${game}/img/${folder}/${d.id}.png`)
        .on("mouseover", (_, d) => window.app.selected = d)
        .on("mouseleave", () => window.app.selected = null);
}

export function drawTechLabels(element, allTechs, highlightedIds, labelRadius) {
    return element
        .selectAll("text")
        .data(allTechs)
        .join("text")
        .classed("fade", (d) => fadeCheck(d, highlightedIds))
        .attr("transform", (_, i) => wheelTransform(allTechs.length, i, labelRadius))
        .attr("y", 5)
        .attr("text-anchor", (_, i) => (i > allTechs.length / 2) ? "end" : "start")
        .text(d => d.name);
}



