import { ARC_BASE, ARC_SPACE, TECH_IMG_RADIUS, TECH_IMG_WIDTH } from "./constants";
import { makeUnlockArc } from "./arcs";
import { calculateSingleRadialLinePath, wheelTransform, fadeCheck } from "./helpers";
import { hideTooltip, showTooltip } from "./tooltip";

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
        .attr("d", (d) => {
            // Techs with no prerequisites have no inner arc to start from
            // (setupSpokes marks them with a negative sentinel step). Run their
            // spoke from the chart center so it sits underneath the game image.
            const innerRadius = d.step >= 0
                ? ARC_BASE + arcSpace * d.step
                : 0;
            return calculateSingleRadialLinePath(
                length,
                innerRadius,
                techImgRadius,
                d.position
            );
        });
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
        .on("mouseover", onNodeHover)
        .on("mouseleave", onNodeLeave)
        .on("click", onNodeClick);
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
        .text(d => d.name)
        // Labels share the same hover behaviour as the icons: pointing at
        // either side of the same node should activate it. Keep the cursor
        // styling here in sync with .tech-image (.spokeText already sets
        // cursor: pointer in CSS).
        .on("mouseover", onNodeHover)
        .on("mouseleave", onNodeLeave)
        .on("click", onNodeClick);
}

/** Shared hover handler (also used for arcs — see makeWheel). Setting
 *  `selected` triggers the wheel re-render that draws the arcs; the
 *  tooltip lives outside the SVG paint hierarchy and is updated
 *  independently. While a node is pinned, hover is inert: previews would
 *  rip the pinned tooltip away as the pointer crosses the wheel (e.g. on
 *  its way to the tooltip's close button), which defeats the pin. */
export function onNodeHover(_, d) {
    if (window.app.pinned) return;
    window.app.selected = d;
    showTooltip(d);
}

export function onNodeLeave() {
    if (window.app.pinned) return;
    window.app.selected = null;
    hideTooltip();
}

/** Click pins the node so its highlight and tooltip survive mouseleave.
 *  Clicking the pinned node again releases it (hover keeps working from
 *  that position); clicking any other node moves the pin there directly.
 *  stopPropagation keeps the click from reaching the SVG background,
 *  whose own handler releases the pin. */
export function onNodeClick(event, d) {
    event.stopPropagation();
    const { pinned } = window.app;
    window.app.pinned = pinned && pinned.id === d.id ? null : d;
    window.app.selected = d;
    showTooltip(d);
}



