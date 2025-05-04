import { json } from "d3-fetch";
import { select, selectAll } from "d3-selection";

import { linkArc, unlockArc } from "./arcs";
import {
  angleShift,
  arcBase,
  arcSpace,
  arcWidth,
  margin,
  width,
  height,
} from "./constants";
import { displayDetailsBox } from "./displayDetailsBox";
import { imageLink } from "./helpers";
import orderDisplayed from "./orderDisplayed";
import setupArcs from "./setupArcs";
import setupData from "./setupData";
import { spokeHighlightIn, spokeHighlightOut } from "./wheelInteraction";

export default async function makeWheel(wheelState) {
  const { color, game } = wheelState;
  const path = game + "/civdata.json";

  const svg = select("#chart")
    .append("svg")
    .attr("class", "civ-wheel")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  const data = await json(path);

  // json(path, function (data) {

  // Functions to process data so wheel can be drawn
  setupData(data);
  orderDisplayed(data);
  setupArcs(data);

  // // Debug processed data
  // console.log(data.displayed);

  const wheel = svg
    .selectAll(".wheel")
    .data([0])
    .join("g")
    .attr("class", "wheel")
    .attr("transform", "translate(" + width / 2 + " " + height / 2 + ")");

  wheel
    .selectAll(".start-slice") // pie "slice" to indicate start of spokes
    .data([0])
    .join("image")
    .attr("class", "start-slice")
    .attr("x", 0)
    .attr("y", -(height / 2))
    .attr("width", 167)
    .attr("height", height / 2)
    .attr("xlink:href", "img/startSlice.png");

  const spokeAll = wheel
    .selectAll("g")
    .data([0])
    .join("g")
    .attr("class", "spokes");

  const spokes = spokeAll
    .selectAll(".spoke")
    .data(data.displayed)
    .join("g")
    .attr("class", (d) => `${d.id} spoke`)
    .attr(
      "transform",
      (d) => `rotate(${d.pos * (360 / data.displayed.length) + angleShift})`
    );

  spokes
    .selectAll(".spoke-line")
    .data((d) => [d])
    .join("line")
    .attr("class", "spoke-line")
    .attr("x1", 0)
    .attr("y1", (d) =>
      !d.requires && !d.optional ? 0 : -(arcBase + arcSpace * d.spokeRank)
    )
    .attr("x2", 0)
    .attr("y2", (d) => -(width / 2) + 160 - d.unlocks.length * 14);

  spokes
    .selectAll(".technology-image")
    .data((d) => [d])
    .join("image")
    .attr("class", "technology-image")
    .attr("transform", (d) => {
      let x = -10;
      let y = -width / 2 + 182;
      let rotate = 270;

      if (d.pos > data.displayed.length / 2) {
        x = 10;
        y -= 25;
        rotate = 90;
      }

      return `translate(${x}, ${y}) rotate(${rotate})`;
    })
    .attr("height", 25)
    .attr("width", 25)
    .attr("xlink:href", (d) => {
      let id = d.id;
      if (d.cat === "units" || d.cat === "buildings") {
        id = d[empire] ? d[wheelState.empire].id : d.CIVILIZATION_ALL.id;
      }

      return `${game}/img/${d.cat}/${id}.png`;
    })
    .on("mouseover", (_, d) => spokeHighlightIn(d, data, color))
    .on("mouseout", (_, d) => spokeHighlightOut(d))
    .on("click", (_, d) => displayDetailsBox(d, d.pos, wheelState, data));

  const unlocks = spokes
    .selectAll(".unlocks")
    .data((d) => d.unlocks)
    .filter(function (d) {
      if (d.arcEnd || d.arcBack) {
        return true;
      }
      return false;
    })
    .join("g")
    .attr("class", (d) => `unlock opaque ${d.ref.id}${d.pos}`);

  unlocks
    .append("path")
    .attr("class", "unlock-arc")
    .attr("rank", (d) => d.rank)
    .style("fill", (d) => color(d.pos))
    .attr("d", unlockArc);

  var unlockSquares = unlocks
    .selectAll(".unlock-square")
    .data((d) => d.lreq)
    .join("g")
    .attr("class", "unlock-square")
    .attr("transform", (d) => {
      const ang = d.dist * (360 / data.displayed.length);
      const y = -(width / 2) + 145 - 14 * d.arcRank;
      return `rotate(${ang}) translate(0, ${y})`;
    });

  unlockSquares
    .append("rect")
    .attr("x", -2.5)
    .attr("y", -0.75)
    .attr("width", 5)
    .attr("height", 5)
    .attr("fill", (d) => color(d.pos));

  var unlockIcons = spokes
    .selectAll(".unlock-icon")
    .data((d) => d.unlocks)
    .join("image")
    .attr("class", "unlock-icon")
    .attr("transform", (d) => {
      let x = -6;
      let y = -width / 2 + 153 - 14 * d.rank;
      let angle = 270;

      if (d.pos > data.displayed.length / 2) {
        x = 6;
        y -= 11;
        angle = 90;
      }

      return `translate(${x}, ${y}) rotate(${angle})`;
    })
    .attr("height", 13)
    .attr("width", 13)
    .attr("xlink:href", (d) => {
      let id = d.ref.id;

      if (d.ref.cat === "units" || d.ref.cat === "buildings") {
        id = d.ref[wheelState.empire]
          ? d.ref[wheelState.empire].id
          : d.ref.CIVILIZATION_ALL.id;
      }

      return `${game}/img/${d.ref.cat}/${id}.png`;
    })
    .on("mouseover", function (_, d) {
      //   selectAll(".unlockIcon").classed("fade", true);
      //   selectAll("." + d.ref.id + "" + d.pos).classed("opaque", false);
      //   select(this).classed("fade", false);
      // spokeHighlightIn(d.ref, data, wheelState.color);
    })
    .on("mouseout", function (d) {
      //   selectAll(".unlockIcon").classed("fade", false);
      //   selectAll(".unlock").classed("opaque", true);
      // spokeHighlightOut(d.ref);
    })
    .on("click", function (d) {
      displayDetailsBox(d.ref, d.pos, wheelState, data);
    });

  var reqArcs = wheel.append("g").attr("class", "reqArcs");

  var reqGroup = reqArcs
    .selectAll(".reqGroup")
    .data(data.displayed)
    .join("g")
    .attr("class", (d) => `${d.id} req-group`)
    .attr(
      "transform",
      (d) => `rotate(${d.pos * (360 / data.displayed.length) + angleShift})`
    );

  reqGroup
    .append("path")
    .attr("class", "spokeArc")
    .style("fill", (d) => color(d.pos))
    .attr("d", linkArc);

  reqGroup
    .append("line")
    .attr("class", "spokePin")
    .attr("x1", 0)
    .attr("y1", (d) => -(arcBase + 7 + arcSpace * d.arcRank))
    .attr("x2", 0)
    .attr("y2", (d) => -(arcBase - 5 + arcSpace * d.arcRank))
    .attr("stroke-width", arcWidth)
    .attr("stroke", (d) => color(d.pos));

  const reqSquares = reqGroup
    .selectAll(".req-square")
    .data((d) => d.lreq)
    .join("g")
    .attr("class", "req-square")
    .attr("transform", (d) => {
      var angle = d.dist * (360 / data.displayed.length);
      const y = -arcBase - 2.5 - arcSpace * d.arcRank;

      return `rotate(${angle}) translate(0, ${y})`;
    });

  reqSquares
    .append("rect")
    .attr("x", -2.5)
    .attr("y", -0.75)
    .attr("width", 5)
    .attr("height", 5)
    .attr("fill", (d) => color(d.pos));

  var optCircles = reqGroup
    .selectAll(".opt-circle")
    .data((d) => d.lopt)
    .join("g")
    .attr("class", "opt-circle")
    .attr("transform", (d) => {
      const angle = d.dist * (360 / data.displayed.length);
      const y = -arcBase - 2.5 - arcSpace * d.arcRank;

      return `rotate(${angle}) translate(0, ${y})`;
    });

  optCircles
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 2)
    .attr("r", 2.5)
    .attr("stroke-width", 1)
    .attr("stroke", (d) => color(d.pos))
    .attr("fill", "white");

  const empireSelect = select("#select-empire");

  empireSelect
    .selectAll(".empire-option")
    .data(data.civilizations)
    .join("option")
    .attr("class", "empire-option")
    .attr("value", (c) => c.id)
    .text((c) => c.name);

  empireSelect.on("change", function () {
    wheelState.empire = this.options[this.selectedIndex].value;
    select("#description").classed("hidden", true);

    unlockIcons.attr("xlink:href", (d) => {
      let id = d.ref.id;

      if (d.ref.cat === "units" || d.ref.cat === "buildings") {
        id = d.ref[wheelState.empire]
          ? d.ref[wheelState.empire].id
          : d.ref.CIVILIZATION_ALL.id;
      }

      return imageLink(game, d.ref.cat, id);
    });
  });

  wheel
    .append("image")
    .attr("x", -75)
    .attr("y", -75)
    .attr("width", 150)
    .attr("height", 150)
    .attr("xlink:href", `${game}/img/${game}-center.png`);
}
