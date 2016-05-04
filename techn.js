var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1000 - margin.left - margin.right,
    height = 1000 - margin.top - margin.bottom;
    
var arc = d3.svg.arc()
    .innerRadius(function(d) {
        return 180 + (5 * d.arcRank);
    })
    .outerRadius(function(d) {
        return 185 + (5 * d.arcRank);
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
    
    // Then add in the technologies into their prerequisites so that the arcs can be set up
    for (var i = 0; i < data.technologies.length; i++) {
        var rekked = []; // copy leads to required technologies
        var opted = []; // copy leads to optional technologies
        var arcDist = 0;
        
        for (var j = 0; j < data.technologies.length; j++) {
            if (data.technologies[j].requires) {
                for (var k = 0; k < data.technologies[j].requires.length; k++) {                    
                    if (data.technologies[j].requires[k] === data.technologies[i].name) {
                        rekked.push(data.technologies[j].name);
                        arcDist = data.technologies[j].pos - data.technologies[i].pos;
                    }
                }
            }
            if (data.technologies[j].optional) {
                for (var k = 0; k < data.technologies[j].optional.length; k++) {
                    if (data.technologies[j].optional[k] === data.technologies[i].name) {
                        opted.push(data.technologies[j].name);
                        arcDist = data.technologies[j].pos - data.technologies[i].pos;
                    }
                }
            }
        }
        
        if (rekked.length > 0) {
            data.technologies[i].lreq = rekked;
        }
        if (opted.length > 0) {
            data.technologies[i].lopt = opted;
        }
        data.technologies[i].arcDist = ((2 * Math.PI) / data.technologies.length) * arcDist;
        data.technologies[i].arcRank = i;
    }
    
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
        .attr("y1", 0)
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
});