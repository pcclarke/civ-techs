var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1200 - margin.left - margin.right,
    height = 1200 - margin.top - margin.bottom;
    
var arcBase = 155;
var arcWidth = 5;
var arcSpace = 15;
    
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

d3.json("technologies.json", function(data) {
    
    // First, arrange the technologies
    // TODO: check pos for prerequisites
    for (var i = 0; i < data.technologies.length; i++) {
        data.technologies[i].pos = i;
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
                    if (data.technologies[j].requires[k] === data.technologies[i].name) {
                        arcDist = data.technologies[j].pos - data.technologies[i].pos;
                        var req = {"name": data.technologies[j].name, "dist": arcDist, "pos": data.technologies[i].pos};
                        rekked.push(req);
                    }
                }
            }
            if (data.technologies[j].optional) {
                for (var k = 0; k < data.technologies[j].optional.length; k++) {
                    if (data.technologies[j].optional[k] === data.technologies[i].name) {
                        arcDist = data.technologies[j].pos - data.technologies[i].pos;
                        var opt = {"name": data.technologies[j].name, "dist": arcDist, "pos": data.technologies[i].pos};
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
                        if (data.technologies[i].requires[j] === data.technologies[k].name) {
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
                        if (data.technologies[i].optional[j] === data.technologies[k].name) {
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
            
    spokes.append("line")
        .attr("x1", 0)
        .attr("y1", function(d) {
            if (!d.requires && !d.optional) {
                return 0;
            } 
            return -(arcBase + (arcSpace * d.spokeRank));
        })
        .attr("x2", 0)
        .attr("y2", -(width / 2))
        .attr("stroke", "black")
        .attr("stroke-width", 1);
        
    spokes.append("text")
        .attr("x", 0)
        .attr("y", -(width / 2) + 25)
        .text(function(d) {
            return d.name;
        });
        
    var reqArc = spokes.append("path")
        .style("fill", function(d) {
            return color(d.pos);
        })
        .attr("d", arc);
        
    var reqPin = spokes.append("line")
        .attr("x1", 0)
        .attr("y1", function(d) {
            return -(arcBase + 10 + (arcSpace * d.arcRank));
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
        .attr("x", -5)
        .attr("y", -5)
        .attr("width", 10)
        .attr("height", 10)
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
        .attr("cy", 0)
        .attr("r", 4)
        .attr("stroke-width", 4)
        .attr("stroke", function(d) {
            return color(d.pos);
        })
        .attr("fill", "white");
});