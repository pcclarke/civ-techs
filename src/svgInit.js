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
  var wheel = select("#chart")
    .append("svg")
    .attr("class", "civ-techs")
    .attr("width", TOTAL_WIDTH)
    .attr("height", TOTAL_HEIGHT)
    .append("g")
    .attr("class", "wheel")
    .attr("transform", `translate(${MARGIN_LEFT + CENTER_X}, ${MARGIN_TOP + CENTER_Y})`);

  // pie "slice" to indicate start of spokes
  wheel
    .append("image")
    .attr("class", "start-slice")
    .attr("x", 0)
    .attr("y", -CENTER_Y)
    .attr("width", 167)
    .attr("height", CENTER_Y)
    .attr("xlink:href", "img/startSlice.png");

  var spokes = wheel.append("g")
    .attr("class", "spokes");

  var techImages = wheel.append("g")
    .attr("class", "tech-images");
  
  var arcs = wheel.append("g")
    .attr("class", "arcs");

  var unlockPins = wheel.append("g")
    .attr("class", "unlock-pins");

  var unlockSquares = wheel.append("g")
    .attr("class", "unlock-squares");

  var unlockCircles = wheel.append("g")
    .attr("class", "unlock-circles");

  var centerImage = wheel.append("image")
    .attr("x", -75)
    .attr("y", -75)
    .attr("width", 150)
    .attr("height", 150);

  return {
    arcs: arcs,
    centerImage: centerImage,
    spokes: spokes,
    techImages: techImages,
    unlockCircles: unlockCircles,
    unlockPins: unlockPins,
    unlockSquares: unlockSquares,
    wheel: wheel
  };
}
