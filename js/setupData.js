// Append technologies to displayed & the things they unlock
function setupData(data) {
    data.displayed = [];

    // First, arrange the technologies by cost
    data.technologies.sort(function(a, b) {
        return a.cost - b.cost;
    });

    var unlocksList = []

    // Scoop up all the things each technology leads to and put it in the unlocks object
    for (var i = data.technologies.length - 1; i > 0; i--) {
        data.technologies[i].cat = "technologies";
        data.displayed.push(data.technologies[i]);

        var unlocks = getLeadsTo(data.technologies[i], data.units);
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.buildings));
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.projects));
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.promotions));
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.build));
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.civics));
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.religions));
        unlocks = unlocks.concat(getLeadsTo(data.technologies[i], data.resources));

        if (data.technologies[i].special) {
            for (var j = 0; j < data.technologies[i].special.length; j++) {
                data.technologies[i].special[j].cat = "specials";
                data.technologies[i].special[j].requires = [];
                data.technologies[i].special[j].requires.push(data.technologies[i].id);
                unlocks.push(data.technologies[i].special[j]);
            }
        }

        var toSplice = [];
        var uniqueUnlocks = [];
        for (var j = 0; j < unlocks.length; j++) {
            var matchFound = 0;
            for (var k = 0; k < unlocksList.length; k++) {
                if (unlocks[j].id === unlocksList[k].id) {
                    matchFound = 1;
                }
            }
            if (matchFound !== 1) {
                uniqueUnlocks.push(unlocks[j]);
            }
        }
        unlocksList = unlocksList.concat(uniqueUnlocks);

        var unlocksHandler = [];
        for (var j = 0; j < uniqueUnlocks.length; j++) {

            var unlocksItem = {};
            unlocksItem.rank = j;
            unlocksItem.ref = uniqueUnlocks[j];
            unlocksHandler.push(unlocksItem);
        }
        data.technologies[i].unlocks = unlocksHandler;
    }
    
    // Label data categories
    var dataTypes = ["units", "buildings", "religions", "build", "resources", "projects", "promotions", "civics"];
    for (var i = 0; i < dataTypes.length; i++) {
        for (var j = 0; j < data[dataTypes[i]].length; j++) {
            data[dataTypes[i]][j].cat = dataTypes[i];
        }
    }
}