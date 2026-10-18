import { onNodeClick, releasePin } from "./drawTools";
import { showTooltip } from "./tooltip";

/**
 * Keyboard navigation of the advances, shared by both views.
 *
 * Until this existed, the advances — the entire content of the thing —
 * were reachable only by mouse or touch. The game tabs, the
 * expansion/tree pills and the tooltip's close button are real form
 * controls and were always focusable, so a keyboard user could change
 * which tree was displayed but could not inspect a single advance in it.
 *
 * ## One tab stop, not ninety-two
 *
 * The obvious implementation — `tabindex="0"` on every advance — would
 * make Tab useless: ninety-two presses to get past the chart on Civ 4
 * BTS. This is the ARIA composite-widget pattern instead, a *roving*
 * tabindex: the layer holds exactly one tab stop, and the arrow keys move
 * it. Tab enters the chart and Tab leaves it.
 *
 * `tabStopId` is which advance currently holds it. It has to survive the
 * re-render every hover triggers, so it lives here as an id rather than a
 * node reference — but only within one dataset: a game switch reseeds it,
 * for the reasons documented on resolveStop.
 *
 * ## Focus implies selection
 *
 * Arriving on an advance sets `window.app.selected`, which is what hover
 * does — so the highlight chain lights up and the tooltip fills in. Note
 * this deliberately ignores `pinned`, where hover does not: onNodeHover
 * bails while something is pinned because the pointer crosses the wheel
 * on its way to the close button and would rip the panel away. A keyboard
 * has no such accidental travel — every arrival is deliberate — so
 * arrowing while pinned moves the preview rather than doing nothing.
 *
 * Enter and Space pin, through the very same onNodeClick the mouse uses.
 * Escape releases, through the same releasePin the close button uses.
 *
 * ## Clamped, not wrapping
 *
 * Arrowing past either end stops there. The wheel is a ring and could
 * wrap, but `role="listbox"` sets the expectation that it will not, and
 * both views render one ordered list, so they behave alike.
 */

/** Id of the advance holding the layer's single tab stop. */
let tabStopId = null;

function orderedTechs() {
    const wd = window.app && window.app.wheelData;
    return (wd && wd.allTechs) || [];
}

/**
 * The advance that should carry `tabindex="0"`.
 *
 * Two jobs. Within one dataset it just reports `tabStopId`, so the stop
 * survives the re-render every hover triggers. When the dataset is
 * *replaced* it reseeds: to the advance initWheelData carried the pin
 * over to if there was one, so the stop agrees with the advance the
 * tooltip is still showing, and otherwise to the first advance of the new
 * tree.
 *
 * Without that reseed the stop survived a game switch by *id*, which it
 * should only ever do between re-renders of the same data. Across a
 * switch that is an accident of which ids the two games happen to share,
 * so where Tab landed depended on the route taken to get there: Civ 4
 * opens on Fishing, but Civ 4 -> Civ 5 -> Civ 4 opened on Agriculture,
 * because Civ 5 has no Fishing to hold the stop and Civ 4 does have the
 * Agriculture it fell back to.
 *
 * A dataset change is detected by the *identity* of the allTechs array
 * rather than an explicit call from initWheelData, deliberately.
 * initWheelData builds a fresh array on every load and never mutates it
 * afterwards, so identity is an exact signal — and one that cannot be
 * forgotten the way a call at the far end of that function could be if
 * another load path were ever added.
 */
let lastTechs = null;

function resolveStop() {
    const techs = orderedTechs();
    if (!techs.length) return null;

    if (techs !== lastTechs) {
        lastTechs = techs;
        const pinned = window.app && window.app.pinned;
        tabStopId = pinned ? pinned.id : techs[0].id;
        return tabStopId;
    }

    // Same dataset: keep the stop, repairing it only if something has
    // left it pointing at nothing.
    if (tabStopId && techs.some((t) => t.id === tabStopId)) return tabStopId;
    tabStopId = techs[0].id;
    return tabStopId;
}

/** d3-friendly: `.attr("tabindex", tabIndexFor)`. */
export function tabIndexFor(d) {
    return resolveStop() === d.id ? 0 : -1;
}

/** d3-friendly: `.attr("aria-selected", ariaSelectedFor)`. */
export function ariaSelectedFor(d) {
    const sel = window.app && window.app.selected;
    return sel && sel.id === d.id ? "true" : "false";
}

/**
 * The focusable element standing for an advance in whichever view is
 * live. Both carry `data-id`, so this is one lookup; the table's row is
 * preferred when it is actually on screen. `offsetParent` is the test
 * because the hidden view is `display: none` rather than absent — both
 * views exist in the DOM at all times (see renderView.js).
 */
function focusTargetFor(id) {
    const sel = `[data-id="${CSS.escape(id)}"]`;
    const row = document.querySelector(`#table .tt-row${sel}`);
    if (row && row.offsetParent !== null) return row;
    return document.querySelector(`#chart .tech-image${sel}`);
}

/** Move the tab stop and the selection to `tech`, then follow with focus. */
function moveTo(tech) {
    if (!tech) return;
    // Before the render, so the re-draw puts tabindex="0" on the right
    // element; the node itself is reused, the attribute is not.
    tabStopId = tech.id;
    window.app.selected = tech;
    showTooltip(tech);
    const el = focusTargetFor(tech.id);
    if (el) el.focus();
}

export function onNodeKeyDown(event, d) {
    const techs = orderedTechs();
    const here = techs.findIndex((t) => t.id === d.id);
    if (here < 0) return;
    const last = techs.length - 1;

    switch (event.key) {
        case "ArrowDown":
        case "ArrowRight":
            event.preventDefault();
            moveTo(techs[Math.min(last, here + 1)]);
            return;
        case "ArrowUp":
        case "ArrowLeft":
            event.preventDefault();
            moveTo(techs[Math.max(0, here - 1)]);
            return;
        case "Home":
            event.preventDefault();
            moveTo(techs[0]);
            return;
        case "End":
            event.preventDefault();
            moveTo(techs[last]);
            return;
        case "Enter":
        case " ":
            // Space would scroll the page; Enter is harmless but both go
            // through the mouse's own handler for consistency.
            event.preventDefault();
            onNodeClick(event, d);
            return;
        case "Escape":
            event.preventDefault();
            releasePin();
            return;
        default:
    }
}

/**
 * Focusing an advance previews it, so a keyboard user gets the same
 * highlight and tooltip a mouse user gets on hover.
 *
 * Guarded against the focus *we* just moved: moveTo already set the
 * selection before calling focus(), and re-entering here would redraw a
 * second time for no reason.
 */
export function onNodeFocus(_, d) {
    const sel = window.app && window.app.selected;
    if (sel && sel.id === d.id) return;
    tabStopId = d.id;
    window.app.selected = d;
    showTooltip(d);
}
