import { select, selectAll } from "d3-selection";

import { DEFAULT_GAME, GAMES } from "./constants";
import { initWheelData } from "./initWheelData";
import { renderActiveView } from "./renderView";
import svgInit from "./svgInit";
import { hideTooltip } from "./tooltip";

let gameInfo = DEFAULT_GAME;

window.app = {
  game: gameInfo.id,
  // Tree picker (Civ 6 and 7). Always populated so downstream code can read
  // it unconditionally; defaults match the legacy single-tree-per-game shape.
  tree: (gameInfo.trees && gameInfo.trees[0]) || { id: "tech", folder: "technologies", dataKey: "technologies" },
  _selected: null,
  // Click-to-pin: while set, `selected` is locked to this tech and hover
  // previews are inert (see onNodeHover/onNodeClick in drawTools).
  pinned: null
};

// Auto-render when selected changes
Object.defineProperty(window.app, 'selected', {
  get() { return window.app._selected; },
  set(value) {
    window.app._selected = value;
    if (window.app.wheelData) renderActiveView();
  }
});

window.app.svg = svgInit();

// Releasing a pin: clicking empty wheel space (node/arc clicks stop
// propagation before reaching the SVG) or the tooltip's close button.
// Both clear the highlight state entirely; hover takes over again.
function releasePin() {
    if (!window.app.pinned) return;
    window.app.pinned = null;
    window.app.selected = null;
    hideTooltip();
}

select("#chart svg").on("click", releasePin);
select("#tipCloseButton").on("click", releasePin);

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

// Sticky toolbar: #select-options is position:sticky inside #select-wrap,
// so once the page scrolls past the wrapper's top the panel pins to the
// viewport and .compact collapses it into a slim toolbar; scrolling back
// restores the full panel. Two details keep this stable:
//   - The check reads the WRAPPER's position (a pinned panel never leaves
//     the viewport, so its own rect can't signal anything) from scroll and
//     resize listeners rather than an IntersectionObserver — jump scrolls
//     (End key, anchors, restored positions) can move the wrapper from
//     below the viewport to above it without ever intersecting, which an
//     observer reports as no change at all.
//   - The wrapper's height is frozen at the panel's expanded size while
//     pinned. Otherwise compacting would shrink the document, the browser
//     would clamp the scroll position back, and near the bottom of the
//     page the panel would flip-flop between states.
const selectWrap = document.querySelector("#select-wrap");
const selectOptions = document.querySelector("#select-options");
if (selectWrap && selectOptions) {
    const updateCompact = () => {
        const stuck = selectWrap.getBoundingClientRect().top < 0;
        if (stuck && !selectOptions.classList.contains("compact")) {
            selectWrap.style.height = `${selectWrap.offsetHeight}px`;
        }
        selectOptions.classList.toggle("compact", stuck);
        if (!stuck) {
            selectWrap.style.height = "";
        }
    };
    window.addEventListener("scroll", updateCompact, { passive: true });
    window.addEventListener("resize", updateCompact);
    updateCompact();
}

initWheelData();

