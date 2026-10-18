/**
 * Runs the browser checks in scripts/browser-checks/checks.mjs.
 *
 * No new dependencies: esbuild already ships inside Vite, and the browser
 * is whichever Chrome is installed (override with CHROME=/path).
 *
 * The page is the project's own index.html with its module script swapped
 * for the bundled checks, so the DOM and CSS under test are the real ones
 * rather than a hand-built approximation. Relative asset paths are
 * rewritten one level up because the generated page lives in a
 * subdirectory; that also makes public/ emblems resolve, which they do
 * not under a plain file:// open of index.html.
 *
 * Three runs, because the things being checked need different browser
 * states and a page can only be in one at a time:
 *   #layout   wide viewport, wheel visible   — measurement logic
 *   #motion   wide viewport                  — animates
 *   #motion-reduced  ditto, but with --force-prefers-reduced-motion
 *   #table    narrow viewport, table visible — the table's own layout
 *   #arcs     wide viewport                  — the arc layer's travel
 *   #keyboard-wheel / #keyboard-table — the same nav suite in each view
 *
 * One environment constraint worth knowing: headless Chrome on macOS
 * clamps the window to about 500px wide, so --window-size=390 still
 * reports 500. That is under the 700px breakpoint, so the table view does
 * engage and its layout is genuinely exercised — but these checks cannot
 * reach true phone widths (375px), where the names are tightest.
 *
 * Animation time is driven by a stubbed clock (see CLOCK_STUB) rather than
 * wall-clock waits. Chrome's --virtual-time-budget advances setTimeout but
 * NOT the rAF clock d3-timer runs on, which silently reports every
 * transition as barely started; and real waits can't work at all, since
 * --dump-dom captures the page the moment loading finishes.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const HERE = path.join(ROOT, "scripts", "browser-checks");
const OUT = path.join(HERE, ".generated");
const ESBUILD = path.join(ROOT, "node_modules", ".bin", "esbuild");

/**
 * Headless Chrome's sandbox relies on unprivileged user namespaces, which
 * CI images commonly restrict — so it is switched off there. Safe in that
 * context specifically: the runner is a throwaway VM executing only this
 * repository's own code, and there is no untrusted input to contain.
 *
 * Opt-in rather than unconditional, so a local run keeps its sandbox.
 * --disable-dev-shm-usage goes with it: CI containers often give /dev/shm
 * only a few megabytes, which Chrome will happily run out of.
 */
const SANDBOX_FLAGS = (process.env.CI || process.env.CHROME_NO_SANDBOX)
    ? ["--no-sandbox", "--disable-dev-shm-usage"]
    : [];

const CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
].filter(Boolean);

// d3-timer captures requestAnimationFrame at module-load time, so this
// has to run before the bundle does.
const CLOCK_STUB = `<script>
(function () {
  var CLOCK = 0, frames = [];
  window.requestAnimationFrame = function (cb) { frames.push(cb); return frames.length; };
  window.cancelAnimationFrame = function () {};
  performance.now = function () { return CLOCK; };
  window.__tick = function (ms, step) {
    step = step || 16;
    for (var done = 0; done < ms; done += step) {
      CLOCK += step;
      var batch = frames.splice(0, frames.length);
      for (var i = 0; i < batch.length; i++) batch[i](CLOCK);
    }
  };
})();
</script>`;

const RUNS = [
    { hash: "layout", label: "layout (wheel measurement)", size: "1400,1000" },
    { hash: "motion", label: "motion — no preference", size: "1400,1000" },
    { hash: "motion-reduced", label: "motion — prefers-reduced-motion", size: "1400,1000",
      flags: ["--force-prefers-reduced-motion"] },
    { hash: "table", label: "table layout (narrow viewport)", size: "390,900" },
    { hash: "arcs", label: "arc layer travel", size: "1400,1000" },
    { hash: "keyboard-wheel", label: "keyboard nav — wheel", size: "1400,1000" },
    { hash: "keyboard-table", label: "keyboard nav — table", size: "390,900" },
];

/** execFileSync, but reporting a tool's own stderr instead of burying it
 *  under a Node stack trace. */
