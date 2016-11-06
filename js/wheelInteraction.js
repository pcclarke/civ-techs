// Show the name of an icon in a hover box
function displayTooltip(name) {
    d3.select("#tooltip")
        .style("left", CIV.coords[0] + "px")
        .style("top", CIV.coords[1] + "px");

    d3.select("#tipName").text(name);

    d3.select("#tooltip").classed("hidden", false);
}

function spokeHighlightIn(d) {
    d3.selectAll("." + d.id)  
        .selectAll(".spokeLine")
        .classed("lineSelected", true);

    if (d.requires) {
        d.requires.forEach(function (r) {
            d3.selectAll("." + r)
            .selectAll(".spokeLine")
                .classed("lineRequired", true);
        });
    }
    if (d.optional) {
        d.optional.forEach(function (o) {
            d3.selectAll("." + o)
            .selectAll(".spokeLine")
                .classed("lineOptional", true);
        });
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
    d3.selectAll("." + d.id)  
        .selectAll(".spokeLine")
        .classed("lineSelected", false);

    if (d.requires) {
        d.requires.forEach(function (r) {
            d3.selectAll("." + r)
            .selectAll(".spokeLine")
                .classed("lineRequired", false);
        });
    }
    if (d.optional) {
        d.optional.forEach(function (o) {
            d3.selectAll("." + o)
            .selectAll(".spokeLine")
                .classed("lineOptional", false);
        });
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