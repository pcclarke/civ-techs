import { select, selectAll } from "d3-selection";

import { bindDismissals, createApp, setupStickyToolbar } from "./appShell";
import { DEFAULT_GAME, GAMES } from "./constants";
import { initWheelData } from "./initWheelData";
import svgInit from "./svgInit";

let gameInfo = DEFAULT_GAME;

// Page wiring lives in appShell.js so the browser checks run the same
// code rather than copies of it — see that module's doc comment.
createApp({
  game: gameInfo.id,
  // Tree picker (Civ 6 and 7). Always populated so downstream code can read
  // it unconditionally; defaults match the legacy single-tree-per-game shape.
  tree: (gameInfo.trees && gameInfo.trees[0]) || { id: "tech", folder: "technologies", dataKey: "technologies" },
  // Click-to-pin: while set, `selected` is locked to this tech and hover
  // previews are inert (see onNodeHover/onNodeClick in drawTools).
  pinned: null,
});

window.app.svg = svgInit();
bindDismissals();

const expansion = select("#expansion");
const selectExpansion = select("#select-expansion");
addExpansions();

const tree = select("#tree");
const selectTree = select("#select-tree");

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

// Expansion and tree pickers render as pill buttons. Each render marks the
// active pill from window.app state, and a click updates that state, then
// re-renders the pills (for the active highlight) before reloading the
// wheel — same flow the old <select> change handlers had, one click shorter.
function addExpansions() {
    expansion.classed("hidden", false)
    selectExpansion
        .selectAll("button")
        .data([{ name: "Base game", id: gameInfo.id }, ...gameInfo.expansions])
        .join("button")
        .attr("type", "button")
        .attr("class", "pill")
        .classed("active", d => d.id == window.app.game)
        .text(d => d.name)
        .on("click", (_, d) => {
            if (window.app.game == d.id) return;
            window.app.game = d.id;
            addExpansions();
            initWheelData();
        });
}

function hideExpansions() {
    expansion.classed("hidden", true);
}

function addTrees() {
    tree.classed("hidden", false);
    selectTree
        .selectAll("button")
        .data(gameInfo.trees)
        .join("button")
        .attr("type", "button")
        .attr("class", "pill")
        .classed("active", d => d.id == window.app.tree.id)
        .text(d => d.name)
        .on("click", (_, d) => {
            if (window.app.tree.id == d.id) return;
            window.app.tree = gameInfo.trees.find(t => t.id == d.id);
            addTrees();
            initWheelData();
        });
}

function hideTrees() {
    tree.classed("hidden", true);
}

// Initial render: if the default game has trees, populate the toggle.
if (gameInfo.trees && gameInfo.trees.length > 1) {
    addTrees();
}

setupStickyToolbar();

initWheelData();

