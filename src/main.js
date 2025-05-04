import { scaleOrdinal } from "d3-scale";
import { schemeCategory10 } from "d3-scale-chromatic";
import { pointer, select, selectAll } from "d3-selection";

import makeWheel from "./makeWheel";

const CIV = {
  arcBase: 100,
  arcSpace: 14,
  arcWidth: 1.5,
  color: scaleOrdinal(schemeCategory10),
  coords: [0, 0],
  game: "civ4bts",
  ilization: "CIVILIZATION_ALL",
  dataTypes: [
    "units",
    "buildings",
    "religions",
    "build",
    "resources",
    "projects",
    "promotions",
    "civics",
  ],
  width: 1200,
  height: 1200,
  angleShift: 2,
};

const wheelState = {
  color: scaleOrdinal(schemeCategory10),
  coords: [0, 0],
  empire: "CIVILIZATION_ALL",
  game: "civ4bts",
};

select("body")
  .on("mousemove", (e) => (wheelState.coords = pointer(e)))
  .on("mousedown", (e) => (wheelState.coords = pointer(e)));

const tooltip = select("#tooltip");

function makeGame(selector) {
  wheelState.game = selector.options[selector.selectedIndex].value;
  makeWheel(wheelState);
}

select("#select-expansion").on("change", function () {
  selectAll(".civ-wheel").remove();

  wheelState.empire = "CIVILIZATION_ALL";
  document.getElementById("select-empire").value = wheelState.empire;
  const selectCiv = document.getElementById("select-empire");
  selectCiv.options.length = 1;

  makeGame(this);
});

select("#tooltip").on("click", () => tooltip.classed("hidden", true));

makeGame(document.getElementById("select-expansion"));
