function displayDetailsBox(item, pos, game, civ, data) {
    var itemCat = item.cat;
    var itemName = "";
    var itemId = "";

    d3.select("#tooltip")
        .style("left", function () {
            if (pos > (data.displayed.length / 2)) {
                return (CIV.coords[0] + 15) + "px";
            } else {
                return (CIV.coords[0] - 415) + "px";
            }
        })
        .style("top", function () {
            return (CIV.coords[1] - 100) + "px";
            
        });

    if (itemCat === "units" || itemCat === "buildings") {
        if (item[CIV.ilization]) {
            itemName = item[CIV.ilization].name;
            itemId = item[CIV.ilization].id;
        } else {
            itemName = item.CIVILIZATION_ALL.name;
            itemId = item.CIVILIZATION_ALL.id;
        }
    } else {
        itemName = item.name;
        itemId = item.id;
    }

    d3.select("#tipName").text(itemName);
    d3.select("#tipImg").attr("src", game + "/img/" + itemCat + "/" + itemId + ".png");
    if (item.requires) {
        var reqText = "None";
        var reqs = getReqTechPreReqs(item, data);
        reqs.forEach(function (r, i) {
            if (i == 0) {
                reqText = r.name;
            } else if (i == reqs.length - 1 && reqs.length == 2) {
                reqText = reqText + " and " + r.name;
            } else if (i == reqs.length - 1) {
                reqText = reqText + ", and " + r.name;    
            } else {
                reqText = reqText + ", " + r.name;
            }
        });
        d3.select("#tipMand").text(reqText);
        d3.select("#tipMandLine").classed("hidden", false);
        d3.select("#tipNoLine").classed("hidden", true);
    } else {
        d3.select("#tipMandLine").classed("hidden", true);
        if (!item.optional) {
            d3.select("#tipNoLine").classed("hidden", false);
        }
    }
    if (item.optional) {
        var optText = "None";
        var opts = getOptTechPreReqs(item, data);
        for (var i = 0; i < opts.length; i++) {
            if (i == 0) {
                optText = opts[i].name;
            } else if (i == opts.length - 1 && opts.length == 2) {
                optText = optText + " or " + opts[i].name;
            } else if (i == opts.length - 1) {
                optText = optText + ", or " + opts[i].name;    
            } else {
                optText = optText + ", " + opts[i].name;
            }
        }
        if (item.requires) {
            d3.select("#tipPlusLine").classed("hidden", false);    
        } else {
            d3.select("#tipPlusLine").classed("hidden", true);
        }
        d3.select("#tipOpt").text(optText);
        d3.select("#tipOptLine").classed("hidden", false);
        d3.select("#tipNoLine").classed("hidden", true);
    } else {
        d3.select("#tipPlusLine").classed("hidden", true);
        d3.select("#tipOptLine").classed("hidden", true);
        d3.select("#tipOpt").text("None");
    }

    if (itemCat === "technologies") {
        if (item.lopt.length > 0 || item.lreq.length > 0) {
            d3.select("#tipLeads").classed("hidden", false);
            if (item.lreq.length > 0) {
                var tipMandatoryLeads = "";
                for (var i = 0; i < item.lreq.length; i++) {
                    var leadTech = getTechById(item.lreq[i].id, data);
                    if (i == 0) {
                        tipMandatoryLeads = leadTech.name;
                    } else {
                        tipMandatoryLeads = tipMandatoryLeads + ", " + leadTech.name;
                    }
                }
                d3.select("#tipMld").text(tipMandatoryLeads);
                d3.select("#tipMldLine").classed("hidden", false);
            } else {
                d3.select("#tipMldLine").classed("hidden", true);
            }
            if (item.lopt.length > 0) {
                var tipOptionalLeads = "";
                for (var i = 0; i < item.lopt.length; i++) {
                    var leadTech = getTechById(item.lopt[i].id, data);
                    if (i == 0) {
                        tipOptionalLeads = leadTech.name;
                    } else {
                        tipOptionalLeads = tipOptionalLeads + ", " + leadTech.name;
                    }
                }
                d3.select("#tipOld").text(tipOptionalLeads);
                d3.select("#tipOldLine").classed("hidden", false);
            } else {
                d3.select("#tipOldLine").classed("hidden", true);
            }
        } else {
            d3.select("#tipLeads").classed("hidden", true);
        }

        d3.select("#tipCost").text(item.cost);
        d3.select("#tipCostLine").classed("hidden", false);
    } else {
        d3.select("#tipCostLine").classed("hidden", true);
        d3.select("#tipLeads").classed("hidden", true);
    }

    d3.select("#tooltip").classed("hidden", false);
};