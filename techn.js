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

//var path = "civ4/civ4base.json";
var path = "civ4_bts/civ4bts.json";

var arcBase = 100;
var arcWidth = 1;
var arcSpace = 15;

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
    
    // Give each technology an arbitrary position value
    // And an unlocks array for units, resources, buildings, etc...
    for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].pos = i;
        data.technologies[i].unlocks = [];
    }
    
    // Go through each technology and find the prequisite with highest position, then swap positions
    var iter  = 0;
    while (iter < data.technologies.length) {
        var pos = data.technologies[iter].pos;
        var elem = iter;
        for (var j = 0; j < data.technologies.length; j++) {
            if (data.technologies[iter].requires) {
                for (var k = 0; k < data.technologies[iter].requires.length; k++) {                    
                    if (data.technologies[iter].requires[k] === data.technologies[j].id) {
                        if (data.technologies[j].pos > pos) {
                            pos = data.technologies[j].pos;
                            elem = j;
                        }
                    }
                }
            }
            if (data.technologies[iter].optional) {
                for (var k = 0; k < data.technologies[iter].optional.length; k++) {
                    if (data.technologies[iter].optional[k] === data.technologies[j].id) {
                        if (data.technologies[j].pos > pos) {
                            pos = data.technologies[j].pos;
                            elem = j;
                        }
                    }
                }
            }
        }
        
        if (iter != elem) {
            // console.log(data.technologies[iter].name + " at " + data.technologies[iter].pos + " requires " + data.technologies[elem].name + " at " + data.technologies[elem].pos);
            data.technologies[elem].pos = data.technologies[iter].pos;
            var techSwap = data.technologies[elem];
            data.technologies[iter].pos = pos;
            data.technologies[elem] = data.technologies[iter];
            data.technologies[iter] = techSwap;
            iter = 0;
        } else {
            iter++;
        }
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
    
    
    
    
    
    // Determine the position where the unit icon belongs
    // -> Always place the icon at the higher technology position
    // TODO: Write this into a function for others - e.g. buildings
    for (var i = 0; i < data.units.length; i++) {
        var maxPos = 0;
        var minPos = 0;
        for (var j = 0; j < data.technologies.length; j++) {
            for (var k = 0; k < data.units[i].prereq.length; k++) {
                if (data.units[i].prereq[k] === data.technologies[j].id && maxPos < data.technologies[j].pos) {
                    maxPos = data.technologies[j].pos;
                }
                if (data.units[i].prereq.length == 1) {
                    minPos = maxPos;
                } else {
                    // determine arc start
                }
            }
        }
        data.units[i].pos = maxPos;
    }
    
    for (var i = 0; i < data.units.length; i++) { // loop through all units
        var max = 5000;
        for (var j = 0; j < data.technologies.length; j++) { // loop through all techs
            for (var k = 0; k < data.units[i].prereq.length; k++) { // loop through all prereqs for a unit
                if (data.units[i].prereq[k] === data.technologies[j].id && max > j) { // ids match & max is greater than position of tech (because they're in reverse order)
                    max = j;
                }
            }
        }
        //data.units[i].pos = maxPos;
        /*if (data.technologies[minTech].unlocks) {
            data.technologies[minTech].unlocks.push(data.units[i]);
        } else {*/
        //data.technologies[minTech].unlocks = [];
        data.technologies[max].unlocks.push(data.units[i]);
        //}
    }
    
    // Determine the rank
    // 1. Search through other units to see if there are any other icons at this pos, and set the rank to highest++
    // 2. If there are no other units at this position, set rank to 0
    for (var i = 0; i < data.units.length; i++) {
        var iconRank = 0;
        for (var j = 0; j < data.units.length; j++) {
            if (data.units[j].iconRank >= 0) {
                if (data.units[i].pos == data.units[j].pos && data.units[j].iconRank >= iconRank) {
                    iconRank = data.units[j].iconRank + 1;
                }
            }
        }
        data.units[i].iconRank = iconRank;
    }
    
    /* 
    
    Should assign rank by working backwards for multiple prerequisites. With start and end variables,
    you can "reserve" a rank for a range of positions
    -> On second thought, why is that not true for working forwards too? Important point is having
    a start and end, not the direction you check in. Right?
    
    Final goal here should be to create a new JSON array for each technology (call it something like unlocks)
    Each icon gets appended to this array. Solves two problems:
    1. How to access the different data types (buildings, units, bonuses, religions, etc...)
    2. How to draw; by adding to the technologies data it's super simple 
    ==> Which means, you don't need to calculate position per se, you need to determine which technology a unit belongs in!
    
    */
    
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
        .attr("transform", "translate(-10, " + (-(width / 2) + 235) + ") rotate(270)")
        .attr("height", 20)
        .attr("width", 20)
        .attr("xlink:href", function(d) {
            var link = "img/techtree/" + d.name + ".png";
            return link;
        });
        
    var unlockIcons = spokes.selectAll(".unlocks")
        .data(function(d) {
            return d.unlocks;
        })
        .enter().append("g")
        .attr("class", "unlocks");
        
    unlockIcons.append("image") // Unlock icons
        .attr("class", "unlockImg")
        .attr("transform", function(d) {
            return "translate(-10, " + (-(width / 2) + 100 - (d.iconRank * 25)) + ") rotate(270)";
        })
        .attr("height", 20)
        .attr("width", 20)
        .attr("xlink:href", function(d) {
            console.log(d);
            var link = "img/units/archer.png";
            for (var i = 0; i < d.types.length; i++) {
                if (d.types[i].civilization.name === "All") {
                    link = "img/units/" + d.types[i].name + ".png";
                }
            }
            
            return link;
        });
        

        
    spokes.append("text") // Technology text
        .attr("class", "spokeText")
        .attr("transform", function(d) {
            if (d.pos > (data.technologies.length / 2)) {
                return "translate(-4, " + (-(width / 2) + 210) + ") rotate(90)";
            }
            return "translate(3, " + (-(width / 2) + 210) + ") rotate(270)";
        })
        .text(function(d) {
            return d.name;
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
            .attr("transform", "translate(-10, " + (-(width / 2) + 212) + ") rotate(270)")
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