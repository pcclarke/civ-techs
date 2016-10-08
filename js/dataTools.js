// Get a list of the required technology prerequisites for a given thing
function getReqTechPreReqs(examine, data) {
    var preReqs = [];

    if (examine.requires) {
        for (var i = 0; i < data.technologies.length; i++) {
            for (var j = 0; j < examine.requires.length; j++) {
                if (examine.requires[j] === data.technologies[i].id) {
                    preReqs.push(data.technologies[i]);
                }
            }
        }
    }
    
    return preReqs;
}

// Get a list of the displayed things this technology leads to that require it
function getLeadsToReq(examine, compareData) {
    var leads = [];
    
    for (var i = 0; i < compareData.length; i++) {
        if (compareData[i].requires) {
            for (var j = 0; j < compareData[i].requires.length; j++) {
                if (compareData[i].requires[j] === examine.id) {
                    leads.push(compareData[i]);
                }
            }
        }
    }
    
    return leads;
}

// Get a list of the optional technology prerequisites for a given thing
function getOptTechPreReqs(examine, data) {
    var preReqs = [];

    if (examine.optional) {
        for (var i = 0; i < data.technologies.length; i++) {
            for (var j = 0; j < examine.optional.length; j++) {
                if (examine.optional[j] === data.technologies[i].id) {
                    preReqs.push(data.technologies[i]);
                }
            }
        }
    }
    
    return preReqs;
}

// Get a list of the displayed things this technology leads to that optionally require it
function getLeadsToOpt(examine, compareData) {
    var leads = [];
    
    for (var i = 0; i < compareData.length; i++) {
        if (compareData[i].optional) {
            for (var j = 0; j < compareData[i].optional.length; j++) {
                if (compareData[i].optional[j] === examine.id) {
                    leads.push(compareData[i]);
                }
            }
        }
    }
    
    return leads;
}

// Get a list of the technology prerequsites (required and optional) for a given thing (techs, units, whatever)
function getTechPrereqs(examine, data) {
    var preReqs = [];

    if (examine.requires) {
        for (var i = 0; i < data.technologies.length; i++) {
            for (var j = 0; j < examine.requires.length; j++) {
                if (examine.requires[j] === data.technologies[i].id) {
                    preReqs.push(data.technologies[i]);
                }
            }
        }
    }
    if (examine.optional) {
        for (var i = 0; i < data.technologies.length; i++) {
            for (var j = 0; j < examine.optional.length; j++) {
                if (examine.optional[j] === data.technologies[i].id) {
                    preReqs.push(data.technologies[i]);
                }
            }
        }
    }
    
    return preReqs;
}

// Get a list of the displayed things this technology leads to (required and optional)
function getLeadsTo(examine, compareData) {
    var leads = [];
    
    for (var i = 0; i < compareData.length; i++) {
        if (compareData[i].requires) {
            for (var j = 0; j < compareData[i].requires.length; j++) {
                if (compareData[i].requires[j] === examine.id) {
                    leads.push(compareData[i]);
                }
            }
        }
    }
    for (var i = 0; i < compareData.length; i++) {
        if (compareData[i].optional) {
            for (var j = 0; j < compareData[i].optional.length; j++) {
                if (compareData[i].optional[j] === examine.id) {
                    leads.push(compareData[i]);
                }
            }
        }
    }
    
    return leads;
}

// Returns a technology item by its Id
function getTechById(examineId, data) {
    var tech = "BAD_ID";

    for (var i = 0; i < data.technologies.length; i++) {
        if (data.technologies[i].id === examineId) {
            tech = data.technologies[i];
        }
    }

    return tech;
}

// For a given technology, creates a list including:
// technologies that it requires (optional & mandatory)
// technologies it leads to
// anything else it leads to and the other technologies they require
function findNearby(origin, data) {
    var nearbyList = getTechPrereqs(origin, data);
    nearbyList = nearbyList.concat(convertSpecial(origin));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.technologies));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.promotions));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.projects));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.build));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.buildings));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.civics));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.religions));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.resources));
    nearbyList = nearbyList.concat(getLeadsTo(origin, data.units));

    var fartherList = [];
    for (var i = 0; i < nearbyList.length; i++) {
        var otherReqs = getTechPrereqs(nearbyList[i], data);

        for (var j = 0; j < otherReqs.length; j++) {
            if (otherReqs[j].id !== origin.id) {
                fartherList.push(otherReqs[j]);
            }
        }
    }
    nearbyList = nearbyList.concat(fartherList);
    nearbyList.push(origin);

    if (origin.obsolete) {
        var obsoleteTech = getTechById(origin.obsolete, data);
        nearbyList.push(obsoleteTech);
    }

    return nearbyList;
}

// Converts the specials in a technology into prereq objects
function convertSpecial(examine) {
    var specials = [];

    if (examine.special) {
        for (var i = 0; i < examine.special.length; i++) {
            var specialItem = examine.special[i];
            specialItem.requires = [];
            specialItem.requires.push(examine.id);
            specialItem.cat = "specials";
            specials.push(specialItem);
        }
    }

    return specials;
}