function run(cmd, args, opts = {}) {
    try {
        return execFileSync(cmd, args, { cwd: ROOT, encoding: "utf8", ...opts });
    } catch (e) {
        const detail = (e.stderr || e.stdout || "").toString().trim();
        console.error(`\n${path.basename(cmd)} failed:\n${detail || e.message}`);
        process.exit(2);
    }
}

function findChrome() {
    // An explicit override that doesn't exist is an error, not a reason to
    // quietly use some other browser — otherwise you can think you tested
    // against the binary you named when you didn't.
    if (process.env.CHROME) {
        if (fs.existsSync(process.env.CHROME)) return process.env.CHROME;
        console.error(`CHROME is set to "${process.env.CHROME}", which does not exist.`);
        process.exit(2);
    }
    for (const c of CHROME_CANDIDATES) if (fs.existsSync(c)) return c;
    console.error("No Chrome/Chromium found. Set CHROME=/path/to/binary.");
    process.exit(2);
}

function buildPage() {
    fs.mkdirSync(OUT, { recursive: true });
    const fixtures = path.join(OUT, "fixtures.generated.js");

    // Fixtures come from the real data pipeline, so they can't drift from
    // what the app actually renders.
    const genBundle = path.join(OUT, "fixtures.cjs.mjs");
    run(ESBUILD, [path.join(HERE, "fixtures.mjs"), "--bundle", "--format=esm",
        "--platform=node", `--outfile=${genBundle}`, "--log-level=error"]);
    run(process.execPath, [genBundle, fixtures], { stdio: ["ignore", "inherit", "inherit"] });

    const bundle = path.join(OUT, "checks.bundle.js");
    run(ESBUILD, [path.join(HERE, "checks.mjs"), "--bundle", "--format=iife",
        `--outfile=${bundle}`, "--loader:.png=dataurl", "--log-level=error"]);

    let html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
    html = html
        .replace(/<script\s+src="\/src\/main\.js"[^>]*><\/script>/, "")
        .replace(/href="css\//g, 'href="../../../css/')
        .replace(/src="img\//g, 'src="../../../img/')
        .replace(/src="(civ\d[a-z]*)\//g, 'src="../../../public/$1/');
    // Function replacement, not a string: a bundle containing `$&` or `$\'`
    // would otherwise be mangled by replace()'s substitution patterns.
    const injected = `${CLOCK_STUB}\n<script>\n${fs.readFileSync(bundle, "utf8")}\n</script>\n</body>`;
    html = html.replace("</body>", () => injected);

    const page = path.join(OUT, "page.html");
    fs.writeFileSync(page, html);
    return page;
}

function runOne(chrome, page, spec) {
    const args = [
        "--headless", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--allow-file-access-from-files", ...SANDBOX_FLAGS, `--window-size=${spec.size}`,
        ...(spec.flags || []), "--dump-dom", `file://${page}#${spec.hash}`,
    ];
    const dom = run(chrome, args, { stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 64 * 1024 * 1024 });
    const all = [...dom.matchAll(/<pre id="check-output">([\s\S]*?)<\/pre>/g)];
    const m = all.length ? all[all.length - 1] : null;
    if (!m) return { results: [{ name: "page produced output", pass: false,
        detail: "no #check-output element — the suite probably threw before rendering" }], note: [] };
    const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    return JSON.parse(decode(m[1]));
}

const chrome = findChrome();
console.log(`browser: ${path.basename(chrome)}` + (SANDBOX_FLAGS.length ? " (sandbox off: CI)" : ""));
const page = buildPage();

let total = 0;
let failed = 0;
for (const spec of RUNS) {
    const { results, note } = runOne(chrome, page, spec);
    console.log(`\n── ${spec.label} ──`);
    for (const n of note) console.log(`   · ${n}`);
    for (const r of results) {
        total++;
        if (!r.pass) failed++;
        console.log(`   ${r.pass ? "ok  " : "FAIL"} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
    }
}

console.log(`\n${total - failed}/${total} checks passed`);
if (failed) {
    console.log(`${failed} FAILED`);
    process.exit(1);
}
