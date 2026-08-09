import { defineConfig } from "vite";

export default defineConfig({
    // Relative asset URLs. GitHub Pages serves this project at
    // /civ-techs/ rather than the domain root, so absolute "/assets/..."
    // paths would 404 there. Emitting "./assets/..." instead keeps the
    // build working at any depth without hard-coding the repo name, and
    // the dev server (which serves from /) is unaffected.
    base: "./",
});
