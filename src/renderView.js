import { refreshWheelLayout } from "./computeWheelLayout";
import { renderTable, updateEraIndicator } from "./makeTable";
import { renderWheel } from "./makeWheel";
import { showTooltip } from "./tooltip";

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
 *
 * This is also where the OS "reduce motion" preference is honoured, since
 * every animated render in the app is reached through renderActiveView.
 */

/** Below this width the wheel's labels are too small to read (~4.8px at
 *  375px), so the table takes over. Keep in sync with techs.css. */
const TABLE_BREAKPOINT = 700;

const tableQuery = window.matchMedia(`(max-width: ${TABLE_BREAKPOINT - 1}px)`);

export function isTableView() {
    return tableQuery.matches;
}

const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

/**
 * Whether the user has asked the OS to reduce motion.
 *
 * Read live rather than cached, for the same reason hoverQuery in
 * drawTools.js is: the setting can change under a running page, and each
 * read is one boolean off an existing MediaQueryList.
 *
 * Gated here rather than inside the individual animators so there is one
 * place to get right. Everything the switch animations do — the wheel's
 * rotation, the table's row slides, the era wedge morph, the arc layer's
 * travel in both views — hangs off the `animate` flag that
 * renderActiveView computes below, so suppressing it there suppresses all
 * of them. The CSS-driven hover dimming is the one piece of motion that
 * doesn't route through here; techs.css turns that off under the same
 * media query.
 *
 * Note what reduced motion does *not* do: it never removes a state or a
 * cue. Highlights still dim, pins still hold, eras still tint, the wheel
 * still rebuilds for the new game — all of it just arrives at the final
 * frame directly instead of travelling there.
 */
export function prefersReducedMotion() {
    return motionQuery.matches;
}

/** Which view the last render drew, so a breakpoint crossing can be told
 *  apart from an ordinary re-render (hover, pin, game switch). */
let lastWasTable = null;

export function renderActiveView({ animate = false } = {}) {
    const table = isTableView();
    const switched = lastWasTable !== null && lastWasTable !== table;
    lastWasTable = table;

    // Two reasons to render instantly even when the caller asked for an
    // animation (only initWheelData.js ever does): a breakpoint crossing
    // has nothing to animate *from*, since neither view was visible a
    // moment ago; and the user may have asked the OS for reduced motion.
    const shouldAnimate = animate && !switched && !prefersReducedMotion();

    if (table) {
        renderTable({ animate: shouldAnimate });
    } else {
        // The wheel's radii come from measuring label widths, which reads
        // as zero while the wheel is display:none — so any layout computed
        // while the table was showing is garbage. Re-measure on the way in.
        if (switched) refreshWheelLayout();
        renderWheel({ animate: shouldAnimate });
        // The era indicator belongs to the table; it's position:fixed, so
        // nothing else takes it off screen when the wheel takes over.
        updateEraIndicator();
    }

    // The two views place the tooltip completely differently — bottom
    // sheet vs. antipodal box — and the placement is written when it's
    // shown. Rotating a phone with a pinned advance would otherwise leave
    // the panel sized for the view it just left.
    if (switched && window.app.pinned) showTooltip(window.app.pinned);
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
