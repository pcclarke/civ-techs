import { ARC_BASE, ARC_SPACE } from "./constants";
import { calculateSingleRadialLinePath } from "./helpers";

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

