import { refreshWheelLayout } from "./computeWheelLayout";
import { renderTable } from "./makeTable";
import { renderWheel } from "./makeWheel";

/**
 * Picks between the two renderings of the wheel data: the circular wheel
 * on wide screens, the vertical table on narrow ones.
 *
 * Everything upstream — data loading, sorting, arc packing, highlight and
 * pin state — is shared. Only the drawing differs, so this module is the
 * single place that knows which view is live. Callers that used to invoke
 * renderWheel() directly call renderActiveView() instead.
 *
 * The breakpoint matches the CSS rule in techs.css; the media query is the
 * one source of truth for the switch, and only the visible view is drawn
 * so the hidden one costs nothing.
 */

/** Below this width the wheel's labels are too small to read (~4.8px at
 *  375px), so the table takes over. Keep in sync with techs.css. */
export const TABLE_BREAKPOINT = 700;

const tableQuery = window.matchMedia(`(max-width: ${TABLE_BREAKPOINT - 1}px)`);

export function isTableView() {
    return tableQuery.matches;
}

/** Which view the last render drew, so a breakpoint crossing can be told
 *  apart from an ordinary re-render (hover, pin, game switch). */
let lastWasTable = null;

export function renderActiveView() {
    const table = isTableView();
    const switched = lastWasTable !== null && lastWasTable !== table;
    lastWasTable = table;

    if (table) {
        renderTable();
        return;
    }
    // The wheel's radii come from measuring label widths, which reads as
    // zero while the wheel is display:none — so any layout computed while
    // the table was showing is garbage. Re-measure on the way in.
    if (switched) refreshWheelLayout();
    renderWheel();
}

// Crossing the breakpoint (rotating a phone, resizing a window) has to
// redraw, because the newly-visible view has never been rendered — or was
// rendered against a stale selection. `resize` is a belt-and-braces
// companion to the media query: both are cheap, and renderActiveView is
// idempotent, so a duplicate call costs only a redraw.
const onViewportChange = () => {
    if (window.app && window.app.wheelData) renderActiveView();
};
tableQuery.addEventListener("change", onViewportChange);
window.addEventListener("resize", onViewportChange);
