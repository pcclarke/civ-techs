var barWidth = 20;
var lastBar = -1;

function setup() {
  createCanvas(720, 400);
  colorMode(HSB, width, height, 100); 
  noStroke();
}

function draw() {
  var whichBar = mouseX / barWidth;
  if (whichBar != lastBar) {
    var barX = whichBar * barWidth;
    fill(barX, mouseY, 66);
    rect(barX, 0, barWidth, height);
    lastBar = whichBar;
  }
}