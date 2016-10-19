function setupArcs(data) {
    var arcDists = []; // list of recent arcRanks
    // Add in the displayed into their prerequisites so that the arcs can be set up
    for (var i = 0; i < data.displayed.length; i++) {
        var rekked = []; // copy leads to required displayed
        var opted = []; // copy leads to optional displayed
        var obsoleted = [];
        var optedDist = [];
        var minArcDist = 0;
        var maxArcDist = 0;
        var leadsReq = getLeadsToReq(data.displayed[i], data.displayed);
        var leadsOpt = getLeadsToOpt(data.displayed[i], data.displayed);
        var minPos = data.displayed[i].pos;
        var maxPos = data.displayed[i].pos;
        
        // Determine how many positions arc goes through and what it is mandatory for
        for (var j = 0; j < leadsReq.length; j++) {
            var arcDist = leadsReq[j].pos - data.displayed[i].pos;
            if (arcDist > maxArcDist) {
                maxArcDist = arcDist;
            }
            if (leadsReq[j].pos > maxPos) {
                maxPos = leadsReq[j].pos;
            }
            if (leadsReq[j].pos < minPos) {
                minPos = leadsReq[j].pos;
            }
            var req = {"id": leadsReq[j].id, "dist": arcDist, "pos": data.displayed[i].pos};
            rekked.push(req);
        }
        data.displayed[i].lreq = rekked;
        
        // Determine how many positions arc goes through and what it is optional for
        for (var j = 0; j < leadsOpt.length; j++) {
            var arcDist = leadsOpt[j].pos - data.displayed[i].pos;
            if (arcDist > maxArcDist) {
                maxArcDist = arcDist;
            }
            if (leadsOpt[j].pos > maxPos) {
                maxPos = leadsOpt[j].pos;
            }
            if (leadsOpt[j].pos < minPos) {
                minPos = leadsOpt[j].pos;
            }
            var opt = {"id": leadsOpt[j].id, "dist": arcDist, "pos": data.displayed[i].pos};
            opted.push(opt);
        }
        data.displayed[i].lopt = opted;

        // if (data.displayed[i].obsolete) {
        //     var obsTech;
        //     for (var j = 0; j < data.technologies.length; j++) { // Find the obsolete tech from id
        //         if (data.displayed[i].obsolete === data.technologies[j].id) {
        //             obsTech = data.technologies[j];
        //         }
        //     }
        //     var arcDist = obsTech.pos - data.displayed[i].pos;
        //     if (arcDist > maxArcDist) {
        //         maxArcDist = arcDist;
        //     }
        //     if (obsTech.pos < minPos) {
        //         minPos = obsTech.pos;
        //     }
        //     var obs = {"id": obsTech.id, "dist": arcDist, "pos": data.displayed[i].pos};
        //     obsoleted.push(obs);
        //     console.log(data.displayed[i]);
        // }
        // data.displayed[i].obs = obsoleted;
        
        // Calculate angle of end of arc
        data.displayed[i].arcDist = ((2 * Math.PI) / data.displayed.length) * maxArcDist;

        // Calculate angle of start of arc
        var baseDist = 0;
        if (minPos < data.displayed[i].pos) {
            baseDist = data.displayed[i].pos - minPos;
        }
        data.displayed[i].arcBack = ((2 * Math.PI) / data.displayed.length) * baseDist;
        
        // Set arc rank - distance of arc from centre
        if (data.displayed[i].lreq.length > 0 || data.displayed[i].lopt.length > 0) {
            var ranked = 0;
            for (var j = 0; j < arcDists.length; j++) {
                if (arcDists[j] < minPos) {
                    arcDists[j] = i + maxArcDist;
                    data.displayed[i].arcRank = j;
                    ranked = 1;
                    break;
                }
            }
            if (ranked == 0) {
                arcDists.push(i + maxArcDist);
                data.displayed[i].arcRank = (arcDists.length - 1);
            }
            
            // Add the arc rank to leads to
            for (var j = 0; j < data.displayed[i].lreq.length; j++) {
                data.displayed[i].lreq[j].arcRank = data.displayed[i].arcRank;
            }
            for (var j = 0; j < data.displayed[i].lopt.length; j++) {
                data.displayed[i].lopt[j].arcRank = data.displayed[i].arcRank;
            }
            // for (var j = 0; j < data.displayed[i].obs.length; j++) {
            //     data.displayed[i].obs[j].arcRank = data.displayed[i].arcRank;
            // }
        } else {
            data.displayed[i].arcRank = 500;
        }
    }
    
    // Set spoke rank - where to start drawing spoke
    for (var i = data.displayed.length - 1; i >= 0; i--) {
        if (data.displayed[i].arcRank > 0) {
            var spokeRank = data.displayed[i].arcRank;
            var preReqs = getTechPrereqs(data.displayed[i], data);
            for (var j = 0; j < preReqs.length; j++) {
                if (preReqs[j].arcRank < spokeRank) {
                    spokeRank = preReqs[j].arcRank;
                }
            }
            data.displayed[i].spokeRank = spokeRank;
        } else {
            data.displayed[i].spokeRank = 0;
        }
    }

    // Set up arcs for each unlock, if necessary
    for (var i = 0; i < data.displayed.length; i++) {
        var itemUnlocks = data.displayed[i].unlocks;
        var itemPos = data.displayed[i].pos;
        var maxPos = itemPos;
        var minPos = itemPos;

        for (var j = 0; j < itemUnlocks.length; j++) {
            if (itemUnlocks[j].ref.requires.length > 1) {
                for (var k = 0; k < itemUnlocks[j].ref.requires.length; k++) {
                    var unlockReq = getTechById(itemUnlocks[j].ref.requires[k], data);
                    if (unlockReq.pos > maxPos) {
                        maxPos = unlockReq.pos;
                    }
                    if (unlockReq.pos < minPos) {
                        minPos = unlockReq.pos;
                    }
                }
                var endDist = 0;
                if (maxPos > itemPos) {
                    endDist = itemPos + maxPos;
                }
                itemUnlocks[j].ref.arcEnd = ((2 * Math.PI) / data.displayed.length) * endDist;
                var baseDist = 0;
                if (minPos < itemPos) {
                    baseDist = itemPos - minPos;
                }
                itemUnlocks[j].ref.arcBack = ((2 * Math.PI) / data.displayed.length) * baseDist;

                itemUnlocks[j].arcRank = k;
            }
        }
    }
    
    
    // Reverse order of data so that arcs are drawn over spokes
    data.displayed.sort(function(a, b) {
        return b.pos - a.pos;
    });
}