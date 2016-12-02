// Append technologies to displayed & the things they unlock
function setupData(data) {
    data.displayed = [];
    var unlocksList = [];

    // First, arrange the technologies by cost
    if ((+(CIV.game[3])) > 3) {
        data.technologies.sort(function(a, b) {
            return b.cost - a.cost;
        });
    }

    // Scoop up all the things each technology leads to and put it in the unlocks object
    data.technologies.forEach(function(d) {
        var toSplice = [];
        var uniqueUnlocks = [];
        var unlocks;

        d.cat = "technologies";
        data.displayed.push(d);

        unlocks = getLeadsTo(d, data.units);
        unlocks = unlocks.concat(getLeadsTo(d, data.buildings));
        unlocks = unlocks.concat(getLeadsTo(d, data.build));
        if (data.civics) {
            unlocks = unlocks.concat(getLeadsTo(d, data.civics));    
        }
        if (data.projects) {
            unlocks = unlocks.concat(getLeadsTo(d, data.projects));
        }
        if (data.promotions) {
            unlocks = unlocks.concat(getLeadsTo(d, data.promotions));
        }
        if (data.religions) {
            unlocks = unlocks.concat(getLeadsTo(d, data.religions));
        } 
        if (data.resources) {
            unlocks = unlocks.concat(getLeadsTo(d, data.resources));
        }

        if (d.special) {
            d.special.forEach(function (s) {
                s.cat = "specials";
                s.requires = [];
                s.requires.push(d.id);
                unlocks.push(s);
            });
        }

        unlocks.forEach(function (u, j) {
            var matchFound = 0;
            unlocksList.forEach(function (l, k) {
                if (u.id === l.id) {
                    matchFound = 1;
                }
            });
            if (matchFound !== 1) {
                uniqueUnlocks.push(u);
            }
        });
        unlocksList = unlocksList.concat(uniqueUnlocks);

        var unlocksHandler = [];
        uniqueUnlocks.forEach(function (u, j) {
            var unlocksItem = {};
            unlocksItem.rank = j;
            unlocksItem.ref = u;
            unlocksHandler.push(unlocksItem);
        });
        d.unlocks = unlocksHandler;
    });

    // Label data categories
    CIV.dataTypes.forEach(function (t) {
        if (data[t]) {
            data[t].forEach(function (d) {
                d.cat = t;
            });
        }
    });
}