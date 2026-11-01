import { select } from "d3-selection";

import { onSheetLeave, releasePin } from "./drawTools";
import { updateEraIndicator } from "./makeTable";
import { isTableView, renderActiveView } from "./renderView";

/**
 * The page-level wiring main.js used to do inline, split out so the
 * browser checks can run the same code instead of copies of it.
 *
 * That was the problem this solves. The check harness (scripts/
 * browser-checks/) replaces main.js — it can't run the data fetch — so
 * anything main.js wired up simply wasn't there under test unless the
 * harness duplicated it by hand. It did, twice, and each time only after
 * a confusing failure: the `selected` accessor (without it, checks read a
 * DOM that never re-rendered) and the sheet's leave/close bindings
 * (without them, the sheet had no listener at all). A copy can also
 * silently drift from the original. Now both call these.
 *
 * What stays in main.js is what genuinely can't run under the harness:
 * the game/expansion/tree pickers, which drive initWheelData's fetch.
 */

/**
 * Create `window.app` from `fields`, with `selected` as an accessor that
 * re-renders the live view on every assignment. That re-render is how a
 * selection reaches the DOM — hover, focus and click all just assign it —
 * so a plain property would leave every highlight, tabindex and
 * aria-selected stale. `_selected` is the backing field; code that must
 * set the selection *without* a render (initWheelData carrying a pin
 * across a switch, ahead of its own render) writes it directly.
 */
export function createApp(fields) {
    const app = { _selected: null, pinned: null, ...fields };
    Object.defineProperty(app, "selected", {
        get() { return app._selected; },
        set(value) {
            app._selected = value;
            if (app.wheelData) renderActiveView();
        },
    });
    window.app = app;
    return app;
}

/**
 * Bind the things that mean "I'm done" with a pin or preview.
 *
 * Releasing a pin: clicking empty wheel space (icon and label clicks stop
 * propagation before reaching the SVG; arcs take no pointer events), the
 * table's lane gutter, or the tooltip's close button. Escape does the same
 * from the keyboard — see keyboardNav.js. releasePin itself lives in
 * drawTools.js so both paths share one implementation.
 *
 * Call after the wheel's SVG exists, and again if it's ever rebuilt: the
 * wheel's binding is on the SVG element itself. Safe to repeat — d3's
 * .on replaces a listener rather than adding a second.
 */
export function bindDismissals() {
    select("#chart svg").on("click", releasePin);
    select("#tipCloseButton").on("click", releasePin);
    // A hover preview in the sheet view lasts until the pointer leaves the
    // sheet (see onSheetLeave). Bound on the tooltip itself: the wheel's
    // box never receives pointer events, so this only ever fires for the
    // sheet.
    select("#tooltip").on("mouseleave", onSheetLeave);
    // The table's equivalent of empty wheel space: the lane gutter left of
    // the names. Rows stop propagation, so only a miss reaches this.
    select("#table").on("click", releasePin);
}

let stickyUpdate = null;

/**
 * Sticky toolbar. Once the page scrolls past #select-wrap the panel pins
 * to the top of the viewport (.stuck); scrolling back returns it to the
 * flow. On a wide screen it also collapses to the slim bar at that moment
 * (.compact) and expands again on the way back; on a narrow one it is
 * compact throughout, so pinning is the only thing that changes. Two
 * details keep this stable:
 *   - The check reads the WRAPPER's position (a pinned panel never leaves
 *     the viewport, so its own rect can't signal anything) from scroll and
 *     resize listeners rather than an IntersectionObserver — jump scrolls
 *     (End key, anchors, restored positions) can move the wrapper from
 *     below the viewport to above it without ever intersecting, which an
 *     observer reports as no change at all.
 *   - The wrapper's height is frozen at whatever the panel measured just
 *     before it left the flow. Otherwise the document would shrink, the
 *     browser would clamp the scroll position back, and near the bottom of
 *     the page the panel would flip-flop between states.
 *
 * Installs its listeners once, however often it's called, and returns the
 * synchronous update so a caller can settle the state without waiting a
 * frame.
 */
export function setupStickyToolbar() {
    if (stickyUpdate) return stickyUpdate;
    const selectWrap = document.querySelector("#select-wrap");
    const selectOptions = document.querySelector("#select-options");
    if (!selectWrap || !selectOptions) return () => {};

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
    stickyUpdate = updateCompact;
    return updateCompact;
}
