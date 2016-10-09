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
var arcBase = 100;
var arcWidth = 1.5;
var arcSpace = 14;
var zoomed = false;

var coordinates = [0, 0];

// Update mouse coordinates variable
var body = d3.select("body")
	.on("mousemove", function() {
		coordinates = d3.mouse(this);
	})
	.on("mousedown", function() {
		coordinates = d3.mouse(this);
	});

// Drawing area
var margin = {top: 10, right: 10, bottom: 10, left: 10},
    width = 1000 - margin.left - margin.right,
    height = 1000 - margin.top - margin.bottom;
    
// Draw leads to arcs
var arc = d3.arc()
    .innerRadius(function(d) {
        return arcBase + (arcSpace * d.arcRank);
    })
    .outerRadius(function(d) {
        return (arcBase + arcWidth) + (arcSpace * d.arcRank);
    })
    .startAngle(function(d) {
        return -1 * d.arcBack;
    })
    .endAngle(function(d) {
        return d.arcDist;   
    });
    
// Colour scale for arcs
var color = d3.scaleOrdinal(d3.schemeCategory10);

// Set game wheel to what's currently in selection box
var sel = document.getElementById('selectGame');
makeWheel(sel.options[sel.selectedIndex].value);

// Game selection drop-down
d3.select("#selectGame")
        .on("change", selected);

function selected() {
    d3.selectAll(".civWheel")
        .remove();
    d3.select("#description").classed("hidden", true);
    makeWheel(this.options[this.selectedIndex].value);
}

// Close the details box
d3.select("#descCloseButton")
    .on("click", function(d) {
        d3.select("#description").classed("hidden", true);
    });