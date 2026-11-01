/**
 * Browser checks for the parts of the app that only a real browser can
 * exercise: the layout logic, which derives every radius from *measured*
 * text, and the reduced-motion gate, which depends on a real media query.
 *
 * Neither is testable in Node or jsdom. computeWheelLayout calls
 * getComputedTextLength and getBBox on live <text>; makeTable measures
 * names on a 2D canvas; renderView reads prefers-reduced-motion. All three
 * need a rendering engine, so these run against the project's actual
 * index.html in headless Chrome (see run.mjs).
 *
 * Assertions are *invariants*, not pixel values: "every label fits inside
 * the SVG", not "labelRadius is 418.5". Absolute numbers shift with font
 * availability and platform text rasterisation, which would make this a
 * test that cries wolf; the relationships the code promises hold either
 * way. Measured numbers are still reported, as diagnostics.
 */
import { select } from "d3-selection";

import {
    EDGE_PADDING, GAME_IMG_WIDTH, LABEL_PADDING, LABEL_SLOT_FRACTION,
    MIN_TECH_IMG_RADIUS, TECH_IMG_WIDTH, TECH_LABEL_FONT_MAX,
    TECH_LABEL_FONT_MIN, TOTAL_WIDTH, TWO_PI_ADJ, ROW_H,
} from "../../src/constants";
import { computeWheelLayout, refreshWheelLayout } from "../../src/computeWheelLayout";
import { calculatePointOnWheel, wheelTransform } from "../../src/helpers";
import { eraAngles, eraLabelIndex, eraWedge } from "../../src/drawEras";
import { makeUnlockArc } from "../../src/arcs";
import { eraDisplayName } from "../../src/eraData";
import { prefersReducedMotion, renderActiveView, isTableView } from "../../src/renderView";
import svgInit from "../../src/svgInit";
import { hideTooltip, showTooltip } from "../../src/tooltip";
import { onSheetLeave, releasePin } from "../../src/drawTools";
// Written by run.mjs from the real data pipeline before this is bundled.
import { NAMES, WHEEL } from "./.generated/fixtures.generated.js";

const MAX_EXTENT = TOTAL_WIDTH / 2 - EDGE_PADDING;
const results = [];
const note = [];
const ok = (name, pass, detail = "") => results.push({ name, pass, detail });

/* ------------------------------ helpers ------------------------------ */

function freshWheel() {
    select("#chart").selectAll("*").remove();
    return svgInit();
}

/** Re-measure label widths the way computeWheelLayout does internally, at
 *  whatever font size it settled on and left applied to the group. */
function measure(group, techs) {
    const sel = group.selectAll("text.check-measure").data(techs).join("text")
        .attr("class", "check-measure").attr("visibility", "hidden").text((d) => d.name);
    const widths = [];
    let lineHeight = 0;
    sel.each(function () {
        widths.push(this.getComputedTextLength());
        lineHeight = Math.max(lineHeight, this.getBBox().height);
    });
    sel.remove();
    return { widths, lineHeight };
}

/* --------------------------- layout checks --------------------------- */

function layoutChecks() {
    for (const [key, techs] of Object.entries(NAMES)) {
        const svg = freshWheel();
        const r = computeWheelLayout(svg.techLabels, techs);
        const fontSize = parseFloat(svg.techLabels.style("font-size"));
        const { widths, lineHeight } = measure(svg.techLabels, techs);
        const flooredOut = r.techImgRadius === MIN_TECH_IMG_RADIUS;

        // The contract maxLabelRadius exists to satisfy: every label's
        // outer corner inside the SVG. The documented escape hatch is the
        // MIN_TECH_IMG_RADIUS floor — "rather than collapse the whole
        // wheel", a floored layout is allowed to overhang.
        let worstOverhang = 0;
        for (let i = 0; i < techs.length; i++) {
            const { angle } = calculatePointOnWheel(techs.length, i, 1);
            const c = Math.abs(Math.cos(angle));
            const s = Math.abs(Math.sin(angle));
            const x = (r.labelRadius + widths[i]) * c + (lineHeight / 2) * s;
            const y = (r.labelRadius + widths[i]) * s + (lineHeight / 2) * c;
            worstOverhang = Math.max(worstOverhang, x - MAX_EXTENT, y - MAX_EXTENT);
        }
        ok(`${key}: labels fit inside the SVG`,
            worstOverhang <= 0.5 || flooredOut,
            `overhang ${worstOverhang.toFixed(2)}px${flooredOut ? " (radius floored)" : ""}`);

        ok(`${key}: icon ring inset from labels by exactly the icon + padding`,
            Math.abs(r.labelRadius - (r.techImgRadius + TECH_IMG_WIDTH / 2 + LABEL_PADDING)) < 1e-9);

        ok(`${key}: icon radius respects its floor`, r.techImgRadius >= MIN_TECH_IMG_RADIUS,
            `${r.techImgRadius.toFixed(1)} >= ${MIN_TECH_IMG_RADIUS}`);

        ok(`${key}: font size within bounds`,
            fontSize >= TECH_LABEL_FONT_MIN && fontSize <= TECH_LABEL_FONT_MAX,
            `${fontSize}px`);

        // Either the crowding test passes, or the smallest size was
        // accepted unconditionally (which computeWheelLayout documents).
        const slot = (r.labelRadius * TWO_PI_ADJ) / techs.length;
        ok(`${key}: labels not crowded past LABEL_SLOT_FRACTION`,
            lineHeight <= slot * LABEL_SLOT_FRACTION || fontSize === TECH_LABEL_FONT_MIN,
            `line ${lineHeight.toFixed(1)} vs slot ${(slot * LABEL_SLOT_FRACTION).toFixed(1)}`);

        // Era labels live in the annulus between the hub image and the
        // icon ring; era wedges stop between the icons and the labels.
        ok(`${key}: era label radius inside the hub annulus`,
            r.eraLabelRadius > GAME_IMG_WIDTH / 2 &&
            r.eraLabelRadius < r.techImgRadius - TECH_IMG_WIDTH / 2);
        ok(`${key}: era wedge radius between icons and labels`,
            r.eraBackgroundRadius > r.techImgRadius &&
            r.eraBackgroundRadius < r.labelRadius);

        note.push(`${key.padEnd(26)} n=${String(techs.length).padStart(3)} ` +
            `font=${fontSize}px icon=${r.techImgRadius.toFixed(0)} label=${r.labelRadius.toFixed(0)}`);
    }

    // Density drives the font down, and that direction is the invariant:
    // a tree with more advances can never be given a larger label font
    // than a sparser one.
    //
    // Asserted as a relationship rather than absolute sizes on purpose.
    // constants.js documents LABEL_SLOT_FRACTION as calibrated so Civ 4
    // BTS lands exactly on the minimum, but which size any tree lands on
    // depends on the *metrics of the font that actually loaded* — the
    // labels inherit body's "helvetica neue, Helvetica, …, sans-serif",
    // and a Linux CI runner has none of those and falls back to something
    // wider. Pinning the absolute value would make this check report a
    // machine difference as a regression.
    const fontFor = (key) => {
        const svg = freshWheel();
        computeWheelLayout(svg.techLabels, NAMES[key]);
        return parseFloat(svg.techLabels.style("font-size"));
    };
    const dense = fontFor("civ4bts:technologies");   // 92 advances
    const sparse = fontFor("civ4:civics");           // 20 advances
    ok("a denser tree never gets a larger font than a sparser one",
        dense <= sparse, `92 advances -> ${dense}px, 20 advances -> ${sparse}px`);
    ok("both stay within the configured bounds",
        dense >= TECH_LABEL_FONT_MIN && sparse <= TECH_LABEL_FONT_MAX,
        `${TECH_LABEL_FONT_MIN}..${TECH_LABEL_FONT_MAX}`);

    // The documented display:none hazard: text inside a hidden subtree
    // measures as zero width, which collapses every radius to its
    // fallback. refreshWheelLayout exists to repair exactly this.
    const techs = NAMES["civ4:technologies"];
    const svg = freshWheel();
    const visible = computeWheelLayout(svg.techLabels, techs);
    select("#chart").style("display", "none");
    const hidden = computeWheelLayout(svg.techLabels, techs);
    ok("hidden subtree measures as collapsed (the documented hazard)",
        hidden.labelRadius > visible.labelRadius,
        `hidden ${hidden.labelRadius.toFixed(0)} vs visible ${visible.labelRadius.toFixed(0)}`);

    select("#chart").style("display", null);
    window.app = { svg, wheelData: { allTechs: techs, prerequisites: WHEEL.civ4.prerequisites } };
    refreshWheelLayout();
    ok("refreshWheelLayout repairs it once visible",
        Math.abs(window.app.wheelData.labelRadius - visible.labelRadius) < 0.5,
        `${window.app.wheelData.labelRadius.toFixed(1)} vs ${visible.labelRadius.toFixed(1)}`);
}

