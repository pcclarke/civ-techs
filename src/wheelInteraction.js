import { select, selectAll } from "d3-selection";

import { arcBase, arcSpace, arcWidth } from "./constants";
import { getTechById } from "./dataTools";
import { tempArc } from "./arcs";

// Show the name of an icon in a hover box
function displayTooltip(name, coords) {
  select("#tooltip")
    .style("left", coords[0] + "px")
    .style("top", coords[1] + "px");

  select("#tipName").text(name);

  select("#tooltip").classed("hidden", false);
}

var selLine = function (setId, setClass, toShow) {
  selectAll("." + setId)
    .selectAll(".spokeLine")
    .classed(setClass, toShow);
};

var fader = function (setId, toShow) {
  selectAll("." + setId).classed("fade", toShow);
};

var makeTempArc = function (highlighted, setId, data, color) {
  var reqD = getTechById(setId, data);
  var tempDist; // TODO: Need to include leads to!
  var tempBack;
  if (highlighted.pos > reqD.pos) {
    tempDist = highlighted.pos - reqD.pos;
    tempBack = 0;
  } else {
    tempDist = 0;
    tempBack = reqD.pos - highlighted.pos;
  }
  reqD.tempArcDist = ((2 * Math.PI) / data.displayed.length) * tempDist;
  reqD.tempArcBack = ((2 * Math.PI) / data.displayed.length) * tempBack;

  var tempArcG = select(".reqArcs") // TODO: move to reqArcs
    .select("." + reqD.id)
    .append("g")
    .attr("class", "tempArcG");

  tempArcG
    .append("path")
    .attr("class", "tempArc")
    .style("fill", (d) => color(d.pos))
    .attr("d", (d) => tempArc(d));

  tempArcG
    .append("line")
    .attr("class", "tempSpokePin")
    .attr("x1", 0)
    .attr("y1", function (d) {
      return -(arcBase + 7 + arcSpace * reqD.arcRank);
    })
    .attr("x2", 0)
    .attr("y2", function (d) {
      return -(arcBase - 5 + arcSpace * reqD.arcRank);
    })
    .attr("stroke-width", arcWidth)
    .attr("stroke", function (d) {
      return color(reqD.pos);
    });

  var tempReqSquares = tempArcG
    .selectAll(".tempReqSquare")
    .data(function (d) {
      return d.lreq;
    })
    .enter()
    .append("g")
    .filter(function (d) {
      return d.id === highlighted.id;
    })
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

  tempReqSquares
    .append("rect")
    .attr("x", -2.5)
    .attr("y", -0.75)
    .attr("width", 5)
    .attr("height", 5)
    .attr("fill", function (d) {
      return color(d.pos);
    });

  var tempOptCircles = tempArcG
    .selectAll(".tempOptCircle")
    .data(function (d) {
      return d.lopt;
    })
    .enter()
    .append("g")
    .filter(function (d) {
      return d.id === highlighted.id;
    })
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

  tempOptCircles
    .append("circle")
    .attr("cx", 0)
    .attr("cy", 2)
    .attr("r", 2.5)
    .attr("stroke-width", 1)
    .attr("stroke", function (d) {
      return color(d.pos);
    })
    .attr("fill", "white");
};

export function spokeHighlightIn(d, data, color) {
  selectAll(".spoke").classed("fade", true);
  select(".reqArcs")
    .selectAll(".reqGroup")
    .selectAll(function () {
      return this.childNodes;
    })
    .classed("fade", true);
  select("#startSlice").classed("fade", true);

  select("." + d.id).classed("fade", false);
  select(".reqArcs")
    .select("." + d.id)
    .selectAll(function () {
      return this.childNodes;
    })
    .classed("fade", false);

  if (d.requires) {
    console.log(d.requires);
    if (Array.isArray(d.requires)) {
      d.requires.forEach(function (r) {
        select(".spokes")
          .selectAll("." + r)
          .classed("fade", false)
          .select(".spoke-line")
          .attr("y1", function (rt) {
            return -(arcBase + arcSpace * rt.arcRank);
          });

        console.log(d, r, data);
        makeTempArc(d, r, data, color);
      });
    } else {
      select(".spokes")
        .selectAll("." + d.requires)
        .classed("fade", false)
        .select(".spoke-line")
        .attr("y1", function (rt) {
          return -(arcBase + arcSpace * rt.arcRank);
        });
      makeTempArc(d, d.requires, data, color);
    }
  }
  if (d.optional) {
    if (Array.isArray(d.optional)) {
      d.optional.forEach(function (o) {
        select(".spokeAll")
          .selectAll("." + o)
          .classed("fade", false)
          .select(".spokeLine")
          .attr("y1", function (ot) {
            return -(arcBase + arcSpace * ot.arcRank);
          });

        makeTempArc(d, o, data, color);
      });
    } else {
      select(".spokeAll")
        .selectAll("." + d.optional)
        .classed("fade", false)
        .select(".spokeLine")
        .attr("y1", function (ot) {
          return -(arcBase + arcSpace * ot.arcRank);
        });
      makeTempArc(d, d.optional, data, color);
    }
  }
  if (d.lreq) {
    d.lreq.forEach(function (lr) {
      select(".spokeAll")
        .selectAll("." + lr.id)
        .classed("fade", false)
        .select(".spokeLine")
        .attr("y1", -(arcBase + arcSpace * d.arcRank));
    });
  }
  if (d.lopt) {
    d.lopt.forEach(function (lo) {
      select(".spokeAll")
        .selectAll("." + lo.id)
        .classed("fade", false)
        .select(".spokeLine")
        .attr("y1", -(arcBase + arcSpace * d.arcRank));
    });
  }
}

export function spokeHighlightOut(d) {
  selectAll(".spoke")
    .classed("fade", false)
    .selectAll(".spokeLine")
    .attr("y1", function (e) {
      if (!e.requires && !e.optional) {
        return 0;
      }
      return -(arcBase + arcSpace * e.spokeRank);
    });
  selectAll(".reqGroup")
    .selectAll(function () {
      return this.childNodes;
    })
    .classed("fade", false);
  select("#startSlice").classed("fade", false);
  selectAll(".tempArcG").remove();
}
