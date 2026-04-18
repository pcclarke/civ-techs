import { select, selectAll } from "d3-selection";

import { DEFAULT_GAME, GAMES } from "./constants";
import { initWheelData } from "./initWheelData";
import { renderWheel } from "./makeWheel";
import svgInit from "./svgInit";

let gameInfo = DEFAULT_GAME;

window.app = {
  game: gameInfo.id,
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

const expansion = select("#expansion");
const selectExpansion = select("#select-expansion")
    .on("change", function() {
        console.log(this.options[this.selectedIndex].value);
        window.app.game = this.options[this.selectedIndex].value;
        initWheelData();
    });
addExpansions();

selectAll("input[name='game']").on("change", (e) => {
    gameInfo = GAMES.find(g => g.id == e.target.value);
    window.app.game = gameInfo.id;
    if (gameInfo.id != "civ1" && gameInfo.id != "civ2") {
        addExpansions();
    } else {
        hideExpansions();
    }
    initWheelData();
});

function addExpansions() {
    expansion.classed("hidden", false)
    selectExpansion
        .selectAll("option")
        .data([{ name: "Base game", id: gameInfo.id }, ...gameInfo.expansions])
        .join("option")
        .attr("value", d => d.id)
        .text(d => d.name)
        .property("selected", d => d.id == gameInfo.id);
}

function hideExpansions() {
    expansion.classed("hidden", true);
}

select("#tooltip").on("click", () => tooltip.classed("hidden", true));

initWheelData();

