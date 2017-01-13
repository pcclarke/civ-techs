// Append technologies to displayed & the things they unlock
function setupData(data) {
    data.displayed = [];
    data.outerDisplayed = [];
    var unlocksList = [];

    // First, arrange the technologies by cost
    /*if ((+(CIV.game[3])) > 3) {
        data.technologies.sort(function(a, b) {
            return b.cost - a.cost;
        });
    }*/

    // Scoop up all the things each technology leads to and put it in the unlocks object
    // data.technologies.forEach(function(d) {
    //     var toSplice = [];
    //     var uniqueUnlocks = [];
    //     var unlocks;

    //     d.cat = "technologies";
    //     data.displayed.push(d);

    //     unlocks = getLeadsTo(d, data.units);
    //     unlocks = unlocks.concat(getLeadsTo(d, data.buildings));
    //     unlocks = unlocks.concat(getLeadsTo(d, data.build));
    //     if (data.civics) {
    //         unlocks = unlocks.concat(getLeadsTo(d, data.civics));    
    //     }
    //     if (data.projects) {
    //         unlocks = unlocks.concat(getLeadsTo(d, data.projects));
    //     }
    //     if (data.promotions) {
    //         unlocks = unlocks.concat(getLeadsTo(d, data.promotions));
    //     }
    //     if (data.religions) {
    //         unlocks = unlocks.concat(getLeadsTo(d, data.religions));
    //     } 
    //     if (data.resources) {
    //         unlocks = unlocks.concat(getLeadsTo(d, data.resources));
    //     }

    //     if (d.special) {
    //         d.special.forEach(function (s) {
    //             s.cat = "specials";
    //             s.requires = [];
    //             s.requires.push(d.id);
    //             unlocks.push(s);
    //         });
    //     }

    //     unlocks.forEach(function (u, j) {
    //         var matchFound = 0;
    //         unlocksList.forEach(function (l, k) {
    //             if (u.id === l.id) {
    //                 matchFound = 1;
    //             }
    //         });
    //         if (matchFound !== 1) {
    //             uniqueUnlocks.push(u);
    //         }
    //     });
    //     unlocksList = unlocksList.concat(uniqueUnlocks);

    //     var unlocksHandler = [];
    //     uniqueUnlocks.forEach(function (u, j) {
    //         var unlocksItem = {};
    //         unlocksItem.rank = j;
    //         unlocksItem.ref = u;
    //         unlocksHandler.push(unlocksItem);
    //     });
    //     d.unlocks = unlocksHandler;
    // });

    //spliceData("technologies");

     for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].cat = "technologies";
        data.displayed.push(data.technologies[i]);
    }

    if (CIV.game === "civ4bts") {
        data.displayed.sort(function(a, b) {
            return a.order - b.order;
        });
    }

    data.displayed.forEach(function (d, i) {
        d.pos = i;
    });

    /*spliceData("units");
    spliceData("buildings");
    spliceData("promotions");
    spliceData("projects");
    spliceData("build");
    spliceData("civics");
    spliceData("religions");
    spliceData("resources");*/

    function spliceData(dataType) {
        data[dataType].forEach(function(addTech) {
            var maxReq = 0;
            var allReqs = getAllTechPrereqs(addTech, data);

            if (addTech.requires || addTech.optional) {
                data.displayed.forEach(function(eachDisplayed, i) {
                    allReqs.forEach(function(eachReq) {
                        if (eachDisplayed.id === eachReq.id && i > maxReq) {
                            maxReq = i;
                        }
                    });
                });

                data.displayed.splice(maxReq + 1, 0, addTech);
            } else {
                data.displayed.splice(0, 0, addTech);
            }
            console.log(addTech.id + " " + maxReq);
            addTech.cat = dataType;
        });
    }

    // for (var i = 0; i < data.buildings.length; i++) {
    //     data.buildings[i].cat = "buildings";
    //     data.outerDisplayed.push(data.buildings[i]);
    // }
    // for (var i = 0; i < data.units.length; i++) {
    //     data.units[i].cat = "units";
    //     data.outerDisplayed.push(data.units[i]);
    // }

    spliceyData("units");
    spliceyData("buildings");
    spliceyData("promotions");
    spliceyData("projects");
    spliceyData("build");
    spliceyData("civics");
    spliceyData("religions");
    spliceyData("resources");

    function addData(dataType) {
        data[dataType].forEach(function(addTech) {
            var maxReq = 0;
            var allReqs = getAllTechPrereqs(addTech, data);

            addTech.reqCount = allReqs.length;

            /*if (addTech.requires || addTech.optional) {
                data.outerDisplayed.forEach(function(eachDisplayed, i) {
                    allReqs.forEach(function(eachReq) {
                        if (eachDisplayed.id === eachReq.id && i > maxReq) {
                            maxReq = i;
                        }
                    });
                });

                data.outerDisplayed.splice(maxReq + 1, 0, addTech);
            } else {
                data.outerDisplayed.splice(0, 0, addTech);
            }
            console.log(addTech.id + " " + maxReq);*/
            data.outerDisplayed.push(addTech);
            addTech.cat = dataType;
        });
    }

    function spliceyData(dataType) {
        data[dataType].forEach(function(addTech) {
            if (addTech.requires || addTech.optional) {
                var maxReq = 0;
                var techReqs = getTechPrereqs(addTech, data);

                techReqs.forEach(function(req) {
                    if (req.pos > maxReq) {
                        maxReq = req.pos;
                    }
                });

                addTech.maxReq = maxReq;

                data.outerDisplayed.push(addTech);
                addTech.cat = dataType;
            }
        });
    }

    if (CIV.game === "civ4bts") {
        data.outerDisplayed.sort(function(a, b) {
            return a.maxReq - b.maxReq;
        });
    }

    // Label data categories
    CIV.dataTypes.forEach(function (t) {
        if (data[t]) {
            data[t].forEach(function (d) {
                d.cat = t;
            });
        }
    });
}