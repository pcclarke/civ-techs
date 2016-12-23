// Show the name of an icon in a hover box
function displayTooltip(name) {
    d3.select("#tooltip")
        .style("left", CIV.coords[0] + "px")
        .style("top", CIV.coords[1] + "px");

    d3.select("#tipName").text(name);

    d3.select("#tooltip").classed("hidden", false);
}

var selLine = function(setId, setClass, toShow) {
    d3.selectAll("." + setId)
        .selectAll(".spokeLine")
        .classed(setClass, toShow);
};

var fader = function(setId, toShow) {
    d3.selectAll("." + setId)
        .classed("fade", toShow);
};

var makeTempArc = function(highlighted, setId, data) {
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

    var tempArcG = d3.select(".spokeAll") // TODO: move to reqArcs
        .select("." + reqD.id)
        .append("g")
        .attr("class", "tempArcG");

    tempArcG.append("path")
        .attr("class", "tempArc")
        .style("fill", function(d) {
            return CIV.color(d.pos);
        })
        .attr("d", tempArc);

    tempArcG.append("line")
        .attr("class", "tempSpokePin")
        .attr("x1", 0)
        .attr("y1", function(d) {
            return -(CIV.arcBase + 7 + (CIV.arcSpace * reqD.arcRank));
        })
        .attr("x2", 0)
        .attr("y2", function(d) {
            return -(CIV.arcBase - 5 + (CIV.arcSpace * reqD.arcRank));
        })
        .attr("stroke-width", CIV.arcWidth)
        .attr("stroke", function(d) {
            return CIV.color(reqD.pos); 
        });

    var tempReqSquares = tempArcG.selectAll(".tempReqSquare")
        .data(function(d) {
            return d.lreq;
        })
        .enter().append("g")
        .filter(function(d) {
            return d.id === highlighted.id;
        })
        .attr("transform", function(d) {
            var ang = d.dist * (360 / data.displayed.length);
            return "rotate(" + ang + ") translate(0, " + (-CIV.arcBase - 2.5 - (CIV.arcSpace * d.arcRank)) + ")";
        })
        .attr("class", "reqSquare");

    tempReqSquares.append("rect")
        .attr("x", -2.5)
        .attr("y", -0.75)
        .attr("width", 5)
        .attr("height", 5)
        .attr("fill", function(d) {
            return CIV.color(d.pos);
        });

    var tempOptCircles = tempArcG.selectAll(".tempOptCircle")
        .data(function(d) {
            return d.lopt;
        })
        .enter().append("g")
        .filter(function(d) {
            return d.id === highlighted.id;
        })
        .attr("transform", function(d) {
            var ang = d.dist * (360 / data.displayed.length);
            return "rotate(" + ang + ") translate(0, " + (-CIV.arcBase - 2.5 - (CIV.arcSpace * d.arcRank)) + ")";
        })
        .attr("class", "optCircle");
    
    tempOptCircles.append("circle")
        .attr("cx", 0)
        .attr("cy", 2)
        .attr("r", 2.5)
        .attr("stroke-width", 1)
        .attr("stroke", function(d) {
            return CIV.color(d.pos);
        })
        .attr("fill", "white");
}

function spokeHighlightIn(d, data) {
    d3.selectAll(".spoke")
        .classed("fade", true);
    d3.select(".reqArcs")
        .selectAll(".reqGroup")
        .classed("fade", true);

    d3.select("." + d.id)
        .classed("fade", false);
    d3.select(".reqArcs")
        .select("." + d.id)
        .classed("fade", false);

    if (d.requires) {
        if (Array.isArray(d.requires)) {
            d.requires.forEach(function (r) {
                d3.select(".spokeAll")
                    .selectAll("." + r)
                    .classed("fade", false);

                makeTempArc(d, r, data);
            });
        } else {
            d3.select(".spokeAll")
                .selectAll("." + d.requires)
                .classed("fade", false);
            makeTempArc(d, d.requires, data);
        }
    }
    if (d.optional) {
        if (Array.isArray(d.optional)) {
            d.optional.forEach(function (o) {
                d3.select(".spokeAll")
                    .selectAll("." + o)
                    .classed("fade", false);

                makeTempArc(d, o, data);
            });
        } else {
            d3.select(".spokeAll")
                .selectAll("." + d.optional)
                .classed("fade", false);
            makeTempArc(d, d.optional, data);
        }
    }
    if (d.lreq) {
        d.lreq.forEach(function (lr) {
            d3.select(".spokeAll")
                .selectAll("." + lr.id)
                .classed("fade", false);
        });
    }
    if (d.lopt) {
        d.lopt.forEach(function (lo) {
            d3.select(".spokeAll")
                .selectAll("." + lo.id)
                .classed("fade", false);
        });
    }


}

function spokeHighlightOut(d) {
    d3.selectAll(".spoke")
        .classed("fade", false);
    d3.selectAll(".reqGroup")
        .classed("fade", false);
    d3.selectAll(".tempArcG")
        .remove();
}