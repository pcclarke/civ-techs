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
import { fadeSwapLayer } from "../../src/animateWheelSwitch";
import { eraDisplayName } from "../../src/eraData";
import { prefersReducedMotion, renderActiveView, isTableView } from "../../src/renderView";
import svgInit from "../../src/svgInit";
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

    // Density drives the font down: the densest tree in the project is
    // what LABEL_SLOT_FRACTION was calibrated against (see constants.js),
    // so it must land on the minimum, while the sparsest must not.
    const fontFor = (key) => {
        const svg = freshWheel();
        computeWheelLayout(svg.techLabels, NAMES[key]);
        return parseFloat(svg.techLabels.style("font-size"));
    };
    ok("densest tree (civ4bts tech, 92) uses the minimum font",
        fontFor("civ4bts:technologies") === TECH_LABEL_FONT_MIN);
    ok("sparsest tree (civ4 civics, 20) gets a larger font",
        fontFor("civ4:civics") > TECH_LABEL_FONT_MIN);

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
        _selected: null, selected: null, pinned: null, svg,
        wheelData: structuredClone(WHEEL[game]),
    };
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

/* ---------------------- fadeSwapLayer race --------------------------- */

/**
 * Drain the microtask queue.
 *
 * fadeSwapLayer is the only function in the animators that awaits, and
 * its post-await half is a promise continuation — which window.__tick,
 * being plain synchronous JS, never lets run. So this is the one suite
 * that has to be async, and it is also why the rest of the harness has
 * never exercised that code path at all.
 *
 * Only resolved promises are awaited, never a timer, so the whole suite
 * still completes before the load event --dump-dom snapshots on.
 */
const drain = async (rounds = 20) => {
    for (let i = 0; i < rounds; i++) await Promise.resolve();
};

const arcCount = () => document.querySelectorAll("#chart g.arcs path").length;

async function raceChecks() {
    const arcs = (g) => WHEEL[g].prerequisites.length;

    // The check below distinguishes games by arc count, so it is only
    // meaningful while those counts differ.
    ok("race fixture: the three games have distinct arc counts",
        new Set([arcs("civ4"), arcs("civ7"), arcs("civ5")]).size === 3,
        `civ4=${arcs("civ4")} civ7=${arcs("civ7")} civ5=${arcs("civ5")}`);

    setupApp("civ4");
    renderActiveView();
    ok("starting layer is the first game's", arcCount() === arcs("civ4"), `${arcCount()} arcs`);

    // Switch, let the fade-out get underway, then switch again before it
    // finishes. The second call's transition interrupts the first's,
    // rejecting its .end() — and the drain is where the superseded call
    // would resume and redraw the layer from data a game out of date.
    switchTo("civ7", { animate: true });
    window.__tick(120);                       // inside FADE_OUT_MS (250)
    switchTo("civ5", { animate: true });
    // One frame, which matters: d3 resolves transition conflicts when a
    // transition *starts*, not when it is created, so this is the tick on
    // which the second call's fade-out pre-empts the first's and rejects
    // its .end(). Sampling before it (as a first version of this check
    // did) found nothing wrong even with the guard removed — the two
    // continuations then drained back to back and the stale layer existed
    // for no observable time.
    window.__tick(16);
    await drain();

    const observed = arcCount();
    ok("superseded swap does not draw its stale layer",
        observed !== arcs("civ7"),
        `${observed} arcs — civ4=${arcs("civ4")} (held, correct), civ7=${arcs("civ7")} (stale)`);
    ok("the layer is still the outgoing game's while the new fade-out runs",
        observed === arcs("civ4"), `${observed} arcs`);

    window.__tick(500);
    await drain();
    window.__tick(500);
    await drain();
    ok("the newest switch owns the layer once settled",
        arcCount() === arcs("civ5"), `${arcCount()} arcs, expected ${arcs("civ5")}`);

    // Two independent swaps share one group in makeTable: the req squares
    // and the opt circles both live in its marks layer. A generation
    // counter keyed by group alone would make the second evict the first.
    const probe = select("#chart svg").append("g").attr("class", "probe-layer");
    probe.append("rect");
    probe.append("circle");
    fadeSwapLayer(probe, "rect", (g) =>
        g.selectAll("rect").data([1, 2, 3]).join("rect"));
    fadeSwapLayer(probe, "circle", (g) =>
        g.selectAll("circle").data([1, 2]).join("circle"));
    for (let i = 0; i < 4; i++) { window.__tick(400); await drain(); }
    ok("two swaps sharing a group don't cancel each other",
        probe.selectAll("rect").size() === 3 && probe.selectAll("circle").size() === 2,
        `${probe.selectAll("rect").size()} rects, ${probe.selectAll("circle").size()} circles`);
    probe.remove();
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
}

/* ------------------------------- driver ------------------------------ */

// Async because the race suite has to drain microtasks; every other
// suite stays synchronous. Only resolved promises are ever awaited —
// never a timer — so this finishes before the load event --dump-dom
// snapshots on, which is also why the results are written from *inside*
// the async function rather than after it. (No top-level await: the
// bundle is iife, which doesn't support it.)
(async () => {
    try {
        if (location.hash.includes("layout")) layoutChecks();
        else if (location.hash.includes("table")) tableChecks();
        else if (location.hash.includes("race")) await raceChecks();
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
