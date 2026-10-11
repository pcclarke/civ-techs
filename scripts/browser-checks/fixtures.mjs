/**
 * Emits the fixture module the browser checks import.
 *
 * Runs in Node (bundled by run.mjs, because src/ uses extensionless
 * imports that bare Node won't resolve) and mirrors the data pipeline in
 * src/initWheelData.js up to the point where the browser takes over. The
 * radii are deliberately NOT computed here — they come from measuring
 * rendered text, which is the whole reason these checks need a browser.
 */
import fs from "node:fs";
import path from "node:path";

import { getEraOrdering, computeEraRanges } from "../../src/eraData";
import { depthSortTechnologies } from "../../src/depthSortTechnologies";
import createUnlocks from "../../src/createUnlocks";
import { setupSpokes } from "../../src/setupSpokes";

/** Every game/tree combination, so the layout checks see the real spread
 *  of densities — 20 nodes (Civ 4 civics) to 92 (Civ 4 BTS tech). */
const TREES = [
    ["civ1", "technologies"], ["civ2", "technologies"], ["civ3", "technologies"],
    ["civ4", "technologies"], ["civ4", "civics"], ["civ4bts", "technologies"],
    ["civ5bnw", "technologies"], ["civ6gs", "technologies"], ["civ6gs", "civics"],
    ["civ7", "technologies"], ["civ7", "civics"],
];

/** Games the render checks switch between; needs the full wheelData shape. */
const RENDERABLE = ["civ4", "civ5", "civ7"];

function nodesFor(game, key) {
    const file = path.join("public", game, "civdata.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    const raw = data[key] || data.technologies || [];
    return raw.filter((n) => n.kind !== "Era");
}

/** The slice of src/initWheelData.js that doesn't need a DOM. */
function wheelDataFor(game, key = "technologies") {
    const nodes = nodesFor(game, key);
    const sorted = depthSortTechnologies(nodes, getEraOrdering(nodes));
    const { allTechs, prerequisites } = createUnlocks(sorted);
    const spokeData = setupSpokes(allTechs, prerequisites);
    const eraRanges = computeEraRanges(sorted);

    const squareData = [];
    const circleData = [];
    for (const u of prerequisites) {
        for (const r of u.reqFor || []) squareData.push({ ...r, step: u.step, arcId: u.id });
        for (const o of u.optFor || []) circleData.push({ ...o, step: u.step, arcId: u.id });
    }
    return { allTechs, prerequisites, spokeData, squareData, circleData, eraRanges };
}

const NAMES = {};
for (const [game, key] of TREES) {
    NAMES[`${game}:${key}`] = nodesFor(game, key).map((n) => ({ name: n.name }));
}

const WHEEL = {};
for (const game of RENDERABLE) WHEEL[game] = wheelDataFor(game);

const out = process.argv[2];
fs.writeFileSync(out,
    `export const NAMES = ${JSON.stringify(NAMES)};\n` +
    `export const WHEEL = ${JSON.stringify(WHEEL)};\n`);
console.error(`  fixtures: ${Object.keys(NAMES).length} trees, ` +
    `${Object.keys(WHEEL).length} renderable, ${(fs.statSync(out).size / 1024).toFixed(0)}KB`);
