/*

Some defintions:

__Position (pos)__: the position of an icon from 0 degrees with equal angle sections.
So if there are 15 technologies, the 0th position is at 0 degrees, the 1st at 24, 2nd at 48, nth at (360/15*n)...

__Rank__: The distance from the center of an icon.
The 1st rank is closest to the center, 2nd farther, and so on. 
Each rank represents an invisible circle that it sits on. 
So you could call the ranks the 1st circle, 2nd circle, and up.
The distance between ranks is arbitrary, and is set by the variable arcSpace (originally just referred to arcs, yeah, yeah...).
*/

var game = "civ4bts";

//var path = "civ4/civ4base.json";
var path = game + "/civ4bts.json";

var arcBase = 150;
var arcWidth = 1;
var arcSpace = 10;

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
    
    for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].cat = "technology";
    }
    
    // Append units to technologies
    for (var i = 0; i < data.units.length; i++) {
        data.units[i].cat = "unit";
        data.technologies.push(data.units[i]);
    }
    
    // Append buildings to technologies
    for (var i = 0; i < data.buildings.length; i++) {
        data.buildings[i].cat = "building";
        data.technologies.push(data.buildings[i]);
    }
    
    // Append religions to technologies
    for (var i = 0; i < data.religions.length; i++) {
        data.religions[i].cat = "religion";
        data.technologies.push(data.religions[i]);
    }
    
    // Append terrain improvements to technologies
    for (var i = 0; i < data.build.length; i++) {
        data.build[i].cat = "improvement";
        data.technologies.push(data.build[i]);
    }
    
    // Append resources to technologies
    for (var i = 0; i < data.resources.length; i++) {
        data.resources[i].cat = "resource";
        data.technologies.push(data.resources[i]);
    }
    
    // Give each technology an arbitrary position value
    // And an unlocks array for units, resources, buildings, etc...
    for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].pos = i;
        data.technologies[i].unlocks = [];
    }
    
    
    
    for (var i = 0; i < data.technologies.length; i++) {
        // Find the highest position of this technology's [i] required & optional prerequisites
        var maxPrereq = 0;
        for (var j = 0; j < data.technologies.length; j++) {
            if (data.technologies[i].requires) {
                for (var k = 0; k < data.technologies[i].requires.length; k++) {
                    if (data.technologies[i].requires[k] === data.technologies[j].id) {
                        if (maxPrereq < data.technologies[j].pos) {
                            maxPrereq = data.technologies[j].pos;
                        }
                    }
                }
            }
            if (data.technologies[i].optional) {
                for (var k = 0; k < data.technologies[i].optional.length; k++) {
                    if (data.technologies[i].optional[k] === data.technologies[j].id) {
                        if (maxPrereq < data.technologies[j].pos) {
                            maxPrereq = data.technologies[j].pos;
                        }
                    }
                }
            }
        }
        
        /*for (var j = 0; j < data.technologies.length; j++) {
            if (data.technologies[j].requires) {
                for (var k = 0; k < data.technologies[j].requires.length; k++) {
                    if (data.technologies[j].requires[k] === data.technologies[i].id && j != i) {
                        if (data.technologies[j].pos < maxPrereq) {
                            maxPrereq = data.technologies[j].pos - 2;
                        }
                    }
                }
            }
            if (data.technologies[j].optional) {
                for (var k = 0; k < data.technologies[j].optional.length; k++) {
                    if (data.technologies[j].optional[k] === data.technologies[i].id && j != i) {
                        if (data.technologies[j].pos < maxPrereq) {
                            maxPrereq = data.technologies[j].pos - 2;
                        }
                    }
                }
            }
        }*/
        
        data.technologies[i].pos = -1;
        // bump all positions up to accomodate moving position
        for (var j = 0; j < data.technologies.length; j++) {
            if (data.technologies[j].pos > maxPrereq) {
                data.technologies[j].pos++;    
            }
            
        }
        data.technologies[i].pos = maxPrereq + 1;
    }
    
    data.technologies.sort(function(a, b) {
        return a.pos - b.pos;
    });

    
    for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].pos = i;;
    }
    
    var arcDists = []; // list of recent arcRanks
    // Then add in the technologies into their prerequisites so that the arcs can be set up
    for (var i = 0; i < data.technologies.length; i++) {
        var rekked = []; // copy leads to required technologies
        var opted = []; // copy leads to optional technologies
        var optedDist = [];
        var arcDist = 0;
        
        for (var j = 0; j < data.technologies.length; j++) {
            if (data.technologies[j].requires) {
                for (var k = 0; k < data.technologies[j].requires.length; k++) {                    
                    if (data.technologies[j].requires[k] === data.technologies[i].id) {
                        arcDist = data.technologies[j].pos - data.technologies[i].pos;
                        var req = {"id": data.technologies[j].id, "dist": arcDist, "pos": data.technologies[i].pos};
                        rekked.push(req);
                    }
                }
            }
            if (data.technologies[j].optional) {
                for (var k = 0; k < data.technologies[j].optional.length; k++) {
                    if (data.technologies[j].optional[k] === data.technologies[i].id) {
                        arcDist = data.technologies[j].pos - data.technologies[i].pos;
                        var opt = {"id": data.technologies[j].id, "dist": arcDist, "pos": data.technologies[i].pos};
                        opted.push(opt);
                    }
                }
            }
        }
        
        data.technologies[i].lreq = rekked;
        data.technologies[i].lopt = opted;
        
        data.technologies[i].arcDist = ((2 * Math.PI) / data.technologies.length) * arcDist;
        
        // Set arc rank - distance of arc from centre
        if (data.technologies[i].lreq.length > 0 || data.technologies[i].lopt.length > 0) {
            var ranked = 0;
            for (var j = 0; j < arcDists.length; j++) {
                if (arcDists[j] < i) {
                    arcDists[j] = i + arcDist;
                    data.technologies[i].arcRank = j;
                    ranked = 1;
                    break;
                }
            }
            if (ranked == 0) {
                arcDists.push(i + arcDist);
                data.technologies[i].arcRank = (arcDists.length - 1);
            }
            
            // Add the arc rank to leads to
            for (var j = 0; j < data.technologies[i].lreq.length; j++) {
                data.technologies[i].lreq[j].arcRank = data.technologies[i].arcRank;
            }
            for (var j = 0; j < data.technologies[i].lopt.length; j++) {
                data.technologies[i].lopt[j].arcRank = data.technologies[i].arcRank;
            }
        } else {
            data.technologies[i].arcRank = 500;
        }
    }
    
    // Set spoke rank - where to start drawing spoke
    for (var i = data.technologies.length - 1; i >= 0; i--) {
        if (data.technologies[i].arcRank > 0) {
            var spokeRank = data.technologies[i].arcRank;
            if (data.technologies[i].requires) {
                for (var j = 0; j < data.technologies[i].requires.length; j++) {
                    for (var k = 0; k < data.technologies.length; k++) {
                        if (data.technologies[i].requires[j] === data.technologies[k].id) {
                            if (data.technologies[k].arcRank < spokeRank) {
                                spokeRank = data.technologies[k].arcRank;
                            }
                        }
                    }
                }
            }
            if (data.technologies[i].optional) {
                for (var j = 0; j < data.technologies[i].optional.length; j++) {
                    for (var k = 0; k < data.technologies.length; k++) {
                        if (data.technologies[i].optional[j] === data.technologies[k].id) {
                            if (data.technologies[k].arcRank < spokeRank) {
                                spokeRank = data.technologies[k].arcRank;
                            }
                        }
                    }
                }
            }
            data.technologies[i].spokeRank = spokeRank;
        } else {
            data.technologies[i].spokeRank = 0;
        }
    }
    
    
    
    // Reverse order of data so that arcs are drawn over spokes
    data.technologies.sort(function(a, b) {
        return b.pos - a.pos;
    });
    
    console.log(data.technologies);
    console.log(data.units);
    
    var wheel = svg.append("g")
        .attr("transform", "translate(" + (width / 2) + " " + (height / 2) +")");
        
    var spokes = wheel.selectAll(".spoke")
            .data(data.technologies)
        .enter().append("g")
            .attr("class", "spoke")
            .attr("transform", function(d) {
                var ang = d.pos * (360 / data.technologies.length);
                return "rotate(" + ang +")";
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
        .attr("y2", -(width / 2));
        
    spokes.append("image") // Technology icons
        .attr("class", "techImg")
        .attr("transform", function(d) {
            if (d.cat === "technology") {
                return "translate(-10, " + (-(width / 2) + 235) + ") rotate(270)";
            } else {
                return "translate(-10, " + (-(width / 2) + 75) + ") rotate(270)";
            }
        })
        .attr("height", 20)
        .attr("width", 20)
        .attr("xlink:href", function(d) {
            var link;
            if (d.cat === "unit") {
                link = "img/units/" + d.CIVILIZATION_ALL.id + ".png";
            } else if (d.cat === "building") {
                link = "img/buildings/" + d.CIVILIZATION_ALL.id + ".png";
            } else if (d.cat === "religion") {
                link = "img/religions/" + d.name + ".png";
            } else if (d.cat === "technology") {
                link = "img/technologies/" + d.id + ".png";
            } else if (d.cat === "improvement") {
                link = "img/builds/" + d.id + ".png";
            } else if (d.cat === "resource") {
                link = "img/resources/" + d.name + ".png";
            } else {
                link = "img/technologies/fishing.png";
            }
            return link;
        });

        
    spokes.append("text") // Technology text
        .attr("class", "spokeText")
        .attr("transform", function(d) {
            if (d.cat === "technology") {
                if (d.pos > (data.technologies.length / 2)) {
                    return "translate(-4, " + (-(width / 2) + 210) + ") rotate(90)";
                }
                return "translate(3, " + (-(width / 2) + 210) + ") rotate(270)";
            } else {
                if (d.pos > (data.technologies.length / 2)) {
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
            if (d.pos > (data.technologies.length / 2)) {
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
                    return "translate(-10, " + (-(width / 2) + 212) + ") rotate(270)";
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
        .style("fill", function(d) {
            return color(d.pos);
        })
        .attr("d", arc);
        
    var reqPin = spokes.append("line")
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
           var ang = d.dist * (360 / data.technologies.length);
           return "rotate(" + ang + ") translate(0, " + (-arcBase - 2.5 - (arcSpace * d.arcRank)) + ")";
       })
       .attr("class", "reqSquare");
       
     reqSquares.append("rect")
        .attr("x", -3)
        .attr("y", -.5)
        .attr("width", 5)
        .attr("height", 5)
        .attr("fill", function(d) {
            return color(d.pos);
        });
        
    var optCircles = spokes.selectAll(".optCircle")
       .data(function(d) {
           return d.lopt;
       })
       .enter().append("g")
       .attr("transform", function(d) {
           var ang = d.dist * (360 / data.technologies.length);
           return "rotate(" + ang + ") translate(0, " + (-arcBase - 2.5 - (arcSpace * d.arcRank)) + ")";
       })
       .attr("class", "optCircle");
       
     optCircles.append("circle")
        .attr("cx", 0)
        .attr("cy", 2)
        .attr("r", 2.5)
        .attr("stroke-width", 1.5)
        .attr("stroke", function(d) {
            return color(d.pos);
        })
        .attr("fill", "white");
});