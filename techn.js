/*

Some defintions:

__Position (pos)__: the position of an icon from 0 degrees with equal angle sections.
So if there are 15 displayed, the 0th position is at 0 degrees, the 1st at 24, 2nd at 48, nth at (360/15*n)...

__Rank__: The distance from the center of an icon.
The 1st rank is closest to the center, 2nd farther, and so on. 
Each rank represents an invisible circle that it sits on. 
So you could call the ranks the 1st circle, 2nd circle, and up.
The distance between ranks is arbitrary, and is set by the variable arcSpace (originally just referred to arcs, yeah, yeah...).
*/

// Global variables
var game = "civ4bts";
var path = game + "/civdata.json";
var arcBase = 150;
var arcWidth = 3;
var arcSpace = 17;


var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;
    
var arc = d3.svg.arc()
    .innerRadius(function(d) {
        return arcBase + (arcSpace * d.arcRank);
    })
    .outerRadius(function(d) {
        return (arcBase + arcWidth) + (arcSpace * d.arcRank);
    })
    .startAngle(0)
    .endAngle(function(d) {
        return d.arcDist;   
    });
    
var color = d3.scale.category10();

var svg = d3.select("#chart").append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json(path, function(data) {
    
    // First, arrange the technologies by cost
    data.technologies.sort(function(a, b) {
        return a.cost - b.cost;
    });
    
    data.displayed = [];
    
    // Append technologies to displayed
    for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].cat = "technology";
        data.displayed.push(data.technologies[i]);
    }
    
    // // Append units to displayed
    // for (var i = 0; i < data.units.length; i++) {
    //     data.units[i].cat = "unit";
    //     data.displayed.push(data.units[i]);
    // }
    
    // // Append buildings to displayed
    // for (var i = 0; i < data.buildings.length; i++) {
    //     data.buildings[i].cat = "building";
    //     data.displayed.push(data.buildings[i]);
    // }
    
    // // Append religions to displayed
    // for (var i = 0; i < data.religions.length; i++) {
    //     data.religions[i].cat = "religion";
    //     data.displayed.push(data.religions[i]);
    // }
    
    // // Append terrain improvements to displayed
    // for (var i = 0; i < data.build.length; i++) {
    //     data.build[i].cat = "improvement";
    //     data.displayed.push(data.build[i]);
    // }
    
    // // Append resources to displayed
    // for (var i = 0; i < data.resources.length; i++) {
    //     data.resources[i].cat = "resource";
    //     data.displayed.push(data.resources[i]);
    // }
    
    // // Append resources to displayed
    // for (var i = 0; i < data.projects.length; i++) {
    //     data.projects[i].cat = "project";
    //     data.displayed.push(data.projects[i]);
    // }
    
    orderData();
    
    function orderData() {
        // Give each technology an arbitrary position value
        for (var i = 0; i < data.displayed.length; i++) {
            data.displayed[i].pos = i;
        }

        // Generate an optimal position for list items
        for (var i = 0; i < data.displayed.length; i++) {
            var maxPrereq = 0;
            
            var preReqs = getTechPrereqs(data.displayed[i]);
            
            // Find the highest position of this technology's [i] prerequisites
            for (var j = 0; j < preReqs.length; j++) {
                if (maxPrereq < preReqs[j].pos) {
                    maxPrereq = preReqs[j].pos;
                }
            }
            
            // Find any other technology that requires this technology [i] and set maxPrereq to be below it
            for (var j = 0; j < data.displayed.length; j++) {
                var otherPreReqs = getTechPrereqs(data.displayed[j]);
                
                for (var k = 0; k < otherPreReqs.length; k++) {
                    if (otherPreReqs[k].id === data.displayed[i].id && data.displayed[j].pos < maxPrereq) {
                        maxPrereq = otherPreReqs[k].pos - 2; // -2 because it may be incremented later
                    }
                }
            }
            
            data.displayed[i].pos = -1; // make sure this technology doesn't get bumped
            // bump all positions higher than the max prerequisites up to accomodate moving position
            for (var j = 0; j < data.displayed.length; j++) {
                if (data.displayed[j].pos > maxPrereq) {
                    data.displayed[j].pos++;
                }
            }
            data.displayed[i].pos = maxPrereq + 1;
        }
        
        data.displayed.sort(function(a, b) {
            return a.pos - b.pos;
        });

        for (var i = 0; i < data.displayed.length; i++) {
            data.displayed[i].pos = i;;
        }
        
        
        var arcDists = []; // list of recent arcRanks
        // Add in the displayed into their prerequisites so that the arcs can be set up
        for (var i = 0; i < data.displayed.length; i++) {
            var rekked = []; // copy leads to required displayed
            var opted = []; // copy leads to optional displayed
            var optedDist = [];
            var maxArcDist = 0;
            var leadsReq = getLeadsToReq(data.displayed[i], data.displayed);
            var leadsOpt = getLeadsToOpt(data.displayed[i], data.displayed);
            
            // Determine how long arc should be and what it leads to
            for (var j = 0; j < leadsReq.length; j++) {
                var arcDist = leadsReq[j].pos - data.displayed[i].pos;
                if (arcDist > maxArcDist) {
                    maxArcDist = arcDist;
                }
                var req = {"id": leadsReq[j].id, "dist": arcDist, "pos": data.displayed[i].pos};
                rekked.push(req);
            }
            data.displayed[i].lreq = rekked;
            
            for (var j = 0; j < leadsOpt.length; j++) {
                var arcDist = leadsOpt[j].pos - data.displayed[i].pos;
                if (arcDist > maxArcDist) {
                    maxArcDist = arcDist;
                }
                var opt = {"id": leadsOpt[j].id, "dist": arcDist, "pos": data.displayed[i].pos};
                opted.push(opt);
            }
            data.displayed[i].lopt = opted;
            
            data.displayed[i].arcDist = ((2 * Math.PI) / data.displayed.length) * maxArcDist;
            
            // Set arc rank - distance of arc from centre
            if (data.displayed[i].lreq.length > 0 || data.displayed[i].lopt.length > 0) {
                var ranked = 0;
                for (var j = 0; j < arcDists.length; j++) {
                    if (arcDists[j] < i) {
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
            } else {
                data.displayed[i].arcRank = 500;
            }
        }
        
        // Set spoke rank - where to start drawing spoke
        for (var i = data.displayed.length - 1; i >= 0; i--) {
            if (data.displayed[i].arcRank > 0) {
                var spokeRank = data.displayed[i].arcRank;
                var preReqs = getTechPrereqs(data.displayed[i]);
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
        
        
        // Reverse order of data so that arcs are drawn over spokes
        data.displayed.sort(function(a, b) {
            return b.pos - a.pos;
        });
    }
    
    // Get a list of the required technology prerequisites for a given thing
    function getReqTechPreReqs(examine) {
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
    function getOptTechPreReqs(examine) {
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
    function getTechPrereqs(examine) {
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
    
    console.log(data.displayed);
    console.log(data.units);
    
    
    // START DRAWING ----------------------
    drawWheel();
    
    
    function drawWheel() {
    var wheel = svg.append("g")
        .attr("transform", "translate(" + (width / 2) + " " + (height / 2) +")");
        
    var spokes = wheel.selectAll(".spoke")
            .data(data.displayed)
        .enter().append("g")
            .attr("class", function(d) {
                var className = d.id + " spoke";
                return className;
            })
            .attr("transform", function(d) {
                var ang = d.pos * (360 / data.displayed.length);
                return "rotate(" + ang +")";
            })
            .on("mouseover", function(d) {
                d3.select(this)
                    .classed("textSelected", true)
                .selectAll(".spokeLine")
                    .classed("lineSelected", true);
                d3.select(this)
                .selectAll(".spokeTextBox")
                    .classed("spokeTextBoxSelected", true);
                    
                if (d.requires) {
                    for (var i = 0; i < d.requires.length; i++) {
                        d3.selectAll("." + d.requires[i])
                        .selectAll(".spokeLine")
                            .classed("lineRequired", true);
                    }
                }
                if (d.optional) {
                    for (var i = 0; i < d.optional.length; i++) {
                        d3.selectAll("." + d.optional[i])
                        .selectAll(".spokeLine")
                            .classed("lineOptional", true);
                    }
                }
                if (d.lreq) {
                    for (var i = 0; i < d.lreq.length; i++) {
                        d3.selectAll("." + d.lreq[i].id)
                        .selectAll(".spokeLine")
                            .classed("lineLeads", true);
                    }
                }
                if (d.lopt) {
                    for (var i = 0; i < d.lopt.length; i++) {
                        d3.selectAll("." + d.lopt[i].id)
                        .selectAll(".spokeLine")
                            .classed("lineLeads", true);
                    }
                }
            })
            .on("mouseout", function(d) {
                d3.select(this)
                    .classed("textSelected", false)
                .selectAll(".spokeLine")
                    .classed("lineSelected", false);
                d3.select(this)
                .selectAll(".spokeTextBox")
                    .classed("spokeTextBoxSelected", false);

                if (d.requires) {
                    for (var i = 0; i < d.requires.length; i++) {
                        d3.selectAll("." + d.requires[i])
                        .selectAll(".spokeLine")
                            .classed("lineRequired", false);
                    }
                }
                if (d.optional) {
                    for (var i = 0; i < d.optional.length; i++) {
                        d3.selectAll("." + d.optional[i])
                        .selectAll(".spokeLine")
                            .classed("lineOptional", false);
                    }
                }
                if (d.lreq) {
                    for (var i = 0; i < d.lreq.length; i++) {
                        d3.selectAll("." + d.lreq[i].id)
                        .selectAll(".spokeLine")
                            .classed("lineLeads", false);
                    }
                }
                if (d.lopt) {
                    for (var i = 0; i < d.lopt.length; i++) {
                        d3.selectAll("." + d.lopt[i].id)
                        .selectAll(".spokeLine")
                            .classed("lineLeads", false);
                    }
                }
            })
            .on("click", function(d) {
                // Append units to displayed
                for (var i = 0; i < data.units.length; i++) {
                    data.units[i].cat = "unit";
                    data.displayed.push(data.units[i]);
                }
                
                //console.log(data.displayed);
            });
            
    spokes.append("line") // Spoke lines from center
        .attr("class", "spokeLine")
        .attr("x1", 0)
        .attr("y1", function(d) {
            if (!d.requires && !d.optional) {
                return 0;
            } 
            return -(arcBase + (arcSpace * d.spokeRank));
        })
        .attr("x2", 0)
        .attr("y2", -(width / 2) + 50);
        
    spokes.append("image") // Displayed item icons
        .attr("class", "techImg")
        .attr("transform", function(d) {
            if (d.cat === "technology") {
                if (d.pos > (data.displayed.length / 2)) {
                    return "translate(16, " + (-(width / 2) + 88) + ") rotate(90)";
                }
                return "translate(-16, " + (-(width / 2) + 120) + ") rotate(270)";
            } else {
                return "translate(-16, " + (-(width / 2) + 75) + ") rotate(270)";
            }
        })
        .attr("height", 32)
        .attr("width", 32)
        .attr("xlink:href", function(d) {
            var link;
            if (d.cat === "unit") {
                link = game + "/img/units/" + d.CIVILIZATION_ALL.id + ".png";
            } else if (d.cat === "building") {
                link = game + "/img/buildings/" + d.CIVILIZATION_ALL.id + ".png";
            } else if (d.cat === "religion") {
                link = game + "/img/religions/" + d.name + ".png";
            } else if (d.cat === "technology") {
                link = game + "/img/technologies/" + d.id + ".png";
            } else if (d.cat === "improvement") {
                link = game + "/img/builds/" + d.id + ".png";
            } else if (d.cat === "resource") {
                link = game + "/img/resources/" + d.name + ".png";
            } else if (d.cat === "project") {
                link = game + "/img/projects/" + d.id + ".png";
            } else {
                link = game + "/img/displayed/fishing.png";
            }
            return link;
        });

        
    spokes.append("text") // Technology text
        .attr("class", "spokeText")
        .attr("transform", function(d) {
            if (d.cat === "technology") {
                if (d.pos > (data.displayed.length / 2)) {
                    return "translate(-4, " + (-(width / 2) + 80) + ") rotate(90)";
                }
                return "translate(3, " + (-(width / 2) + 80) + ") rotate(270)";
            } else {
                if (d.pos > (data.displayed.length / 2)) {
                    return "translate(-4, " + (-(width / 2) + 50) + ") rotate(90)";
                }
                return "translate(3, " + (-(width / 2) + 50) + ") rotate(270)";
            }
        })
        .text(function(d) {
            var name;
            if (d.cat === "unit" || d.cat === "building") {
                name = d.CIVILIZATION_ALL.name;
            } else {
                name = d.name;
            }
            return name;
        })
        .attr("text-anchor", function(d) {
            if (d.pos > (data.displayed.length / 2)) {
                return "end";
            }
            return "start";
        })
        .each(function(d) {
            d.bbox = this.getBBox();
        });
        
    spokes.insert("rect", "text") // Box behind technology text
            .attr("class", "spokeTextBox")
            .attr("transform", function(d) {
                if (d.cat === "technology") {
                    return "translate(-10, " + (-(width / 2) + 82) + ") rotate(270)";
                } else {
                    return "translate(-10, " + (-(width / 2) + 52) + ") rotate(270)";
                }
            })
            .attr("rx", 3)
            .attr("ry", 3)
            .attr("width", function(d) {
                return d.bbox.width + 5;
            })
            .attr("height", function(d) {
                return d.bbox.height + 3;
            });
        
    var reqArc = spokes.append("path")
        .attr("class", "spokeArc")
        .style("fill", function(d) {
            return color(d.pos);
        })
        .attr("d", arc);
        
    var reqPin = spokes.append("line")
        .attr("class", "spokePin")
        .attr("x1", 0)
        .attr("y1", function(d) {
            return -(arcBase + 7 + (arcSpace * d.arcRank));
        })
        .attr("x2", 0)
        .attr("y2", function(d) {
            return -(arcBase - 5 + (arcSpace * d.arcRank));
        })
        .attr("stroke-width", arcWidth)
        .attr("stroke", function(d) {
           return color(d.pos); 
        });
        
    var reqSquares = spokes.selectAll(".reqSquare")
       .data(function(d) {
           return d.lreq;
       })
       .enter().append("g")
       .attr("transform", function(d) {
           var ang = d.dist * (360 / data.displayed.length);
           return "rotate(" + ang + ") translate(0, " + (-arcBase - 2.5 - (arcSpace * d.arcRank)) + ")";
       })
       .attr("class", "reqSquare");
       
     reqSquares.append("rect")
        .attr("x", -4)
        .attr("y", -3)
        .attr("width", 8)
        .attr("height", 8)
        .attr("fill", function(d) {
            return color(d.pos);
        });
        
    var optCircles = spokes.selectAll(".optCircle")
       .data(function(d) {
           return d.lopt;
       })
       .enter().append("g")
       .attr("transform", function(d) {
           var ang = d.dist * (360 / data.displayed.length);
           return "rotate(" + ang + ") translate(0, " + (-arcBase - 2.5 - (arcSpace * d.arcRank)) + ")";
       })
       .attr("class", "optCircle");
       
     optCircles.append("circle")
        .attr("cx", 0)
        .attr("cy", 1)
        .attr("r", 3.5)
        .attr("stroke-width", 2)
        .attr("stroke", function(d) {
            return color(d.pos);
        })
        .attr("fill", "white");
    }
});