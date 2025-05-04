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

  // Populate select civilizations drop-down
  data.civilizations.forEach(function (c) {
    select("#select-empire").append("option").attr("value", c.id).text(c.name);
  });

  drawWheel();

  // Draw portions of the wheel
  function drawWheel() {
    const wheel = svg
      .append("g")
      .attr("class", "wheel")
      .attr("transform", "translate(" + width / 2 + " " + height / 2 + ")");

    wheel
      .append("image") // pie "slice" to indicate start of spokes
      .attr("id", "startSlice")
      .attr("x", 0)
      .attr("y", -(height / 2))
      .attr("width", 167)
      .attr("height", height / 2)
      .attr("xlink:href", "img/startSlice.png");

    var spokeAll = wheel.append("g").attr("class", "spokeAll");

    var spokes = spokeAll
      .selectAll(".spoke")
      .data(data.displayed)
      .enter()
      .append("g")
      .attr("class", function (d) {
        var className = d.id + " spoke";
        return className;
      })
      .attr("transform", function (d) {
        var ang = d.pos * (360 / data.displayed.length) + angleShift;
        return "rotate(" + ang + ")";
      })
      .on("click", function (d) {});

    var spokeLine = spokes
      .append("line") // Spoke lines from center
      .attr("class", "spokeLine")
      .attr("x1", 0)
      .attr("y1", function (d) {
        if (!d.requires && !d.optional) {
          return 0;
        }
        return -(arcBase + arcSpace * d.spokeRank);
      })
      .attr("x2", 0)
      .attr("y2", function (d) {
        return -(width / 2) + 160 - d.unlocks.length * 14;
      });

    var techIcons = spokes
      .append("image") // Displayed item icons
      .attr("class", "techImg")
      .attr("transform", function (d) {
        if (d.pos > data.displayed.length / 2) {
          return "translate(10, " + (-(width / 2) + 157) + ") rotate(90)";
        }
        return "translate(-10, " + (-(width / 2) + 182) + ") rotate(270)";
      })
      .attr("height", 25)
      .attr("width", 25)
      .attr("xlink:href", function (d) {
        var link;
        if (d.cat === "units" || d.cat === "buildings") {
          if (d[empire]) {
            link =
              game + "/img/" + d.cat + "/" + d[wheelState.empire].id + ".png";
          } else {
            link =
              game + "/img/" + d.cat + "/" + d.CIVILIZATION_ALL.id + ".png";
          }
        } else {
          link = game + "/img/" + d.cat + "/" + d.id + ".png";
        }
        return link;
      })
      .on("mouseover", function (_, d) {
        var tipName = "";
        if (d.cat === "units" || d.cat === "buildings") {
          if (d[wheelState.empire]) {
            tipName = d[wheelState.empire].name;
          } else {
            tipName = d.CIVILIZATION_ALL.name;
          }
        } else {
          tipName = d.name;
        }
        spokeHighlightIn(d, data, color);
      })
      .on("mouseout", function (_, d) {
        //d3.select("#tooltip").classed("hidden", true);
        spokeHighlightOut(d);
      })
      .on("click", function (_, d) {
        displayDetailsBox(d, d.pos, wheelState, data);
      });

    var unlocks = spokes
      .selectAll(".unlocks")
      .data(function (d) {
        return d.unlocks;
      })
      .enter()
      .filter(function (d) {
        if (d.arcEnd || d.arcBack) {
          return true;
        }
        return false;
      })
      .append("g")
      .attr("class", function (d) {
        return "unlock opaque " + d.ref.id + "" + d.pos;
      });

    var unlockArcs = unlocks
      .append("path")
      .attr("class", function (d) {
        return "unlockArc";
      })
      .attr("rank", function (d) {
        return d.rank;
      })
      .style("fill", function (d) {
        return color(d.pos);
      })
      .attr("d", unlockArc);

    var unlockSquares = unlocks
      .selectAll(".unlockSquare")
      .data(function (d) {
        return d.lreq;
      })
      .enter()
      .append("g")
      .attr("transform", function (d) {
        var ang = d.dist * (360 / data.displayed.length);
        return (
          "rotate(" +
          ang +
          ") translate(0, " +
          (-(width / 2) + 145 - 14 * d.arcRank) +
          ")"
        );
      })
      .attr("class", "unlockSquare");

    unlockSquares
      .append("rect")
      .attr("x", -2.5)
      .attr("y", -0.75)
      .attr("width", 5)
      .attr("height", 5)
      .attr("fill", function (d) {
        return color(d.pos);
      });

    var unlockIcons = spokes
      .selectAll(".unlockIcon")
      .data(function (d) {
        return d.unlocks;
      })
      .enter()
      .append("image")
      .attr("class", "unlockIcon")
      .attr("transform", function (d) {
        if (d.pos > data.displayed.length / 2) {
          return (
            "translate(6, " +
            (-(width / 2) + (142 - 14 * d.rank)) +
            ") rotate(90)"
          );
        }
        return (
          "translate(-6, " +
          (-(width / 2) + (153 - 14 * d.rank)) +
          ") rotate(270)"
        );
      })
      .attr("height", 13)
      .attr("width", 13)
      .attr("xlink:href", function (d) {
        var link;
        if (
          (d.ref.cat === "units" || d.ref.cat === "buildings") &&
          !(game === "civ1" || game === "civ2")
        ) {
          if (d.ref[wheelState.empire]) {
            link =
              game +
              "/img/" +
              d.ref.cat +
              "/" +
              d.ref[wheelState.empire].id +
              ".png";
          } else {
            link =
              game +
              "/img/" +
              d.ref.cat +
              "/" +
              d.ref.CIVILIZATION_ALL.id +
              ".png";
          }
        } else {
          link = game + "/img/" + d.ref.cat + "/" + d.ref.id + ".png";
        }
        return link;
      })
      .on("mouseover", function (_, d) {
        selectAll(".unlockIcon").classed("fade", true);
        selectAll("." + d.ref.id + "" + d.pos).classed("opaque", false);
        select(this).classed("fade", false);

        // spokeHighlightIn(d.ref, data, wheelState.color);
      })
      .on("mouseout", function (d) {
        selectAll(".unlockIcon").classed("fade", false);
        selectAll(".unlock").classed("opaque", true);

        // spokeHighlightOut(d.ref);
      })
      .on("click", function (d) {
        displayDetailsBox(d.ref, d.pos, wheelState, data);
      });

    // Update icons with unique civilization units
    select("#select-empire").on("change", function (d) {
      wheelState.empire = this.options[this.selectedIndex].value;
      select("#description").classed("hidden", true);

      unlockIcons.attr("xlink:href", function (d) {
        var link;
        if (d.ref.cat === "units" || d.ref.cat === "buildings") {
          if (d.ref[wheelState.empire]) {
            link =
              game +
              "/img/" +
              d.ref.cat +
              "/" +
              d.ref[wheelState.empire].id +
              ".png";
          } else {
            link =
              game +
              "/img/" +
              d.ref.cat +
              "/" +
              d.ref.CIVILIZATION_ALL.id +
              ".png";
          }
        } else {
          link = game + "/img/" + d.ref.cat + "/" + d.ref.id + ".png";
        }
        return link;
      });
    });

    var reqArcs = wheel.append("g").attr("class", "reqArcs");

    var reqGroup = reqArcs
      .selectAll(".reqGroup")
      .data(data.displayed)
      .enter()
      .append("g")
      .attr("class", function (d) {
        var className = d.id + " reqGroup";
        return className;
      })
      .attr("transform", function (d) {
        var ang = d.pos * (360 / data.displayed.length) + angleShift;
        return "rotate(" + ang + ")";
      })
      .on("click", function (d) {});

    var reqArc = reqGroup
      .append("path")
      .attr("class", "spokeArc")
      .style("fill", function (d) {
        return color(d.pos);
      })
      .attr("d", linkArc);

    var reqPin = reqGroup
      .append("line")
      .attr("class", "spokePin")
      .attr("x1", 0)
      .attr("y1", function (d) {
        return -(arcBase + 7 + arcSpace * d.arcRank);
      })
      .attr("x2", 0)
      .attr("y2", function (d) {
        return -(arcBase - 5 + arcSpace * d.arcRank);
      })
      .attr("stroke-width", arcWidth)
      .attr("stroke", function (d) {
        return color(d.pos);
      });

    var reqSquares = reqGroup
      .selectAll(".reqSquare")
      .data(function (d) {
        return d.lreq;
      })
      .enter()
      .append("g")
      .attr("transform", function (d) {
        var ang = d.dist * (360 / data.displayed.length);
        return (
          "rotate(" +
          ang +
          ") translate(0, " +
          (-arcBase - 2.5 - arcSpace * d.arcRank) +
          ")"
        );
      })
      .attr("class", "reqSquare");

    reqSquares
      .append("rect")
      .attr("x", -2.5)
      .attr("y", -0.75)
      .attr("width", 5)
      .attr("height", 5)
      .attr("fill", function (d) {
        return color(d.pos);
      });

    var optCircles = reqGroup
      .selectAll(".optCircle")
      .data(function (d) {
        return d.lopt;
      })
      .enter()
      .append("g")
      .attr("transform", function (d) {
        var ang = d.dist * (360 / data.displayed.length);
        return (
          "rotate(" +
          ang +
          ") translate(0, " +
          (-arcBase - 2.5 - arcSpace * d.arcRank) +
          ")"
        );
      })
      .attr("class", "optCircle");

    optCircles
      .append("circle")
      .attr("cx", 0)
      .attr("cy", 2)
      .attr("r", 2.5)
      .attr("stroke-width", 1)
      .attr("stroke", function (d) {
        return color(d.pos);
      })
      .attr("fill", "white");

    // Add the center image
    wheel
      .append("image")
      .attr("x", -75)
      .attr("y", -75)
      .attr("width", 150)
      .attr("height", 150)
      .attr("xlink:href", game + "/img/" + game + "-center.png");
  }
}
