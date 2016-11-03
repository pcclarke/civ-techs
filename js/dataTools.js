// Get a list of the required technology prerequisites for a given thing
var getReqTechPreReqs = function (examine, data) {
    var preReqs = [];

    if (examine.requires) {
        data.technologies.forEach(function (t) {
            examine.requires.forEach(function (r) {
                if (r === t.id) {
                    preReqs.push(t);
                }
            });
        });
    }
    
    return preReqs;
}

// Get a list of the displayed things this technology leads to that require it
 var getLeadsToReq = function (examine, compareData) {
    var leads = [];
    
    compareData.forEach(function (d) {
        if (d.requires) {
            d.requires.forEach(function (r) {
                if(r === examine.id) {
                    leads.push(d);
                }
            });
        }
    });
    
    return leads;
}

// Get a list of the optional technology prerequisites for a given thing
var getOptTechPreReqs = function (examine, data) {
    var preReqs = [];

    if (examine.optional) {
        data.technologies.forEach(function (t) {
            examine.optional.forEach(function (o) {
                if (o === t.id) {
                    preReqs.push(t);
                }
            });
        });
    }
    
    return preReqs;
}

// Get a list of the displayed things this technology leads to that optionally require it
var getLeadsToOpt = function (examine, compareData) {
    var leads = [];
    
    compareData.forEach(function (c) {
        if (c.optional) {
            c.optional.forEach(function (o) {
                if (o === examine.id) {
                    leads.push(c);
                }
            });
        }
    });
    
    return leads;
}

// Get a list of the technology prerequsites (required and optional) for a given thing (techs, units, whatever)
var getTechPrereqs = function (examine, data) {
    var preReqs = [];

    if (examine.requires) {
        data.technologies.forEach(function (t) {
            examine.requires.forEach(function (r) {
                if (r === t.id) {
                    preReqs.push(t);
                }
            });
        });
    }
    if (examine.optional) {
        data.technologies.forEach(function (t) {
            examine.optional.forEach(function (o) {
                if (o === t.id) {
                    preReqs.push(t);
                }
            });
        });
    }
    
    return preReqs;
}

// Get a list of the displayed things this technology leads to (required and optional)
var getLeadsTo = function (examine, compareData) {
    var leads = [];
    
    compareData.forEach(function (c) {
        if (c.requires) {
            c.requires.forEach(function (r) {
                if (r === examine.id) {
                    leads.push(c);
                }
            });
        }
        if (c.optional) {
            c.optional.forEach(function (o) {
                if (o === examine.id) {
                    leads.push(c);
                }
            });
        }
    });

    return leads;
}

// Returns a technology item by its Id
var getTechById = function (examineId, data) {
    var tech = "BAD_ID";

    data.technologies.forEach(function (t) {
        if (t.id === examineId) {
            tech = t;
        }
    });

    return tech;
}

// For a given technology, creates a list including:
// technologies that it requires (optional & mandatory)
// technologies it leads to
// anything else it leads to and the other technologies they require
var findNearby = function (origin, data) {
    var nearbyList;
    var fartherList = [];
    var obsoleteTech;
    var otherReqs;

    nearbyList = getTechPrereqs(origin, data);
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

    nearbyList.forEach(function (n) {
        otherReqs = getTechPrereqs(n, data);

        otherReqs.forEach(function (o) {
            if (o.id !== origin.id) {
                fartherList.push(o);
            }
        });
    });

    nearbyList = nearbyList.concat(fartherList);
    nearbyList.push(origin);

    if (origin.obsolete) {
        obsoleteTech = getTechById(origin.obsolete, data);
        nearbyList.push(obsoleteTech);
    }

    return nearbyList;
}

// Converts the specials in a technology into prereq objects
var convertSpecial = function (examine) {
    var specials = [];
    var specialItem;

    if (examine.special) {
        examine.special.forEach(function (s) {
            s.requires = [];
            s.requires.push(examine.id);
            s.cat = "specials";
            specials.push(s);
        });
    }

    return specials;
}