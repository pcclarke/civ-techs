function makeWheel(game) {

    var path = game + "/civdata.json";

    var svg = d3.select("#chart").append("svg")
        .attr("class", "civWheel")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
    .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");


    d3.json(path, function(data) {

        // Functions to process data so wheel can be drawn        
        setupData(data);
        orderDisplayed(data);
        setupArcs(data);
        
        // Debug processed data
        console.log(data.displayed);

        drawWheel();
        
        // Draw portions of the wheel
        function drawWheel() {
            var wheel = svg.append("g")
                .attr("class", "wheel")
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
                .attr("y2", function(d) {
                    return -(width / 2) + 120 - (d.unlocks.length * 17);
                });
                
            spokes.append("image") // Displayed item icons
                .attr("class", "techImg")
                .attr("transform", function(d) {
                    if (d.pos > (data.displayed.length / 2)) {
                        return "translate(10, " + (-(width / 2) + 122) + ") rotate(90)";
                    }
                    return "translate(-10, " + (-(width / 2) + 142) + ") rotate(270)";
                })
                .attr("height", 20)
                .attr("width", 20)
                .attr("xlink:href", function(d) {
                    var link;
                    if (d.cat === "units" || d.cat === "buildings") {
                        link = game + "/img/" + d.cat + "/" + d.CIVILIZATION_ALL.id + ".png";
                    } else {
                        link = game + "/img/" + d.cat + "/" + d.id + ".png";
                    }
                    return link;
                })
                .on("mouseover", function(d) {
                    var tipName = "";
                    if (d.cat === "units" || d.cat === "buildings") {
                        tipName = d.CIVILIZATION_ALL.name;
                    } else {
                        tipName = d.name;
                    }
                    displayTooltip(tipName);
                })
                .on("mouseout", function(d) {
                    d3.select("#tooltip").classed("hidden", true);
                })
                .on("click", function(d) {
                    displayDetailsBox(d);
                });

            var unlockIcons = spokes.selectAll(".unlock")
                .data(function(d) {
                    return d.unlocks;
                })
                .enter().append("image")
                .attr("class", "unlock")
                .attr("transform", function(d) {
                    if (d.pos > (data.displayed.length / 2)) {
                        return "translate(7.5, " + (-(width / 2) + (100 - (17 * d.rank))) + ") rotate(90)";
                    }
                    return "translate(-7.5, " + (-(width / 2) + (115 - (17 * d.rank))) + ") rotate(270)";
                })
                .attr("height", 15)
                .attr("width", 15)
                .attr("xlink:href", function(d) {
                    var link;
                    if (d.ref.cat === "units" || d.ref.cat === "buildings") {
                        link = game + "/img/" + d.ref.cat + "/" + d.ref.CIVILIZATION_ALL.id + ".png";
                    } else {
                        link = game + "/img/" + d.ref.cat + "/" + d.ref.id + ".png";
                    }
                    return link;
                })
                .on("mouseover", function(d) {
                    var tipName = "";
                    if (d.ref.cat === "units" || d.ref.cat === "buildings") {
                        tipName = d.ref.CIVILIZATION_ALL.name;
                    } else {
                        tipName = d.ref.name;
                    }
                    displayTooltip(tipName);
                })
                .on("mouseout", function(d) {
                    d3.select("#tooltip").classed("hidden", true);
                })
                .on("click", function(d) {
                    displayDetailsBox(d.ref);
                });

            function displayTooltip(name) {
                d3.select("#tooltip")
                    .style("left", coordinates[0] + "px")
                    .style("top", coordinates[1] + "px");

                d3.select("#tipName").text(name);

                d3.select("#tooltip").classed("hidden", false);
            }

            function displayDetailsBox(item) {
                var itemCat = item.cat;
                var itemName = "";
                var itemId = "";
                if (itemCat === "units" || itemCat === "buildings") {
                    itemName = item.CIVILIZATION_ALL.name;
                    itemId = item.CIVILIZATION_ALL.id;
                } else {
                    itemName = item.name;
                    itemId = item.id;
                }

                d3.select("#descTitle").text(itemName);
                d3.select("#descImg").attr("src", game + "/img/" + itemCat + "/" + itemId + ".png");
                if (item.requires) {
                    var reqText = "None";
                    var reqs = getReqTechPreReqs(item, data);
                    for (var i = 0; i < reqs.length; i++) {
                        if (i == 0) {
                            reqText = reqs[i].name;
                        } else if (i == reqs.length - 1 && reqs.length == 2) {
                            reqText = reqText + " and " + reqs[i].name;
                        } else if (i == reqs.length - 1) {
                            reqText = reqText + ", and " + reqs[i].name;    
                        } else {
                            reqText = reqText + ", " + reqs[i].name;
                        }
                    }
                    d3.select("#descMand").text(reqText);
                    d3.select("#descMandLine").classed("hidden", false);
                    d3.select("#descNoLine").classed("hidden", true);
                } else {
                    d3.select("#descMandLine").classed("hidden", true);
                    if (!item.optional) {
                        d3.select("#descNoLine").classed("hidden", false);
                    }
                }
                if (item.optional) {
                    var optText = "None";
                    var opts = getOptTechPreReqs(item, data);
                    for (var i = 0; i < opts.length; i++) {
                        if (i == 0) {
                            optText = opts[i].name;
                        } else if (i == opts.length - 1 && opts.length == 2) {
                            optText = optText + " or " + opts[i].name;
                        } else if (i == opts.length - 1) {
                            optText = optText + ", or " + opts[i].name;    
                        } else {
                            optText = optText + ", " + opts[i].name;
                        }
                    }
                    if (item.requires) {
                        d3.select("#descPlusLine").classed("hidden", false);    
                    } else {
                        d3.select("#descPlusLine").classed("hidden", true);
                    }
                    d3.select("#descOpt").text(optText);
                    d3.select("#descOptLine").classed("hidden", false);
                    d3.select("#descNoLine").classed("hidden", true);
                } else {
                    d3.select("#descPlusLine").classed("hidden", true);
                    d3.select("#descOptLine").classed("hidden", true);
                    d3.select("#descOpt").text("None");
                }
                d3.select("#description").classed("hidden", false);
            }

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
                .attr("x", -2.5)
                .attr("y", -0.75)
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
                var ang = d.dist * (360 / data.displayed.length);
                return "rotate(" + ang + ") translate(0, " + (-arcBase - 2.5 - (arcSpace * d.arcRank)) + ")";
            })
            .attr("class", "optCircle");
            
            optCircles.append("circle")
                .attr("cx", 0)
                .attr("cy", 2)
                .attr("r", 2.5)
                .attr("stroke-width", 1)
                .attr("stroke", function(d) {
                    return color(d.pos);
                })
                .attr("fill", "white");
        }

    });

}