/* ------------------------ reduced-motion checks ----------------------- */

function setupApp(game) {
    const svg = freshWheel();
    window.app = {
        game, tree: { id: "tech", folder: "technologies", dataKey: "technologies" },
        _selected: null, pinned: null, svg,
        wheelData: structuredClone(WHEEL[game]),
    };
    // The same accessor main.js installs, and it has to be here: assigning
    // `selected` is what triggers a re-render in the real app, so a plain
    // property would let every check that depends on the redraw — anything
    // reading tabindex, aria-selected or a .fade class after a selection —
    // silently pass against a stale DOM.
    Object.defineProperty(window.app, "selected", {
        get() { return window.app._selected; },
        set(value) {
            window.app._selected = value;
            if (window.app.wheelData) renderActiveView();
        },
    });
    refreshWheelLayout();
    return svg;
}

function motionChecks() {
    const reduced = prefersReducedMotion();
    ok(`media query reports ${reduced ? "reduce" : "no-preference"} as expected`,
        reduced === (location.hash.includes("reduced")),
        `prefersReducedMotion()=${reduced}`);

    setupApp("civ4");
    renderActiveView();                       // establish the wheel, no animation
    ok("wheel view is active for these checks", !isTableView());

    // Switch datasets and ask for an animation. The era layer is the
    // tell: on the instant path every wedge is already at its final span
    // the moment the call returns; on the animated path it is still at
    // the old one, because a d3 transition's first frame hasn't run yet.
    window.app.wheelData = structuredClone(WHEEL.civ7);
    refreshWheelLayout();
    const R = window.app.wheelData.eraBackgroundRadius;
    renderActiveView({ animate: true });

    const wedge = eraWedge(R);
    const expected = window.app.wheelData.eraRanges.map((r) => wedge(eraAngles(r)));
    const actual = select("#chart").selectAll("g.era-backgrounds path").nodes()
        .map((n) => n.getAttribute("d"));
    const settled = expected.length > 0 &&
        expected.every((d) => actual.includes(d)) && actual.length === expected.length;

    if (reduced) {
        ok("reduced motion: switch lands on its final frame immediately", settled,
            `${actual.length} wedges, ${expected.length} expected`);
    } else {
        ok("no preference: switch is mid-animation, not settled", !settled,
            `${actual.length} wedges drawn, ${expected.length} expected at rest`);
        window.__tick(900);
        const after = select("#chart").selectAll("g.era-backgrounds path").nodes()
            .map((n) => n.getAttribute("d"));
        ok("no preference: it settles once the animation runs",
            after.length === expected.length && expected.every((d) => after.includes(d)),
            `${after.length} wedges`);
    }

    labelChecks(reduced);
}

/* -------------------------- keyboard nav ----------------------------- */

/** The focusable advances in whichever view is live. */
const options = () => isTableView()
    ? [...document.querySelectorAll("#table .tt-row")]
    : [...document.querySelectorAll("#chart .tech-image")];

const press = (el, key) => el.dispatchEvent(
    new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));

const stops = () => options().filter((n) => n.getAttribute("tabindex") === "0");

