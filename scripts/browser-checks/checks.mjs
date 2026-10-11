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
import { calculatePointOnWheel } from "../../src/helpers";
import { eraAngles, eraWedge } from "../../src/drawEras";
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
}

/* ------------------------------- driver ------------------------------ */

try {
    if (location.hash.includes("layout")) layoutChecks();
    else if (location.hash.includes("table")) tableChecks();
    else motionChecks();
} catch (e) {
    ok("suite ran without throwing", false, `${e && e.message}\n${e && e.stack}`);
}

// Built with DOM APIs rather than an HTML string on purpose: --dump-dom
// serialises the inlined <script> along with everything else, so a literal
// `<pre id="check-output">` in this source would be the FIRST match the
// runner's regex finds — it would parse this file's own text instead of
// the results.
const pre = document.createElement("pre");
pre.id = "check-output";
pre.textContent = JSON.stringify({ results, note });
document.body.appendChild(pre);
