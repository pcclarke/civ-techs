import { select } from "d3-selection";

import {
  CENTER_X,
  CENTER_Y,
  MARGIN_LEFT,
  MARGIN_TOP,
  TOTAL_WIDTH,
  TOTAL_HEIGHT
} from "./constants";

export default function() {
    let groupObj = {};

    groupObj.wheel = select("#chart")
        .append("svg")
        .attr("class", "civ-techs")
        .attr("width", TOTAL_WIDTH)
        .attr("height", TOTAL_HEIGHT)
        .append("g")
        .attr("class", "wheel")
        .attr("transform", `translate(${MARGIN_LEFT + CENTER_X}, ${MARGIN_TOP + CENTER_Y})`);

    // pie "slice" to indicate start of spokes
    groupObj.wheel
        .append("image")
        .attr("class", "start-slice")
        .attr("x", 0)
        .attr("y", -CENTER_Y)
        .attr("width", 167)
        .attr("height", CENTER_Y)
        .attr("xlink:href", "img/startSlice.png");

    // SVG groups to organize shapes
    var shapeGroups = [
        { prop: "spokes", class: "spokes" },
        { prop: "selectedSpokes", class: "selected-spokes" },
        { prop: "techImages", class: "tech-images" },
        { prop: "techLabels", class: "tech-labels" },
        { prop: "arcs", class: "arcs" },
        { prop: "selectedArcs", class: "selected-arcs" },
        { prop: "unlockPins", class: "unlock-pins" },
        { prop: "unlockSquares", class: "unlock-squares" },
        { prop: "unlockCircles", class: "unlock-circles" }
    ];

    for (const group of shapeGroups) {
        let svgGroup = groupObj.wheel.append("g")
            .attr("class", group.class);

        groupObj[group.prop] = svgGroup;
    }

    // Civ game image center of wheel
    groupObj.centerImage = groupObj.wheel.append("image")
        .attr("x", -75)
        .attr("y", -75)
        .attr("width", 150)
        .attr("height", 150);

    return groupObj;
}