function keyboardChecks() {
    const view = isTableView() ? "table" : "wheel";
    setupApp("civ4");
    renderActiveView();

    const opts = options();
    const techs = window.app.wheelData.allTechs;
    ok(`${view}: one option per advance`, opts.length === techs.length,
        `${opts.length} options, ${techs.length} advances`);
    ok(`${view}: every option has role=option`,
        opts.every((n) => n.getAttribute("role") === "option"), "");

    // The whole point of a roving tabindex: Tab reaches the chart once,
    // not ninety-two times.
    ok(`${view}: exactly one tab stop`, stops().length === 1,
        `${stops().length} elements with tabindex=0 out of ${opts.length}`);

    // Decoration must not be announced as a stray child of the listbox.
    const decor = isTableView()
        ? [...document.querySelectorAll("#table svg.tt-lanes, #table div.tt-era")]
        : [...document.querySelectorAll("#chart g.arcs, #chart g.spokes, #chart g.era-backgrounds, #chart g.tech-labels")];
    ok(`${view}: relationship layers are aria-hidden`,
        decor.length > 0 && decor.every((n) => n.getAttribute("aria-hidden") === "true"),
        `${decor.filter((n) => n.getAttribute("aria-hidden") === "true").length}/${decor.length}`);

    // --- navigation ---
    const first = options()[0];
    first.focus();
    ok(`${view}: an option can take focus`, document.activeElement === first,
        document.activeElement ? document.activeElement.tagName : "none");
    ok(`${view}: focusing previews the advance`,
        window.app.selected && window.app.selected.id === techs[0].id,
        window.app.selected ? window.app.selected.id : "nothing selected");

    press(document.activeElement, "ArrowDown");
    ok(`${view}: ArrowDown moves to the next advance`,
        window.app.selected && window.app.selected.id === techs[1].id,
        window.app.selected ? window.app.selected.id : "nothing");
    ok(`${view}: focus follows, and the tab stop with it`,
        document.activeElement === options()[1] && stops().length === 1
        && stops()[0] === options()[1],
        `focus=${document.activeElement.getAttribute("data-id")}, ` +
        `stop=${stops()[0] && stops()[0].getAttribute("data-id")}`);

    press(document.activeElement, "ArrowUp");
    press(document.activeElement, "ArrowUp");
    ok(`${view}: clamps at the first advance`,
        window.app.selected && window.app.selected.id === techs[0].id,
        window.app.selected ? window.app.selected.id : "nothing");

    press(document.activeElement, "End");
    ok(`${view}: End jumps to the last advance`,
        window.app.selected && window.app.selected.id === techs[techs.length - 1].id,
        window.app.selected ? window.app.selected.id : "nothing");
    press(document.activeElement, "ArrowDown");
    ok(`${view}: clamps at the last advance`,
        window.app.selected && window.app.selected.id === techs[techs.length - 1].id, "");
    press(document.activeElement, "Home");
    ok(`${view}: Home jumps back to the first`,
        window.app.selected && window.app.selected.id === techs[0].id, "");

    // --- pin / release, through the mouse's own handlers ---
    press(document.activeElement, "Enter");
    ok(`${view}: Enter pins the advance`,
        window.app.pinned && window.app.pinned.id === techs[0].id,
        window.app.pinned ? window.app.pinned.id : "nothing pinned");
    ok(`${view}: a pinned option reports aria-selected`,
        options()[0].getAttribute("aria-selected") === "true",
        `${options()[0].getAttribute("data-id")} -> aria-selected=` +
        `${options()[0].getAttribute("aria-selected")}`);

    // Arrowing while pinned moves the preview — a keyboard has no
    // accidental travel, so unlike hover it is not inert.
    press(document.activeElement, "ArrowDown");
    ok(`${view}: arrowing while pinned still moves`,
        window.app.selected && window.app.selected.id === techs[1].id,
        window.app.selected ? window.app.selected.id : "nothing");

    press(document.activeElement, "Escape");
    ok(`${view}: Escape releases everything`,
        !window.app.pinned && !window.app.selected,
        `pinned=${Boolean(window.app.pinned)} selected=${Boolean(window.app.selected)}`);

    // The tab stop has to survive the redraw every hover triggers.
    options()[5].focus();
    window.app.selected = techs[9];
    ok(`${view}: one tab stop survives a re-render`, stops().length === 1,
        `${stops().length} stops after redraw`);

    ok(`${view}: tooltip is announced as it changes`,
        document.querySelector("#tooltip").getAttribute("role") === "status",
        document.querySelector("#tooltip").getAttribute("role") || "no role");

    // --- where Tab lands must not depend on the route taken ---
    // Reported from the real thing: Civ 4 opens on Fishing, but after a
    // round trip through Civ 5 it opened on Agriculture. Civ 5 has no
    // TECH_FISHING to hold the stop, so it fell back to Civ 5's first
    // advance — and Civ 4 *does* have that Agriculture, so it persisted
    // on the way back.
    const stopId = () => {
        const n = stops()[0];
        return n && n.getAttribute("data-id");
    };
    setupApp("civ4");
    renderActiveView();
    const civ4First = window.app.wheelData.allTechs[0].id;
    ok(`${view}: Civ 4 opens on its first advance`, stopId() === civ4First,
        `${stopId()} vs ${civ4First}`);

    options()[0].focus();                          // as a user tabbing in would
    switchTo("civ5", { animate: false });
    const civ5First = window.app.wheelData.allTechs[0].id;
    ok(`${view}: Civ 5 opens on its own first advance`, stopId() === civ5First,
        `${stopId()} vs ${civ5First}`);
    // The precondition that made the bug possible, asserted so this check
    // can't quietly stop testing anything if the data changes.
    ok(`${view}: Civ 4 does contain Civ 5's first advance`,
        WHEEL.civ4.allTechs.some((t) => t.id === civ5First),
        `${civ5First} present in civ4: ${WHEEL.civ4.allTechs.some((t) => t.id === civ5First)}`);

    switchTo("civ4", { animate: false });
    ok(`${view}: returning to Civ 4 opens on Fishing again, not Agriculture`,
        stopId() === civ4First, `${stopId()} vs ${civ4First}`);

    // A pin that survives the switch should hold the stop instead, so the
    // keyboard entry point agrees with the advance still on screen.
    const keep = window.app.wheelData.allTechs.find((t) =>
        WHEEL.civ5.allTechs.some((o) => o.id === t.id));
    window.app.pinned = keep;
    switchTo("civ5", { animate: false });
    ok(`${view}: a carried pin holds the tab stop`, stopId() === keep.id,
        `${stopId()} vs ${keep.id}`);
    window.app.pinned = null;

    note.push(`${view}: ${opts.length} options, 1 tab stop, focus ring via :focus-visible`);
}

/* ---------------------------- arc layer ------------------------------ */

const arcEls = () => [...document.querySelectorAll("#chart g.arcs path")];
const pinEls = () => [...document.querySelectorAll("#chart g.unlock-pins path")];
const sqEls = () => [...document.querySelectorAll("#chart g.unlock-squares rect")];
const ciEls = () => [...document.querySelectorAll("#chart g.unlock-circles circle")];

function arcChecks() {
    setupApp("civ4");
    renderActiveView();
    const startIds = new Set(WHEEL.civ4.prerequisites.map((p) => p.id));
    arcEls().forEach((n) => { n.__probe = true; });
    const survivors = WHEEL.civ5.prerequisites.filter((p) => startIds.has(p.id)).length;
    ok("fixture has arcs that survive the switch", survivors > 10, `${survivors} survivors`);

    switchTo("civ5", { animate: true });

    // The actual regression this replaced: the old layer-wide crossfade
    // took the arcs to opacity 0 and only then brought the new set up, so
    // they were absent from the middle of the switch while the spokes
    // swept on. Survivors now hold full opacity the whole way through.
    let faintest = 1;
    let emptiest = Infinity;
    for (let i = 0; i < 45; i++) {
        window.__tick(16);
        const live = arcEls();
        emptiest = Math.min(emptiest, live.length);
        if (live.length) {
            faintest = Math.min(faintest, Math.max(...live.map(
                (n) => parseFloat(getComputedStyle(n).opacity) || 0)));
        }
    }
    ok("arc layer never empties mid-switch", emptiest > 0, `low-water mark ${emptiest} arcs`);
    ok("arc layer never goes faint mid-switch", faintest > 0.5,
        `faintest peak opacity seen: ${faintest.toFixed(2)}`);

    window.__tick(1200);

    const want = WHEEL.civ5.prerequisites.filter((p) => Number.isFinite(p.step));
    ok("arc count matches the new game", arcEls().length === want.length,
        `${arcEls().length} vs ${want.length}`);
    ok("surviving arcs are moved, not re-created",
        arcEls().filter((n) => n.__probe).length > 10,
        `${arcEls().filter((n) => n.__probe).length} carried`);

    // Settled geometry must equal what the static path would draw — the
    // radius is interpolated here, so a settle error shows up as an arc
    // parked on the wrong ring.
    const unlockArc = makeUnlockArc(window.app.wheelData.arcSpace);
    const expect = new Set(want.map((d) => unlockArc(d)));
    const got = arcEls().map((n) => n.getAttribute("d"));
    ok("settled arcs match the static generator exactly",
        got.length === expect.size && got.every((d) => expect.has(d)),
        `${got.filter((d) => !expect.has(d)).length} mismatched`);

    ok("pins, squares and circles match the new game too",
        pinEls().length === want.length
        && sqEls().length === WHEEL.civ5.squareData.length
        && ciEls().length === WHEEL.civ5.circleData.length,
        `${pinEls().length} pins / ${sqEls().length} squares / ${ciEls().length} circles ` +
        `vs ${want.length} / ${WHEEL.civ5.squareData.length} / ${WHEEL.civ5.circleData.length}`);

    ok("no stranded inline opacity across the arc layer",
        [...arcEls(), ...pinEls(), ...sqEls(), ...ciEls()].every((n) => n.style.opacity === ""),
        `${[...arcEls(), ...pinEls(), ...sqEls(), ...ciEls()].filter((n) => n.style.opacity !== "").length} stranded`);

    note.push(`arcs: civ4 ${WHEEL.civ4.prerequisites.length} -> civ5 ${want.length}, ` +
        `${survivors} shared ids`);

    // Arcs aren't pointer targets: no handlers from either draw path, and
    // no hit-testing, so a click on one reaches the SVG's release-pin
    // handler. `__on` is where d3-selection keeps a node's listeners.
    const inert = (nodes) => nodes.filter(
        (n) => n.__on || getComputedStyle(n).pointerEvents !== "none");
    ok("arcs drawn by the switch animation take no pointer events",
        inert(arcEls()).length === 0, `${inert(arcEls()).length} of ${arcEls().length} live`);
    renderActiveView();
    ok("arcs drawn by the static path take no pointer events",
        inert(arcEls()).length === 0, `${inert(arcEls()).length} of ${arcEls().length} live`);
    window.app.selected = null;
    arcEls()[0].dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
    ok("hovering an arc selects nothing", !window.app.selected,
        `(hover: hover) ${matchMedia("(hover: hover)").matches}`);
}

