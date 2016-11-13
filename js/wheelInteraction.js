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

function spokeHighlightIn(d) {
    selLine(d.id, "lineSelected", true);

    if (d.requires) {
        if (Array.isArray(d.requires)) {
            d.requires.forEach(function (r) {
                selLine(r, "lineRequired", true);
            });
        } else {
            selLine(d.requires, "lineRequired", true);
        }
    }
    if (d.optional) {
        if (Array.isArray(d.optional)) {
            d.optional.forEach(function (o) {
                selLine(o, "lineOptional", true);
            });
        } else {
            selLine(d.optional, "lineOptional", true);
        }
    }
    if (d.lreq) {
        d.lreq.forEach(function (lr) {
            d3.selectAll("." + lr.id)
            .selectAll(".spokeLine")
                .classed("lineLeads", true);
        });
    }
    if (d.lopt) {
        d.lopt.forEach(function (lo) {
            d3.selectAll("." + lo.id)
            .selectAll(".spokeLine")
                .classed("lineLeads", true);
        });
    }
}

function spokeHighlightOut(d) {
    selLine(d.id, "lineSelected", false);

    if (d.requires) {
        if (Array.isArray(d.requires)) {
            d.requires.forEach(function (r) {
                selLine(r, "lineRequired", false);
            });
        } else {
            selLine(d.requires, "lineRequired", false);
        }
    }
    if (d.optional) {
        if (Array.isArray(d.optional)) {
            d.optional.forEach(function (o) {
                selLine(o, "lineOptional", false);
            });
        } else {
            selLine(d.optional, "lineOptional", false);
        }
    }
    if (d.lreq) {
        d.lreq.forEach(function (lr) {
            d3.selectAll("." + lr.id)
            .selectAll(".spokeLine")
                .classed("lineLeads", false);
        });
    }
    if (d.lopt) {
        d.lopt.forEach(function (lo) {
            d3.selectAll("." + lo.id)
            .selectAll(".spokeLine")
                .classed("lineLeads", false);
        });
    }
}