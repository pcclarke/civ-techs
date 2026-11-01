/**
 * The "Details below" / "Details above" hint: a small chip at the edge of
 * the viewport, shown while the wheel's tooltip is mostly off screen.
 *
 * The tooltip goes off screen on purpose. chooseCorner (tooltip.js) never
 * puts it over the lit selection just to keep it visible, so when no
 * on-screen corner is clear, it docks to one that isn't on screen. Left at
 * that, selecting an advance highlighted it and appeared to do nothing
 * else. The hint says where the details went, at a size that covers far
 * less of the wheel than the tooltip would have.
 *
 * Two modes, because of what a pointer can and can't do:
 *
 *   - Preview (hover, or keyboard focus): informational only — disabled,
 *     aria-hidden, and it says how to pin. It can't be a button here:
 *     moving the mouse toward it leaves the hovered advance, and
 *     mouseleave hides the tooltip and this with it. It isn't announced
 *     because the tooltip is role="status" and already is.
 *   - Pinned: a real button that scrolls the tooltip into view. It's the
 *     next tab stop after the wheel (see its place in index.html), so a
 *     keyboard user who pinned with Enter reaches it with Tab.
 *
 * Previews fade in after a short delay (see #details-hint in techs.css) so
 * the chip doesn't flicker on and off as the pointer crosses the wheel.
 * A pin shows it at once.
 *
 * Wheel only. The mobile sheet is docked to the viewport and always
 * visible, so there is nothing to point at.
 */

/** Below this fraction of its area on screen, the tooltip gets a hint.
 *  Half: a tooltip that's mostly visible is plainly there, and a chip
 *  pointing at it would just be clutter. */
const SHOW_BELOW = 0.5;

/** Distance between the hint and the edge of the visible band. */
const EDGE_GAP = 16;
/** How far past the visible edge a scrolled-to tooltip lands. */
const SCROLL_MARGIN = 10;

/** The part of the viewport a tooltip can actually be read in: below the
 *  toolbar while it's pinned to the top (it sits under the tooltip's
 *  z-index, so a box there would cover the controls rather than hide). */
export function visibleBand() {
    const bar = document.querySelector("#select-options");
    const top = bar && bar.classList.contains("stuck") ? bar.getBoundingClientRect().bottom : 0;
    const root = document.documentElement;
    return { left: 0, top, right: root.clientWidth, bottom: root.clientHeight };
}

/** Fraction of `rect`'s area inside `band`, in [0, 1]. */
export function visibleFraction(rect, band) {
    const w = Math.min(rect.right, band.right) - Math.max(rect.left, band.left);
    const h = Math.min(rect.bottom, band.bottom) - Math.max(rect.top, band.top);
    if (w <= 0 || h <= 0) return 0;
    return (w * h) / ((rect.right - rect.left) * (rect.bottom - rect.top));
}

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/** True when the tooltip is showing as the wheel's docked box (not the
 *  mobile sheet, and not hidden). */
function wheelTooltipShowing(tip) {
    if (!tip || tip.classList.contains("hidden")) return false;
    const svgEl = document.querySelector("#chart svg");
    return Boolean(svgEl) && svgEl.getBoundingClientRect().width > 0;
}

function hide(hint) {
    hint.classList.remove("shown", "now");
    hint.disabled = true;
    hint.setAttribute("aria-hidden", "true");
}

/**
 * Show, hide, or move the hint to match where the tooltip is now. Called
 * whenever the tooltip is placed or hidden, and on scroll.
 */
export function updateDetailsHint() {
    const hint = document.querySelector("#details-hint");
    if (!hint) return;
    const tip = document.querySelector("#tooltip");
    if (!wheelTooltipShowing(tip)) {
        hide(hint);
        return;
    }

    const r = tip.getBoundingClientRect();
    const band = visibleBand();
    if (visibleFraction(r, band) >= SHOW_BELOW) {
        hide(hint);
        return;
    }

    // Which way to point: whichever side of the visible band the
    // tooltip's middle is on.
    const below = (r.top + r.bottom) / 2 > (band.top + band.bottom) / 2;
    const pinned = Boolean(window.app && window.app.pinned);
    // :focus-visible rather than "focus is in the wheel": clicking an
    // advance focuses its icon too, so after a mouse user unpins, focus
    // is still in #chart and the hint would tell them to press Enter.
    const active = document.activeElement;
    const keyboard = Boolean(active && active.closest && active.closest("#chart") &&
        active.matches(":focus-visible"));
    const where = below ? "↓ Details below" : "↑ Details above";
    hint.textContent = pinned ? where
        : `${where} · ${keyboard ? "press Enter" : "click"} to pin`;

    hint.disabled = !pinned;
    if (pinned) hint.removeAttribute("aria-hidden");
    else hint.setAttribute("aria-hidden", "true");

    // Under the tooltip's column, so the chip also says which side.
    const w = hint.offsetWidth;
    const h = hint.offsetHeight;
    const cx = (r.left + r.right) / 2;
    const left = Math.max(band.left + EDGE_GAP, Math.min(band.right - EDGE_GAP - w, cx - w / 2));
    const top = below ? band.bottom - EDGE_GAP - h : band.top + EDGE_GAP;
    hint.style.left = `${left}px`;
    hint.style.top = `${top}px`;

    // A preview still waiting out its fade-in delay keeps waiting if it's
    // pinned mid-delay: changing transition-delay doesn't restart a
    // visibility transition already heading to the same value. Drop it
    // back to hidden and flush, so the pin's zero-delay show starts fresh.
    if (pinned && hint.classList.contains("shown") && !hint.classList.contains("now")) {
        hint.classList.remove("shown");
        void hint.offsetWidth;
    }
    hint.classList.toggle("now", pinned);
    hint.classList.add("shown");
}

/** Scroll just far enough to bring the whole tooltip into the visible
 *  band — or, for one taller than the band, its top edge. */
function scrollTooltipIntoView() {
    const tip = document.querySelector("#tooltip");
    if (!wheelTooltipShowing(tip)) return;
    const r = tip.getBoundingClientRect();
    const band = visibleBand();

    let dy = 0;
    if (r.height > band.bottom - band.top - 2 * SCROLL_MARGIN || r.top < band.top) {
        dy = r.top - band.top - SCROLL_MARGIN;
    } else if (r.bottom > band.bottom) {
        dy = r.bottom - band.bottom + SCROLL_MARGIN;
    }
    window.scrollBy({ top: dy, behavior: reducedMotion.matches ? "auto" : "smooth" });
}

const hint = document.querySelector("#details-hint");
if (hint) {
    hide(hint);
    hint.addEventListener("click", () => {
        if (!window.app || !window.app.pinned) return;
        // Focus would otherwise be stranded on a chip that's about to
        // disappear; the tooltip's close button is where a keyboard user
        // goes next anyway. preventScroll: the scroll is ours to make.
        const fromKeyboard = document.activeElement === hint;
        scrollTooltipIntoView();
        if (fromKeyboard) {
            const close = document.querySelector("#tipCloseButton");
            if (close) close.focus({ preventScroll: true });
        }
    });

    // Coalesced to a frame, like the toolbar's own scroll handler in
    // main.js. Cheap when no tooltip is open: one class check.
    let frame = 0;
    window.addEventListener("scroll", () => {
        if (frame) return;
        frame = requestAnimationFrame(() => {
            frame = 0;
            updateDetailsHint();
        });
    }, { passive: true });
}
