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
var CIV = {
    arcBase: 100,
    arcSpace: 14,
    arcWidth: 1.5,
    color: d3.scaleOrdinal(d3.schemeCategory10),
    coords: [0, 0],
    game: "civ4bts",
    ilization: "CIVILIZATION_ALL",
    dataTypes: ["units", "buildings", "religions", "build", "resources", "projects", "promotions", "civics"]
};

// Update mouse coordinates variable
var body = d3.select("body")
	.on("mousemove", function() {
		CIV.coords = d3.mouse(this);
	})
	.on("mousedown", function() {
		CIV.coords = d3.mouse(this);
	});

// Drawing area
var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1000 - margin.left - margin.right,
    height = 1000 - margin.top - margin.bottom;
    
// Draw leads to arcs
var arc = d3.arc()
    .innerRadius(function(d) {
        return CIV.arcBase + (CIV.arcSpace * d.arcRank);
    })
    .outerRadius(function(d) {
        return (CIV.arcBase + CIV.arcWidth) + (CIV.arcSpace * d.arcRank);
    })
    .startAngle(function(d) {
        return -1 * d.arcBack;
    })
    .endAngle(function(d) {
        return d.arcDist;   
    });

var unlockArc = d3.arc()
    .innerRadius(function(d) {
        return CIV.arcBase + 283 + (17 * d.rank);
    })
    .outerRadius(function(d) {
        return (CIV.arcBase + 283 + CIV.arcWidth) + (17 * d.rank);
    })
    .startAngle(function(d) {
        return -1 * d.arcBack;
    })
    .endAngle(function(d) {
        return d.arcEnd;   
    });


// Set game wheel to what's currently in selection box
makeWheel(document.getElementById('selectGame')
    .options[document.getElementById('selectGame').selectedIndex].value, CIV.ilization);

// Game selection drop-down
d3.select("#selectGame")
    .on("change", function() {
        d3.selectAll(".civWheel").remove();
        d3.select("#tooltip").classed("hidden", true);

        CIV.ilization = "CIVILIZATION_ALL";
        document.getElementById("selectCiv").value = CIV.ilization;

        var selectCiv = document.getElementById("selectCiv");
        selectCiv.options.length = 1;

        CIV.game = this.options[this.selectedIndex].value;

        if (CIV.game === "civ1" || CIV.game === "civ2") {
            CIV.arcSpace = 13;
            d3.select("#selectCivBox").classed("hidden", true);
        } else {
            CIV.arcSpace = 14;
            d3.select("#selectCivBox").classed("hidden", false);
        }

        makeWheel(CIV.game);
    });

// Close the details box
d3.select("#tooltip")
    .on("click", function(d) {
        d3.select("#tooltip").classed("hidden", true);
    });