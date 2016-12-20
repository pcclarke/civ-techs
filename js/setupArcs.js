var setupArcs = function (data) {
    var arcDists = []; // list of recent arcRanks
    var leadsReq;
    var leadsOpt;
    var minArcDist;
    var maxArcDist;

    // Add in the displayed into their prerequisites so that the arcs can be set up
    data.displayed.forEach(function (d, i) {
        var rekked = []; // copy leads to required displayed
        var opted = []; // copy leads to optional displayed
        var obsoleted = [];
        minArcDist = 0;
        maxArcDist = 0;
        leadsReq = getLeadsToReq(d, data.displayed);
        leadsOpt = getLeadsToOpt(d, data.displayed);
        var minPos = d.pos;
        var maxPos = d.pos;

        // Determine how many positions arc goes through and what it is mandatory for
        leadsReq.forEach(function (lr) {
            var arcDist = lr.pos - d.pos;
            if (arcDist > maxArcDist) {
                maxArcDist = arcDist;
            }
            if (lr.pos > maxPos) {
                maxPos = lr.pos;
            }
            if (lr.pos < minPos) {
                minPos = lr.pos;
            }
            var req = {"id": lr.id, "dist": arcDist, "pos": d.pos};
            rekked.push(req);
        });
        d.lreq = rekked;

        // Determine how many positions arc goes through and what it is optional for
        leadsOpt.forEach(function (lo) {
            var arcDist = lo.pos - d.pos;
            if (arcDist > maxArcDist) {
                maxArcDist = arcDist;
            }
            if (lo.pos > maxPos) {
                maxPos = lo.pos;
            }
            if (lo.pos < minPos) {
                minPos = lo.pos;
            }
            var opt = {"id": lo.id, "dist": arcDist, "pos": d.pos};
            opted.push(opt);
        });
        d.lopt = opted;

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
        d.arcDist = ((2 * Math.PI) / data.displayed.length) * maxArcDist;

        // Calculate angle of start of arc
        var baseDist = 0;
        if (minPos < d.pos) {
            baseDist = d.pos - minPos;
        }
        d.arcBack = ((2 * Math.PI) / data.displayed.length) * baseDist;
        
        // Set arc rank - distance of arc from centre
        if (d.lreq.length > 0 || d.lopt.length > 0) {
            var ranked = 0;
            for (var j = 0; j < arcDists.length; j++) {
                if (arcDists[j] < minPos) {
                    arcDists[j] = i + maxArcDist;
                    d.arcRank = j;
                    ranked = 1;
                    break;
                }
            }
            if (ranked === 0) {
                arcDists.push(i + maxArcDist);
                d.arcRank = (arcDists.length - 1);
            }
            
            // Add the arc rank to leads to
            d.lreq.forEach(function (lr) {
                lr.arcRank = d.arcRank;
            });
            d.lopt.forEach(function (lo) {
                lo.arcRank = d.arcRank;
            });
            // d.lobs(function (ob) {
            //    ob.arcRank = d.arcRank;
            // });
        } else if (d.requires || d.optional) {
            d.arcRank = 499;
        } else {
            d.arcRank = 500;
        }
    });

    
    // Set spoke rank - where to start drawing spoke
    data.displayed.forEach(function (d) {
        var spokeRank;
        var preReqs;
        
        if (d.arcRank > 0 && d.arcRank !== 500) {
            spokeRank = d.arcRank;
            preReqs = getTechPrereqs(d, data);
            preReqs.forEach(function (p) {
                if (p.arcRank < spokeRank) {
                    spokeRank = p.arcRank;
                }
            });
            d.spokeRank = spokeRank;
        } else {
            d.spokeRank = 0;
        }
    });

    
    // Set up arcs for each unlock, if necessary
    data.displayed.forEach(function(d) {
        d.unlocks.forEach(function (u) {
            if (Array.isArray(u.ref.requires)) {
                if (u.ref.requires.length > 1) {
                    var maxPos = 0;
                    var minPos = d.pos;
                    var endDist;
                    var baseDist;

                    u.lreq = [];

                    u.ref.requires.forEach(function (r) {
                        var unlockReq = getTechById(r, data);
                        var req;

                        if (unlockReq.pos > maxPos) {
                            maxPos = unlockReq.pos;
                        }
                        if (unlockReq.pos < minPos) {
                            minPos = unlockReq.pos;
                        }
                        if (unlockReq.pos !== d.pos) { // unlock arc square positions
                            req = {"id": unlockReq.id, "dist": (unlockReq.pos - d.pos), "pos": u.pos, "arcRank": u.rank};
                            u.lreq.push(req);
                        }
                    });
                    
                    endDist = 0;
                    if (maxPos > d.pos) {
                        endDist = maxPos - d.pos;
                    }
                    u.arcEnd = ((2 * Math.PI) / data.displayed.length) * endDist;
                    baseDist = 0;
                    if (minPos < d.pos) {
                        baseDist = d.pos - minPos;
                    }
                    u.arcBack = ((2 * Math.PI) / data.displayed.length) * baseDist;
                }
            }
        });
    });


    // Reverse order of data so that arcs are drawn over spokes
    data.displayed.sort(function(a, b) {
        return b.pos - a.pos;
    });
}