import { select, selectAll } from "d3-selection";

import { DEFAULT_GAME, GAMES } from "./constants";
import { initWheelData } from "./initWheelData";
import { renderWheel } from "./makeWheel";
import svgInit from "./svgInit";

let gameInfo = DEFAULT_GAME;

window.app = {
  game: gameInfo.id,
  // Tree picker (Civ 6 only). Always populated so downstream code can read
  // it unconditionally; defaults match the legacy single-tree-per-game shape.
  tree: (gameInfo.trees && gameInfo.trees[0]) || { id: "tech", folder: "technologies", dataKey: "technologies" },
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

const tree = select("#tree");
const selectTree = select("#select-tree")
    .on("change", function() {
        const id = this.options[this.selectedIndex].value;
        window.app.tree = gameInfo.trees.find(t => t.id == id);
        initWheelData();
    });

selectAll("input[name='game']").on("change", (e) => {
    gameInfo = GAMES.find(g => g.id == e.target.value);
    window.app.game = gameInfo.id;
    // Reset tree to the game's first tree (or the legacy single-tree default).
    window.app.tree = (gameInfo.trees && gameInfo.trees[0])
        || { id: "tech", folder: "technologies", dataKey: "technologies" };

    if (gameInfo.expansions && gameInfo.expansions.length) {
        addExpansions();
    } else {
        hideExpansions();
    }
    if (gameInfo.trees && gameInfo.trees.length > 1) {
        addTrees();
    } else {
        hideTrees();
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

function addTrees() {
    tree.classed("hidden", false);
    selectTree
        .selectAll("option")
        .data(gameInfo.trees)
        .join("option")
        .attr("value", d => d.id)
        .text(d => d.name)
        .property("selected", d => d.id == window.app.tree.id);
}

function hideTrees() {
    tree.classed("hidden", true);
}

// Initial render: if the default game has trees, populate the toggle.
if (gameInfo.trees && gameInfo.trees.length > 1) {
    addTrees();
}

select("#tooltip").on("click", () => tooltip.classed("hidden", true));

initWheelData();

