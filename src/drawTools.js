import { ARC_BASE, ARC_SPACE } from "./constants";
import { unlockArc } from "./arcs";
import { calculateSingleRadialLinePath } from "./helpers";

export function drawArcs(element, data, color) {
      return element
          .selectAll("path")
          .data(data)
          .join("path")
          .attr("d", (d) => unlockArc(d))
          .attr("fill", (d) => color(d.step));
}

export function drawSpokes(element, spokeData, length) {
    return element.selectAll(".spoke-line")
        .data(spokeData)
        .join("path")
        .attr("class", "spoke-line")
        .attr("d", (d) => 
            calculateSingleRadialLinePath(
                length,
                ARC_BASE + ARC_SPACE * d.step,
                420,
                d.position
            )
        );
}


