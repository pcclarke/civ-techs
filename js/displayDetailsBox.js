function displayDetailsBox(item, game, data) {
    var itemCat = item.cat;
    var itemName = "";
    var itemId = "";
    if (itemCat === "units" || itemCat === "buildings") {
        itemName = item.CIVILIZATION_ALL.name;
        itemId = item.CIVILIZATION_ALL.id;
    } else {
        itemName = item.name;
        itemId = item.id;
    }

    d3.select("#descTitle").text(itemName);
    d3.select("#descImg").attr("src", game + "/img/" + itemCat + "/" + itemId + ".png");
    if (item.requires) {
        var reqText = "None";
        var reqs = getReqTechPreReqs(item, data);
        for (var i = 0; i < reqs.length; i++) {
            if (i == 0) {
                reqText = reqs[i].name;
            } else if (i == reqs.length - 1 && reqs.length == 2) {
                reqText = reqText + " and " + reqs[i].name;
            } else if (i == reqs.length - 1) {
                reqText = reqText + ", and " + reqs[i].name;    
            } else {
                reqText = reqText + ", " + reqs[i].name;
            }
        }
        d3.select("#descMand").text(reqText);
        d3.select("#descMandLine").classed("hidden", false);
        d3.select("#descNoLine").classed("hidden", true);
    } else {
        d3.select("#descMandLine").classed("hidden", true);
        if (!item.optional) {
            d3.select("#descNoLine").classed("hidden", false);
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
            d3.select("#descPlusLine").classed("hidden", false);    
        } else {
            d3.select("#descPlusLine").classed("hidden", true);
        }
        d3.select("#descOpt").text(optText);
        d3.select("#descOptLine").classed("hidden", false);
        d3.select("#descNoLine").classed("hidden", true);
    } else {
        d3.select("#descPlusLine").classed("hidden", true);
        d3.select("#descOptLine").classed("hidden", true);
        d3.select("#descOpt").text("None");
    }
    d3.select("#description").classed("hidden", false);
}