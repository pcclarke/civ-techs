var barWidth = 20;
var lastBar = -1;
var techs;
 

function preload() {
  var url = window.location.href + "technologies.json";
  techs = loadJSON(url);
}

function setup() {
  createCanvas(1000, 1000);
  smooth();
  
  console.log(techs.technologies.length);
}

function draw() {
  strokeWeight(1);
  stroke(200, 200, 200);
  
  push();
  translate(width / 2, height / 2);
  
  for (var i = 0; i < techs.technologies.length; i++) {
    push();
    rotate(i * (2 * PI / techs.technologies.length));
    line(0, 0, 0, -500);
    text(techs.technologies[i].name, 0, -450);
    
    /*console.log(techs.technologies.requires.length);
    if (techs.technologies.requires) {
      console.log("hey!");
      for (var j = 0; j < techs.technologies[i].requires.length; j++) {
        var pos = i;
        var dist = 0;
        
        while (pos >= 0) {
          pos--;
          if (techs.technologies[pos].name === techs.technologies[i].requires[j].name) {
            dist = i - pos;
            break;
          }
        }
        console.log(dist);
        arc(0, -200, 50, 50, 0, -dist * (2 * PI / techs.technologies.length));
      }
    }*/
    pop();
    //console.log(techs.technologies[i].name);
  }
  
  pop();
}