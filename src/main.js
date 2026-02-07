import { select } from "d3-selection";

import { DEFAULT_GAME } from "./constants";
import { renderWheel } from "./makeWheel";
import svgInit from "./svgInit";

window.app = {
  game: DEFAULT_GAME,
  selected: null
};

window.app.svg = svgInit();

select("#select-expansion").on("change", () => {
  window.app.game = this.options[this.selectedIndex].value;
  renderWheel();
});

select("#tooltip").on("click", () => tooltip.classed("hidden", true));

renderWheel();