/* ------------------------- era label checks -------------------------- */

const labelNodes = () =>
    [...document.querySelectorAll("#chart g.era-labels text")];

/** The transform drawEraLabels would give each era statically. A settled
 *  animated label must match it exactly — if the per-frame flip lands on
 *  the wrong side of its cos(angle) < 0 test, the name renders mirrored,
 *  and this string is where that shows up. */
const staticTransforms = () => {
    const { eraRanges, eraLabelRadius } = window.app.wheelData;
    return eraRanges.map((d) => wheelTransform(d.count, eraLabelIndex(d), eraLabelRadius));
};

function switchTo(game, opts) {
    window.app.game = game;
    window.app.wheelData = structuredClone(WHEEL[game]);
    refreshWheelLayout();
    renderActiveView(opts);
}

function labelChecks(reduced) {
    // --- survivors that keep their wording must keep their DOM node ---
    setupApp("civ4");
    renderActiveView();
    labelNodes().forEach((n, i) => { n.__probe = i; });
    const before = labelNodes().length;

    switchTo("civ5", { animate: true });
    if (!reduced) window.__tick(1200);

    const after = labelNodes();
    ok("label count matches the new game", after.length === window.app.wheelData.eraRanges.length,
        `${after.length} labels, ${window.app.wheelData.eraRanges.length} eras`);
    // Civ 4 and Civ 5 both use the ERA_* vocabulary, so every surviving
    // label reads identically and should have been carried, not replaced.
    ok("same-wording survivors are moved, not re-created",
        after.length === before && after.every((n) => n.__probe !== undefined),
        `${after.filter((n) => n.__probe !== undefined).length}/${after.length} carried`);

    const want = staticTransforms();
    const got = after.map((n) => n.getAttribute("transform"));
    ok("settled transforms match the static formula exactly",
        want.every((t) => got.includes(t)) && got.length === want.length,
        got.length === want.length ? "all match" : `${got.length} vs ${want.length}`);

    // --- renamed eras: one node each, carrying the new wording ---
    setupApp("civ2");
    renderActiveView();
    switchTo("civ3", { animate: true });
    if (!reduced) window.__tick(1200);

    const texts = labelNodes().map((n) => n.textContent).sort();
    const expect = window.app.wheelData.eraRanges.map((d) => eraDisplayName(d.era)).sort();
    ok("renamed eras end with exactly one label each",
        texts.length === expect.length && texts.every((t, i) => t === expect[i]),
        `[${texts.join(", ")}] vs [${expect.join(", ")}]`);
    ok("no stranded inline opacity on labels",
        labelNodes().every((n) => n.style.opacity === ""),
        `${labelNodes().filter((n) => n.style.opacity !== "").length} stranded`);

    if (!reduced) {
        // Mid-flight, a renamed era is genuinely two nodes crossfading.
        setupApp("civ2");
        renderActiveView();
        switchTo("civ3", { animate: true });
        window.__tick(350);
        const live = labelNodes();
        ok("mid-flight: a renamed era is two nodes crossfading",
            live.length > window.app.wheelData.eraRanges.length,
            `${live.length} nodes vs ${window.app.wheelData.eraRanges.length} eras at rest`);
        ok("mid-flight: labels are in motion, not parked",
            live.some((n) => !staticTransforms().includes(n.getAttribute("transform"))),
            "at least one label off its final transform");
        window.__tick(1200);
        ok("crossfade cleans up to one node per era",
            labelNodes().length === window.app.wheelData.eraRanges.length,
            `${labelNodes().length} labels`);
    }
}

/* --------------------------- table checks ---------------------------- */

