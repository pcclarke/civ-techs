import { select } from "d3-selection";

import {
    CENTER_X,
    CENTER_Y,
    GAME_IMG_WIDTH,
    MARGIN_LEFT,
    MARGIN_TOP,
    TOTAL_WIDTH,
    TOTAL_HEIGHT
} from "./constants";
// Imported rather than referenced by path so Vite resolves it in dev and
// emits a hashed, base-prefixed asset in the build. The game icons under
// public/ can't work this way — their paths are built at runtime from the
// selected game — which is exactly why they live in public/ instead.
import startSliceUrl from "../img/startSlice.png";

export default function() {
    const groupObj = {};

    // Use a viewBox instead of fixed pixel dimensions so the SVG scales to
    // whatever space the container gives it. The internal coordinate system
    // (used by every layout calculation in the app) stays at the original
    // TOTAL_WIDTH × TOTAL_HEIGHT, so label/icon math is unchanged. CSS pins
    // the rendered size to the container's width with `max-width: 100%`.
    groupObj.wheel = select("#chart")
        .append("svg")
        .attr("class", "civ-techs")
        .attr("viewBox", `0 0 ${TOTAL_WIDTH} ${TOTAL_HEIGHT}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("class", "wheel")
        .attr("transform", `translate(${MARGIN_LEFT + CENTER_X}, ${MARGIN_TOP + CENTER_Y})`);

    // pie "slice" to indicate start of spokes
    groupObj.wheel
        .append("image")
        .attr("class", "start-slice")
        .attr("x", 0)
        .attr("y", -CENTER_Y)
        .attr("width", 167)
        .attr("height", CENTER_Y)
        .attr("xlink:href", startSliceUrl);

    // SVG groups to organize shapes. Order is paint order — earlier groups
    // sit behind later ones. eraBackgrounds is first so its faint coloured
    // wedges sit below every other layer; eraLabels is last so the era
    // names (drawn radially inside the wheel, over the arc region) stay
    // readable on top of the arcs and spokes they cross.
    const shapeGroups = [
        { prop: "eraBackgrounds", class: "era-backgrounds" },
        { prop: "spokes", class: "spokes" },
        { prop: "selectedSpokes", class: "selected-spokes" },
        { prop: "techImages", class: "tech-images" },
        { prop: "techLabels", class: "tech-labels" },
        { prop: "arcs", class: "arcs" },
        { prop: "selectedArcs", class: "selected-arcs" },
        { prop: "unlockPins", class: "unlock-pins" },
        { prop: "unlockSquares", class: "unlock-squares" },
        { prop: "unlockCircles", class: "unlock-circles" },
        { prop: "eraLabels", class: "era-labels" }
    ];

    for (const group of shapeGroups) {
        const svgGroup = groupObj.wheel.append("g")
            .attr("class", group.class);

        groupObj[group.prop] = svgGroup;
    }

    // Civ game image center of wheel
    groupObj.centerImage = groupObj.wheel.append("image")
        .attr("x", -(GAME_IMG_WIDTH / 2))
        .attr("y", -(GAME_IMG_WIDTH / 2))
        .attr("width", GAME_IMG_WIDTH)
        .attr("height", GAME_IMG_WIDTH);

    return groupObj;
}

