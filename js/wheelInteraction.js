// Mouseover for the spokes of the wheel
function spokeMouseOver(d) {
    d3.select(this)
        .classed("textSelected", true)
    .selectAll(".spokeLine")
        .classed("lineSelected", true);
    d3.select(this)
    .selectAll(".spokeTextBox")
        .classed("spokeTextBoxSelected", true);
        
    if (d.requires) {
        for (var i = 0; i < d.requires.length; i++) {
            d3.selectAll("." + d.requires[i])
            .selectAll(".spokeLine")
                .classed("lineRequired", true);
        }
    }
    if (d.optional) {
        for (var i = 0; i < d.optional.length; i++) {
            d3.selectAll("." + d.optional[i])
            .selectAll(".spokeLine")
                .classed("lineOptional", true);
        }
    }
    if (d.lreq) {
        for (var i = 0; i < d.lreq.length; i++) {
            d3.selectAll("." + d.lreq[i].id)
            .selectAll(".spokeLine")
                .classed("lineLeads", true);
        }
    }
    if (d.lopt) {
        for (var i = 0; i < d.lopt.length; i++) {
            d3.selectAll("." + d.lopt[i].id)
            .selectAll(".spokeLine")
                .classed("lineLeads", true);
        }
    }
}

// Mouseout for the spokes of the wheel
function spokeMouseOut(d) {
    d3.select(this)
        .classed("textSelected", false)
    .selectAll(".spokeLine")
        .classed("lineSelected", false);
    d3.select(this)
    .selectAll(".spokeTextBox")
        .classed("spokeTextBoxSelected", false);

    if (d.requires) {
        for (var i = 0; i < d.requires.length; i++) {
            d3.selectAll("." + d.requires[i])
            .selectAll(".spokeLine")
                .classed("lineRequired", false);
        }
    }
    if (d.optional) {
        for (var i = 0; i < d.optional.length; i++) {
            d3.selectAll("." + d.optional[i])
            .selectAll(".spokeLine")
                .classed("lineOptional", false);
        }
    }
    if (d.lreq) {
        for (var i = 0; i < d.lreq.length; i++) {
            d3.selectAll("." + d.lreq[i].id)
            .selectAll(".spokeLine")
                .classed("lineLeads", false);
        }
    }
    if (d.lopt) {
        for (var i = 0; i < d.lopt.length; i++) {
            d3.selectAll("." + d.lopt[i].id)
            .selectAll(".spokeLine")
                .classed("lineLeads", false);
        }
    }
}

// Show the name of an icon in a hover box
function displayTooltip(name) {
    d3.select("#tooltip")
        .style("left", civ.coords[0] + "px")
        .style("top", civ.coords[1] + "px");

    d3.select("#tipName").text(name);

    d3.select("#tooltip").classed("hidden", false);
}