function tableChecks() {
    setupApp("civ4");
    ok("table view is active at this width", isTableView(), `${window.innerWidth}px wide`);
    renderActiveView();

    const root = document.querySelector("#table");
    const rows = root.querySelectorAll(".tt-row");
    ok("one row per advance", rows.length === window.app.wheelData.allTechs.length,
        `${rows.length} rows`);
    ok("every row is exactly ROW_H tall (the lane overlay depends on it)",
        [...rows].every((r) => Math.abs(r.getBoundingClientRect().height - ROW_H) < 0.5),
        `ROW_H=${ROW_H}`);

    // contentLeft's documented contract: the widest name finishes flush
    // against the table's right edge. Measured the same way makeTable
    // does it — canvas measureText with .tt-name's computed font.
    const contentLeft = parseFloat(getComputedStyle(root).getPropertyValue("--tt-content-left"));
    const nameEl = root.querySelector(".tt-name");
    const iconEl = root.querySelector(".tt-icon");
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.font = getComputedStyle(nameEl).font;
    let widest = 0;
    for (const t of window.app.wheelData.allTechs) {
        widest = Math.max(widest, ctx.measureText(t.name).width);
    }
    const iconW = iconEl.getBoundingClientRect().width;
    const gap = parseFloat(getComputedStyle(root.querySelector(".tt-row")).gap) || 0;
    const slack = root.clientWidth - (contentLeft + iconW + gap + Math.ceil(widest));

    // Floored at the lanes' minimum when names are too long to fit, which
    // is the documented fallback rather than a failure.
    const laneCount = Math.max(...window.app.wheelData.prerequisites
        .filter((d) => Number.isFinite(d.step)).map((d) => d.step)) + 1;
    const floored = contentLeft <= laneCount * 6 + 8 + 0.5;
    ok("widest name lands flush against the right edge",
        (slack >= 0 && slack <= 2) || floored,
        `slack ${slack.toFixed(2)}px, contentLeft ${contentLeft.toFixed(1)}` +
        (floored ? " (floored to lane minimum)" : ""));
    ok("lanes never overlap the text block", contentLeft >= laneCount * 6,
        `${laneCount} lanes vs ${contentLeft.toFixed(1)}px`);

    note.push(`table: ${rows.length} rows, contentLeft=${contentLeft.toFixed(1)}, ` +
        `widest name ${widest.toFixed(1)}px, ${laneCount} lanes`);

    // --- the tooltip is a viewport-fixed bottom sheet here ---
    // The wheel's box is document-anchored so it scrolls with the wheel;
    // the sheet must not inherit that, or it would scroll off with the
    // rows instead of staying docked to the bottom edge.
    const tip = document.querySelector("#tooltip");
    showTooltip(window.app.wheelData.allTechs[0]);
    window.scrollBy(0, 200);
    const sheet = tip.getBoundingClientRect();
    ok("no details hint in the sheet view",
        !document.querySelector("#details-hint").classList.contains("shown") &&
        getComputedStyle(document.querySelector("#details-hint")).display === "none");
    ok("bottom sheet stays docked to the viewport while scrolling",
        getComputedStyle(tip).position === "fixed" &&
        Math.abs(sheet.bottom - window.innerHeight) < 1,
        `position ${getComputedStyle(tip).position}, bottom ${sheet.bottom.toFixed(1)} ` +
        `vs ${window.innerHeight}, scrollY ${window.scrollY}`);
    hideTooltip();
    window.scrollTo(0, 0);

    // --- a hover preview that opens under the pointer stays open ---
    // On a narrow desktop window the sheet is docked over the bottom of
    // the viewport, so hovering a row there opens it right under the
    // pointer. The browser then sends the row a mouseleave whose
    // relatedTarget is the sheet; replayed here with elementFromPoint, so
    // the event is the one a real pointer would produce.
    {
        const tipEl = document.querySelector("#tooltip");
        const open = () => !tipEl.classList.contains("hidden");
        const leave = (el, to) => el.dispatchEvent(
            new MouseEvent("mouseleave", { relatedTarget: to }));
        const hoverRow = (row) => row.dispatchEvent(new MouseEvent("mouseover", { bubbles: true }));
        const centre = (el) => {
            const r = el.getBoundingClientRect();
            return [r.left + r.width / 2, r.top + r.height / 2];
        };
        // The two bindings main.js makes, which this harness replaces:
        // without them the sheet's leave and close have no listener at all.
        select("#tooltip").on("mouseleave", onSheetLeave);
        select("#tipCloseButton").on("click", releasePin);
        window.app.pinned = null;
        window.app.selected = null;
        window.scrollTo(0, document.documentElement.scrollHeight);

        // The last row that ends up under the sheet once it's open.
        const rowsNow = [...document.querySelectorAll("#table .tt-row")];
        let row = null, under = null;
        for (const r of rowsNow.reverse()) {
            const [x, y] = centre(r);
            if (y < 0 || y > window.innerHeight) continue;
            hoverRow(r);
            const el = document.elementFromPoint(x, y);
            if (el && el.closest("#tooltip")) { row = r; under = el; break; }
            leave(r, document.body);
        }
        ok("sheet: a hovered row can end up under the sheet", Boolean(row),
            row ? row.querySelector(".tt-name").textContent : "none found");
        if (row) {
            const id = row.dataset.id;
            leave(row, under);
            ok("sheet: moving from the row onto the sheet keeps it open",
                open() && window.app.selected && window.app.selected.id === id,
                `open=${open()} selected=${window.app.selected && window.app.selected.id}`);
            const close = document.querySelector("#tipCloseButton");
            ok("sheet: a hover preview offers the close button",
                getComputedStyle(close).display !== "none" && close.getBoundingClientRect().width > 0);

            const other = [...document.querySelectorAll("#table .tt-row")].find((r) => {
                const [, y] = centre(r);
                return y > 0 && y < tipEl.getBoundingClientRect().top;
            });
            leave(tipEl, other);
            ok("sheet: leaving it onto another row leaves the handoff to that row", open());

            leave(tipEl, document.body);
            ok("sheet: leaving it for anywhere else dismisses the preview",
                !open() && !window.app.selected);

            hoverRow(row);
            leave(row, under);
            close.click();
            ok("sheet: the close button dismisses a hover preview",
                !open() && !window.app.selected);
        }
        window.scrollTo(0, 0);
    }

    // --- era boundaries slide, keyed on canonical era identity ---
    // civ2 -> civ3 is the pair that exercises every branch at once, and
    // the one the old raw-`d.era` key could never have matched: Ancient /
    // Ancient Times, Industrial Revolution / Industrial Ages and Modern /
    // Modern Times all survive under eraKey, Renaissance departs, and
    // Middle Ages arrives.
    setupApp("civ2");
    renderActiveView();
    const eras = () => [...document.querySelectorAll("#table div.tt-era")];
    const startCount = eras().length;
    eras().forEach((n, i) => { n.__probe = i; });

    switchTo("civ3", { animate: true });
    window.__tick(1200);

    const nowEras = eras();
    const want = window.app.wheelData.eraRanges;
    ok("era boundary count matches the new game",
        nowEras.length === want.length, `${nowEras.length} vs ${want.length}`);
    ok("surviving boundaries are moved, not re-created",
        nowEras.filter((n) => n.__probe !== undefined).length === 3,
        `${nowEras.filter((n) => n.__probe !== undefined).length}/3 carried ` +
        `(started with ${startCount})`);
    const tops = nowEras.map((n) => Math.round(parseFloat(n.style.top))).sort((a, b) => a - b);
    const wantTops = want.map((d) => d.first * ROW_H).sort((a, b) => a - b);
    ok("boundaries land on exact row positions",
        tops.length === wantTops.length && tops.every((t, i) => t === wantTops[i]),
        `[${tops.join(",")}] vs [${wantTops.join(",")}]`);
    ok("no stranded inline opacity on boundaries",
        nowEras.every((n) => n.style.opacity === ""),
        `${nowEras.filter((n) => n.style.opacity !== "").length} stranded`);

    // --- the arc layer travels here too ---
    const lanePart = (sel) => [...document.querySelectorAll(`#table ${sel}`)];
    const laneArcs = () => lanePart("g.tt-l-arcs line");
    const laneAll = () => [
        ...laneArcs(), ...lanePart("g.tt-l-pins line"),
        ...lanePart("g.tt-l-marks rect"), ...lanePart("g.tt-l-marks circle"),
    ];
    /**
     * Every positional and paint attribute of the layer, so an animated
     * settle can be compared against what the static path draws.
     *
     * Colours are canonicalised through the browser because the two paths
     * legitimately write different *notations* for the same colour: d3's
     * transition interpolator lands on `rgb(148, 103, 189)` where the
     * static `.attr()` writes `#9467bd`. Identical rendering, so comparing
     * the raw strings would fail on a difference that does not exist.
     */
    const swatch = document.body.appendChild(document.createElement("span"));
    swatch.style.display = "none";
    const canonColor = (v) => {
        if (!v) return "";
        swatch.style.color = "";
        swatch.style.color = v;
        return getComputedStyle(swatch).color || v;
    };
    const POS = ["x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "width", "height"];
    const snapshot = () => laneAll().map((n) =>
        n.tagName + ":" + POS.map((a) => n.getAttribute(a) || "").join(",")
        + ":" + canonColor(n.getAttribute("stroke")) + "/" + canonColor(n.getAttribute("fill"))
    ).sort().join("|");

    setupApp("civ4");
    renderActiveView();
    const arcsBefore = laneArcs().length;
    laneArcs().forEach((n) => { n.__probe = true; });
    ok("table arc layer drawn", arcsBefore > 0, `${arcsBefore} arcs`);

    switchTo("civ5", { animate: true });
    let faintest = 1;
    for (let i = 0; i < 45; i++) {
        window.__tick(16);
        const live = laneArcs();
        if (live.length) {
            faintest = Math.min(faintest, Math.max(...live.map(
                (n) => parseFloat(getComputedStyle(n).opacity) || 0)));
        }
    }
    ok("table arc layer never goes faint mid-switch", faintest > 0.5,
        `faintest peak opacity seen: ${faintest.toFixed(2)}`);
    window.__tick(1200);

    const wantArcs = WHEEL.civ5.prerequisites.filter((d) => Number.isFinite(d.step)).length;
    ok("table arc count matches the new game", laneArcs().length === wantArcs,
        `${laneArcs().length} vs ${wantArcs}`);
    ok("surviving table arcs are moved, not re-created",
        laneArcs().filter((n) => n.__probe).length > 10,
        `${laneArcs().filter((n) => n.__probe).length} carried`);

    // The settle has to land exactly where the static path would draw, or
    // an arc ends up parked in the wrong lane. Comparing against a real
    // static re-render of the same data is the strongest form of that.
    const settled = snapshot();
    renderActiveView();
    ok("animated settle matches a static re-render exactly",
        snapshot() === settled,
        snapshot() === settled ? "identical" : (() => {
            const a = settled.split("|"), b = snapshot().split("|");
            const d = a.map((x, i) => x === b[i] ? null : `${x}  =>  ${b[i]}`)
                .filter(Boolean).slice(0, 2);
            return `${a.filter((x, i) => x !== b[i]).length} differ; e.g. ${d.join(" ;; ")}`;
        })());
    ok("no stranded inline opacity across the table arc layer",
        laneAll().every((n) => n.style.opacity === ""),
        `${laneAll().filter((n) => n.style.opacity !== "").length} stranded`);

    note.push(`table arcs: ${arcsBefore} -> ${laneArcs().length}, ` +
        `${laneAll().length} elements in the layer`);
}

/* ---------------------------- tooltip ------------------------------- */

/**
 * The wheel's tooltip docks to a corner of the SVG, and has to stay docked
 * when the page scrolls. It used to be position:fixed, placed once from the
 * SVG's viewport rect, so a box docked below the fold stayed below it no
 * matter how far you scrolled. At this viewport the SVG is taller than the
 * window, which is exactly that case.
 */
function tooltipChecks() {
    setupApp("civ4");
    renderActiveView();
    ok("wheel view is active for these checks", !isTableView());

    const tip = document.querySelector("#tooltip");
    const svgEl = document.querySelector("#chart svg");
    const offset = () => {
        const t = tip.getBoundingClientRect();
        const r = svgEl.getBoundingClientRect();
        return { x: t.left - r.left, y: t.top - r.top, bottom: t.bottom };
    };

    // The first advance whose tooltip lands partly below the viewport.
    window.scrollTo(0, 0);
    const techs = window.app.wheelData.allTechs;
    const below = techs.find((t) => {
        showTooltip(t);
        return offset().bottom > window.innerHeight;
    });
    ok("some tooltip starts below the fold at this viewport", Boolean(below),
        `svg ${svgEl.getBoundingClientRect().height.toFixed(0)}px tall, ` +
        `window ${window.innerHeight}px`);
    if (!below) return;

    const before = offset();
    const dy = Math.ceil(before.bottom - window.innerHeight) + 20;
    window.scrollBy(0, dy);
    const after = offset();
    ok("scrolling moves the tooltip with the wheel",
        Math.abs(after.x - before.x) < 0.5 && Math.abs(after.y - before.y) < 0.5,
        `${below.name}: offset from svg (${before.x.toFixed(1)}, ${before.y.toFixed(1)}) ` +
        `-> (${after.x.toFixed(1)}, ${after.y.toFixed(1)}) after scrolling ${window.scrollY}px`);
    ok("scrolling brings a below-the-fold tooltip into view",
        after.bottom <= window.innerHeight,
        `bottom ${after.bottom.toFixed(1)} vs window ${window.innerHeight}`);

    // Shown while already scrolled: placement has to account for the
    // offset itself, not just survive a scroll after the fact.
    showTooltip(below);
    const reshown = offset();
    ok("a tooltip shown mid-scroll docks to the same corner",
        Math.abs(reshown.x - before.x) < 0.5 && Math.abs(reshown.y - before.y) < 0.5,
        `(${reshown.x.toFixed(1)}, ${reshown.y.toFixed(1)})`);

    // The SVG scales with the page width (viewBox), so a resize moves the
    // corner the tooltip is docked to. Narrowing the page column stands in
    // for narrowing the window — the headless window can't be resized —
    // and the resize event is what the app listens for.
    window.scrollTo(0, 0);
    const container = document.querySelector(".container");
    for (const width of ["900px", ""]) {
        const prior = tip.getBoundingClientRect().top;
        container.style.maxWidth = width;
        window.dispatchEvent(new Event("resize"));
        const resized = tip.getBoundingClientRect();
        showTooltip(below);                  // where a fresh placement lands
        const fresh = tip.getBoundingClientRect();
        ok(`a resize to ${width || "full width"} re-places the open tooltip`,
            Math.abs(resized.left - fresh.left) < 0.5 &&
            Math.abs(resized.top - fresh.top) < 0.5 &&
            Math.abs(fresh.top - prior) > 1,
            `top ${prior.toFixed(1)} -> ${resized.top.toFixed(1)}, ` +
            `fresh placement ${fresh.top.toFixed(1)}`);
        ok(`after a resize to ${width || "full width"} the tooltip stays inside the wheel`,
            resized.bottom <= svgEl.getBoundingClientRect().bottom + 0.5,
            `tooltip bottom ${resized.bottom.toFixed(1)}, ` +
            `svg bottom ${svgEl.getBoundingClientRect().bottom.toFixed(1)}`);
    }

    // A hidden tooltip keeps its layout box, and an absolutely positioned
    // one counts toward the page's scrollable area wherever it was left.
    hideTooltip();
    ok("a hidden tooltip parks at the top-left",
        tip.style.left === "" && tip.style.top === "",
        `left=${tip.style.left || "''"} top=${tip.style.top || "''"}`);
    window.scrollTo(0, 0);

    tooltipCornerChecks();
    detailsHintChecks();
}

/**
 * Viewport points along the outline of every element the wheel draws
 * undimmed for the current selection, read from the rendered DOM through
 * each element's own screen CTM. Deliberately independent of tooltip.js's
 * geometry model (which works from wheelData): this is what's on screen.
 * No clearance is added, so "covers" here means overlapping actual ink.
 */
function litInkPoints() {
    const pts = [];
    const push = (el, x, y) => {
        const m = el.getScreenCTM();
        pts.push({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
    };
    const boxes = document.querySelectorAll(
        "#chart .tech-image:not(.fade), #chart g.tech-labels text:not(.fade), " +
        "#chart g.unlock-squares rect:not(.fade), #chart g.unlock-circles circle:not(.fade)");
    for (const el of boxes) {
        const b = el.getBBox();
        for (let x = b.x; x <= b.x + b.width; x += 2) {
            for (let y = b.y; y <= b.y + b.height; y += 2) push(el, x, y);
        }
    }
    const paths = document.querySelectorAll(
        "#chart g.selected-spokes path, #chart g.selected-arcs path, " +
        "#chart g.unlock-pins path:not(.fade)");
    for (const el of paths) {
        const len = el.getTotalLength();
        for (let l = 0; l <= len; l += 2) {
            const p = el.getPointAtLength(l);
            push(el, p.x, p.y);
        }
    }
    return pts;
}

const covers = (rect, pts) => pts.some((p) =>
    p.x > rect.left && p.x < rect.right && p.y > rect.top && p.y < rect.bottom);

/** The four rects tooltip.js can dock to, rebuilt from the SVG's rect the
 *  way its CORNERS table does (10px margin, clamped inside the SVG). */
function cornerRects(w, h) {
    const r = document.querySelector("#chart svg").getBoundingClientRect();
    const at = (left, top) => {
        left = Math.max(r.left, Math.min(r.right - w, left));
        top = Math.max(r.top, Math.min(r.bottom - h, top));
        return { left, top, right: left + w, bottom: top + h };
    };
    return [
        at(r.left + 10, r.top + 10), at(r.right - 10 - w, r.top + 10),
        at(r.right - 10 - w, r.bottom - 10 - h), at(r.left + 10, r.bottom - 10 - h),
    ];
}

/**
 * Corner choice, checked over every advance of several wheels in the two
 * scroll positions it exists for: the wheel's top on screen with its
 * bottom below the fold, and the mirror image.
 */
function tooltipCornerChecks() {
    const tip = document.querySelector("#tooltip");
    // Looked up live: setupApp replaces the SVG, and a reference taken
    // before it measures as a detached 0×0 box.
    const svgRect = () => document.querySelector("#chart svg").getBoundingClientRect();
    const H = document.documentElement.clientHeight;
    const onScreen = (c) => c.top >= 0 && c.bottom <= H;
    // tooltip.js keeps a clearance margin around lit ink that this doesn't,
    // so a corner that only clears the ink by less than that doesn't count
    // as one it should have used.
    const inflate = (c, m) => ({
        left: c.left - m, top: c.top - m, right: c.right + m, bottom: c.bottom + m });

    const scenarios = [
        // The svg's top a quarter of the way down the window: its bottom
        // is well below the fold at this viewport (svg ≈ window height).
        { label: "bottom below the fold", top: () => H * 0.25, cut: true },
        { label: "top above the fold", top: () => H * 0.75 - svgRect().height, cut: true },
        // Fits at this viewport (svg ≈ 870px, window ≈ 910px). Here the
        // choice differs from the old angle-only rule only where that
        // rule's pick covered lit ink.
        { label: "whole wheel on screen", top: () => (H - svgRect().height) / 2, cut: false },
    ];

    // The page ends shortly below the wheel, so without room to scroll
    // into, the browser clamps the "top above the fold" position until
    // the whole wheel is back on screen — and that scenario silently
    // checks nothing. Each scenario asserts it was actually reached.
    document.body.style.paddingBottom = `${H}px`;

    for (const game of ["civ4", "civ5", "civ7"]) {
        setupApp(game);
        renderActiveView();
        for (const sc of scenarios) {
            window.scrollTo(0, 0);
            window.scrollTo(0, svgRect().top - sc.top());
            const sr = svgRect();
            const reached = Math.abs(sr.top - sc.top()) < 1 &&
                (sr.top < 0 || sr.bottom > H) === sc.cut;
            ok(`${game}, ${sc.label}: scenario reached`, reached,
                `svg ${sr.top.toFixed(0)}..${sr.bottom.toFixed(0)}, window ${H}`);
            if (!reached) continue;

            const covered = [], hidden = [];
            let shown = 0, total = 0, inked = 0;
            for (const t of window.app.wheelData.allTechs) {
                window.app.selected = t;            // re-renders, as hover does
                showTooltip(t);
                const r = tip.getBoundingClientRect();
                const ink = litInkPoints();
                const corners = cornerRects(r.width, r.height);
                total++;
                if (onScreen(r)) shown++;
                if (covers(r, ink)) inked++;
                // Never on top of the selection when some corner avoids it.
                if (corners.some((c) => !covers(c, ink)) && covers(r, ink)) covered.push(t.name);
                // Never off screen when a corner is clear and on screen.
                if (!onScreen(r) && corners.some((c) => onScreen(c) && !covers(inflate(c, 16), ink))) {
                    hidden.push(t.name);
                }
            }
            window.app.selected = null;
            hideTooltip();

            ok(`${game}, ${sc.label}: never covers lit ink when a corner avoids it`,
                covered.length === 0, covered.slice(0, 5).join(", ") || `${total} advances`);
            ok(`${game}, ${sc.label}: never off screen when a clear corner is on screen`,
                hidden.length === 0, hidden.slice(0, 5).join(", ") || `${total} advances`);
            note.push(`${game}, ${sc.label}: ${shown}/${total} tooltips fully on screen, ` +
                `${inked} over lit ink`);
        }
    }
    document.body.style.paddingBottom = "";
    window.scrollTo(0, 0);
}

/**
 * The "Details above/below" hint: shown exactly when the wheel's tooltip
 * is mostly off screen, informational until pinned, then a button that
 * scrolls the tooltip into view and hands focus to its close button.
 */
function detailsHintChecks() {
    const tip = document.querySelector("#tooltip");
    const hint = document.querySelector("#details-hint");
    const H = document.documentElement.clientHeight;
    const svgRect = () => document.querySelector("#chart svg").getBoundingClientRect();
    const seen = (r) => Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)) / r.height;

    setupApp("civ4");
    renderActiveView();
    document.body.style.paddingBottom = `${H}px`;  // room to scroll the top off
    window.scrollTo(0, 0);
    window.scrollTo(0, svgRect().top - (H * 0.75 - svgRect().height));

    const techs = window.app.wheelData.allTechs;
    const show = (t) => { window.app.selected = t; showTooltip(t); return tip.getBoundingClientRect(); };
    const off = techs.find((t) => seen(show(t)) < 0.5);
    const on = techs.find((t) => seen(show(t)) === 1);
    ok("hint: some tooltip is mostly off screen in this position", Boolean(off && on),
        `off: ${off && off.name}, on: ${on && on.name}`);
    if (!off || !on) return;

    show(on);
    ok("hint: hidden while the tooltip is on screen", !hint.classList.contains("shown"), on.name);

    const r = show(off);
    const h = hint.getBoundingClientRect();
    const above = (r.top + r.bottom) / 2 < H / 2;
    ok("hint: shown while the tooltip is mostly off screen", hint.classList.contains("shown"),
        `${off.name}: tooltip ${r.top.toFixed(0)}..${r.bottom.toFixed(0)}, window ${H}`);
    ok("hint: sits inside the viewport", h.top >= 0 && h.bottom <= H && h.left >= 0 &&
        h.right <= document.documentElement.clientWidth,
        `${h.left.toFixed(0)},${h.top.toFixed(0)} ${h.width.toFixed(0)}×${h.height.toFixed(0)}`);
    ok("hint: points the way the tooltip went",
        hint.textContent.includes(above ? "above" : "below"), hint.textContent);
    ok("hint: a preview is informational, not a control",
        hint.disabled && hint.getAttribute("aria-hidden") === "true" &&
        hint.textContent.includes("to pin"), hint.textContent);

    window.app.pinned = off;
    show(off);
    ok("hint: a pin makes it a button",
        !hint.disabled && !hint.hasAttribute("aria-hidden") && hint.classList.contains("now") &&
        !hint.textContent.includes("to pin"), hint.textContent);

    // Smooth scrolling runs on the compositor, outside the stubbed clock,
    // so the click's scroll is made instant to observe where it lands.
    const scrollBy = window.scrollBy;
    window.scrollBy = (o) => scrollBy.call(window, { top: o.top, behavior: "instant" });
    hint.focus();
    hint.click();
    window.scrollBy = scrollBy;
    const after = tip.getBoundingClientRect();
    ok("hint: clicking scrolls the whole tooltip into view", after.top >= 0 && after.bottom <= H,
        `tooltip ${after.top.toFixed(0)}..${after.bottom.toFixed(0)}, window ${H}`);
    ok("hint: focus moves on to the tooltip's close button",
        document.activeElement === document.querySelector("#tipCloseButton"),
        document.activeElement && (document.activeElement.id || document.activeElement.tagName));
    window.dispatchEvent(new Event("scroll"));
    window.__tick(16);
    ok("hint: gone once the tooltip is on screen", !hint.classList.contains("shown"));

    show(off);  // re-placed for this scroll position, which may move it
    hideTooltip();
    ok("hint: hidden with the tooltip", !hint.classList.contains("shown"));

    window.app.pinned = null;
    window.app.selected = null;
    document.body.style.paddingBottom = "";
    window.scrollTo(0, 0);
}

/* ---------------------- hover during a switch ------------------------ */

/**
 * Hovering while a switch is animating triggers the static draw path in
 * the middle of the animated one. The two have to agree on which node is
 * which: during a switch, a continuing icon briefly has two nodes (old art
 * leaving, new art arriving), and every layer has exiting nodes that are
 * fading out and will remove themselves. A static join that binds to a
 * leaving node keeps the one that's about to disappear.
 *
 * Inspected after the animation settles *without* another render, since
 * the next static render repairs the damage — which is exactly why, in
 * the app, hovering again made the missing icons come back.
 */
function hoverSwitchChecks() {
    const hover = () => {
        const techs = window.app.wheelData.allTechs;
        window.app.selected = techs[Math.floor(techs.length / 3)];   // hover in...
        window.__tick(80);
        window.app.selected = null;                                  // ...and out
    };
    const cases = [];
    for (const [from, to] of [["civ4", "civ5"], ["civ5", "civ7"], ["civ7", "civ4"]]) {
        // null: no hover at all — the control, so a failure elsewhere is
        // known to come from the hover and not the switch itself.
        for (const at of [null, 60, 250, 500]) cases.push({ path: [from, to], at });
    }
    // Rapid switching back to where it started: the second switch reclaims
    // nodes the first marked leaving (their ids return), which is the path
    // that has to clear the mark again.
    cases.push({ path: ["civ4", "civ5", "civ4"], at: 200 });
    cases.push({ path: ["civ5", "civ7", "civ5"], at: 200 });

    for (const { path, at } of cases) {
        {
            setupApp(path[0]);
            window.app.game = path[0];
            renderActiveView();
            for (const game of path.slice(1)) {
                switchTo(game, { animate: true });
                if (at !== null) {
                    window.__tick(at);
                    hover();
                }
            }
            window.__tick(1500);

            const techs = window.app.wheelData.allTechs;
            const wd = window.app.wheelData;
            const label = `${path.join("→")}, ${at === null ? "no hover" : `hover at ${at}ms`}`;
            const ids = (nodes) => nodes.map((n) => n.__data__ && n.__data__.id);
            const sameIds = (nodes, want) => {
                const got = ids(nodes);
                const w = new Set(want);
                return got.length === w.size && new Set(got).size === got.length &&
                    got.every((id) => w.has(id));
            };
            const missing = (nodes, want) => {
                const got = new Set(ids(nodes));
                return want.filter((id) => !got.has(id));
            };
            const nameOf = new Map(techs.map((t) => [t.id, t.name]));
            const visible = (n) => n.getAttribute("opacity") !== "0" && n.style.opacity !== "0";

            const icons = [...document.querySelectorAll("#chart .tech-image")];
            const labels = [...document.querySelectorAll("#chart g.tech-labels text")];
            const spokes = [...document.querySelectorAll("#chart g.spokes .spoke-line")];
            const techIds = techs.map((t) => t.id);
            ok(`${label}: one icon per advance`, sameIds(icons, techIds) && icons.every(visible),
                `${icons.length} icons for ${techIds.length}; missing ` +
                (missing(icons, techIds).map((id) => nameOf.get(id)).slice(0, 5).join(", ") || "none"));
            ok(`${label}: one label per advance, reading its own name`,
                sameIds(labels, techIds) && labels.every(visible) &&
                labels.every((n) => n.textContent === nameOf.get(n.__data__.id)),
                `${labels.length} labels for ${techIds.length}; missing ` +
                (missing(labels, techIds).map((id) => nameOf.get(id)).slice(0, 5).join(", ") || "none"));
            ok(`${label}: labels settle where the static path puts them`,
                labels.every((n) => n.getAttribute("transform") ===
                    wheelTransform(techs.length, n.__data__.position, wd.labelRadius)),
                `${labels.filter((n) => n.getAttribute("transform") !==
                    wheelTransform(techs.length, n.__data__.position, wd.labelRadius)).length} misplaced`);
            ok(`${label}: one spoke per advance`,
                sameIds(spokes, wd.spokeData.map((d) => d.id)) && spokes.every(visible),
                `${spokes.length} spokes for ${wd.spokeData.length}`);

            const arcs = wd.prerequisites.filter((p) => Number.isFinite(p.step)).length;
            const count = (sel) => document.querySelectorAll(`#chart ${sel}`).length;
            ok(`${label}: arc layer complete`,
                count("g.arcs path") === arcs && count("g.unlock-pins path") === arcs &&
                count("g.unlock-squares rect") === wd.squareData.length &&
                count("g.unlock-circles circle") === wd.circleData.length,
                `${count("g.arcs path")}/${arcs} arcs, ${count("g.unlock-pins path")} pins, ` +
                `${count("g.unlock-squares rect")}/${wd.squareData.length} squares, ` +
                `${count("g.unlock-circles circle")}/${wd.circleData.length} circles`);
            ok(`${label}: era layers complete`,
                count("g.era-backgrounds path") === wd.eraRanges.length &&
                count("g.era-labels text") >= wd.eraRanges.length,
                `${count("g.era-backgrounds path")} wedges, ${count("g.era-labels text")} labels ` +
                `for ${wd.eraRanges.length} eras`);
        }
    }
}

/* ------------------------------- driver ------------------------------ */

// Wrapped in an async IIFE so a suite can await if it needs to. None do
// at the moment — every check runs synchronously against the stubbed
// clock — but if one ever drains microtasks, the rule is that it may only
// await already-resolved promises, never a timer: --dump-dom snapshots
// the page on the load event, and a task would land after it. That is
// also why the results are written from *inside* this function rather
// than after it. (No top-level await: the bundle is iife.)
(async () => {
    try {
        // Order matters: "#keyboard-table" contains "table".
        if (location.hash.includes("keyboard")) keyboardChecks();
        else if (location.hash.includes("layout")) layoutChecks();
        else if (location.hash.includes("arcs")) arcChecks();
        else if (location.hash.includes("tooltip")) tooltipChecks();
        else if (location.hash.includes("hover-switch")) hoverSwitchChecks();
        else if (location.hash.includes("table")) tableChecks();
        else motionChecks();
    } catch (e) {
        ok("suite ran without throwing", false, `${e && e.message}\n${e && e.stack}`);
    }

    // Built with DOM APIs rather than an HTML string on purpose:
    // --dump-dom serialises the inlined <script> along with everything
    // else, so a literal `<pre id="check-output">` in this source would be
    // the FIRST match the runner's regex finds — it would parse this
    // file's own text instead of the results.
    const pre = document.createElement("pre");
    pre.id = "check-output";
    pre.textContent = JSON.stringify({ results, note });
    document.body.appendChild(pre);
})();
