import { select } from "d3-selection";

import { getOptTechPreReqs, getReqTechPreReqs, getTechById } from "./dataTools";

export function displayDetailsBox(item, pos, wheelState, data) {
  const { coords, game, empire } = wheelState;

  var itemCat = item.cat;
  var itemName = "";
  var itemId = "";

  select("#tooltip")
    .style("left", function () {
      if (pos > data.displayed.length / 2) {
        return coords[0] + 15 + "px";
      } else {
        return coords[0] - 415 + "px";
      }
    })
    .style("top", function () {
      return coords[1] - 100 + "px";
    });

  if (
    (itemCat === "units" || itemCat === "buildings") &&
    !(game === "civ1" || game === "civ2")
  ) {
    if (item[empire]) {
      itemName = item[empire].name;
      itemId = item[empire].id;
    } else {
      itemName = item.CIVILIZATION_ALL.name;
      itemId = item.CIVILIZATION_ALL.id;
    }
  } else {
    itemName = item.name;
    itemId = item.id;
  }

  select("#tipName").text(itemName);
  select("#tipImg").attr(
    "src",
    game + "/img/" + itemCat + "/" + itemId + ".png"
  );
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
    select("#tipMand").text(reqText);
    select("#tipMandLine").classed("hidden", false);
    select("#tipNoLine").classed("hidden", true);
  } else {
    select("#tipMandLine").classed("hidden", true);
    if (!item.optional) {
      select("#tipNoLine").classed("hidden", false);
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
      select("#tipPlusLine").classed("hidden", false);
    } else {
      select("#tipPlusLine").classed("hidden", true);
    }
    select("#tipOpt").text(optText);
    select("#tipOptLine").classed("hidden", false);
    select("#tipNoLine").classed("hidden", true);
  } else {
    select("#tipPlusLine").classed("hidden", true);
    select("#tipOptLine").classed("hidden", true);
    select("#tipOpt").text("None");
  }

  if (itemCat === "technologies") {
    if (item.lopt.length > 0 || item.lreq.length > 0) {
      select("#tipLeads").classed("hidden", false);
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
        select("#tipMld").text(tipMandatoryLeads);
        select("#tipMldLine").classed("hidden", false);
      } else {
        select("#tipMldLine").classed("hidden", true);
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
        select("#tipOld").text(tipOptionalLeads);
        select("#tipOldLine").classed("hidden", false);
      } else {
        select("#tipOldLine").classed("hidden", true);
      }
    } else {
      select("#tipLeads").classed("hidden", true);
    }
  } else {
    select("#tipLeads").classed("hidden", true);
  }

  if (item.cost) {
    select("#tipCost").text(item.cost);
    select("#tipCostLine").classed("hidden", false);
  } else {
    select("#tipCostLine").classed("hidden", true);
  }

  if (item.kind) {
    select("#tipKind").text(item.kind);
    select("#tipKind").classed("hidden", false);
  } else {
    select("#tipKind").classed("hidden", true);
  }

  select("#tooltip").classed("hidden", false);
}
