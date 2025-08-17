import { pointer, select, selectAll } from "d3-selection";

import makeWheel from "./makeWheel";
import svgInit from "./svgInit";

window.app = {
  game: "civ4bts"
};

// select("body")
//  .on("mousemove", (e) => (wheelState.coords = pointer(e)))
//  .on("mousedown", (e) => (wheelState.coords = pointer(e)));

// const tooltip = select("#tooltip");

window.app.svg = svgInit();

select("#select-expansion").on("change", function () {
  window.app.game = this.options[this.selectedIndex].value;
  makeWheel();
});

select("#tooltip").on("click", () => tooltip.classed("hidden", true));

makeWheel();
