import { select } from "d3-selection";

import { DEFAULT_GAME } from "./constants";
import { initWheelData } from "./initWheelData";
import { renderWheel } from "./makeWheel";
import svgInit from "./svgInit";

window.app = {
  game: DEFAULT_GAME,
  _selected: null
};

// Auto-render when selected changes
Object.defineProperty(window.app, 'selected', {
  get() { return window.app._selected; },
  set(value) {
    window.app._selected = value;
    if (window.app.wheelData) renderWheel();
  }
});

window.app.svg = svgInit();

select("#select-expansion").on("change", () => {
  window.app.game = this.options[this.selectedIndex].value;
  initWheelData();
});

select("#tooltip").on("click", () => tooltip.classed("hidden", true));

initWheelData();

