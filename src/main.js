import { select, selectAll } from "d3-selection";

import { DEFAULT_GAME, GAMES } from "./constants";
import { initWheelData } from "./initWheelData";
import { updateEraIndicator } from "./makeTable";
import { isTableView, renderActiveView } from "./renderView";
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
// propagation before reaching the SVG), the table's lane gutter, or the
// tooltip's close button. All clear the highlight state entirely; on a
// device with a pointer, hover takes over again.
//
// Dismisses whatever is showing, pinned or not. This used to return early
// unless something was pinned, which made the close button dead in the one
// state where it's the only way out: a tooltip opened by a hover with no
// pin behind it. Touch devices produce exactly that state (see hoverQuery
// in drawTools), so on a phone the button did nothing at all.
function releasePin() {
    if (!window.app.pinned && !window.app.selected) return;
    window.app.pinned = null;
    window.app.selected = null;
    hideTooltip();
}

select("#chart svg").on("click", releasePin);
select("#tipCloseButton").on("click", releasePin);
// The table's equivalent of empty wheel space: the lane gutter left of
// the names. Rows stop propagation, so only a miss reaches this.
select("#table").on("click", releasePin);

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

// Sticky toolbar. Once the page scrolls past #select-wrap the panel pins
// to the top of the viewport (.stuck); scrolling back returns it to the
// flow. On a wide screen it also collapses to the slim bar at that moment
// (.compact) and expands again on the way back; on a narrow one it is
// compact throughout, so pinning is the only thing that changes. Two
// details keep this stable:
//   - The check reads the WRAPPER's position (a pinned panel never leaves
//     the viewport, so its own rect can't signal anything) from scroll and
//     resize listeners rather than an IntersectionObserver — jump scrolls
//     (End key, anchors, restored positions) can move the wrapper from
//     below the viewport to above it without ever intersecting, which an
//     observer reports as no change at all.
//   - The wrapper's height is frozen at whatever the panel measured just
//     before it left the flow. Otherwise the document would shrink, the
//     browser would clamp the scroll position back, and near the bottom of
//     the page the panel would flip-flop between states.
const selectWrap = document.querySelector("#select-wrap");
const selectOptions = document.querySelector("#select-options");
if (selectWrap && selectOptions) {
    const updateCompact = () => {
        const stuck = selectWrap.getBoundingClientRect().top < 0;
        // Freeze the space the bar occupies *before* taking it out of
        // flow — whatever height it happens to have, which is the compact
        // one on a phone and the expanded one on a wide screen. Keying
        // this off .compact instead was what left the gap on mobile:
        // reserving the tall version's height for a short pinned bar.
        if (stuck && !selectOptions.classList.contains("stuck")) {
            selectWrap.style.height = `${selectWrap.offsetHeight}px`;
        }
        selectOptions.classList.toggle("stuck", stuck);
        // Narrow screens keep the compact look at every scroll position;
        // wide ones adopt it only while pinned.
        selectOptions.classList.toggle("compact", stuck || isTableView());
        if (!stuck) {
            selectWrap.style.height = "";
        }
        // The table's era indicator parks against the bar's bottom edge,
        // which just moved. It has its own scroll listener, but this one
        // is what changed the geometry — update from here so the two never
        // disagree for a frame.
        updateEraIndicator();
    };
    // Coalesced to one pass per frame. iOS delivers scroll events during
    // momentum faster than it paints, and this handler reads a rect and
    // may write a height and two classes — run per event, those reads and
    // writes interleave into repeated forced layouts of the whole table.
    let frame = 0;
    const scheduleCompact = () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            updateCompact();
        });
    };
    window.addEventListener("scroll", scheduleCompact, { passive: true });
    window.addEventListener("resize", scheduleCompact);
    updateCompact();
}

initWheelData();

