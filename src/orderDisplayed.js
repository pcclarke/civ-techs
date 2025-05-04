import { getTechPrereqs } from "./dataTools";

export default function orderDisplayed(data) {
    var i = 0;
    var maxCost;
    var preReqs;

    // Give each technology an arbitrary position value
    data.displayed.forEach(function (d) {
        d.pos = i;
        i = i + 1; 
    });

    data.displayed.forEach(function (d) {
        maxCost = 0;
        if (d.cost) {
            maxCost = d.cost;
        }
        preReqs = getTechPrereqs(d, data);

        preReqs.forEach(function (p) {
            if (p.cost > maxCost) {
                maxCost = p.cost;
            }
        });

        d.pos = maxCost;
    });
    
    data.displayed.sort(function(a, b) {
        return a.pos - b.pos;
    });

    i = 0;
    data.displayed.forEach(function (d) {
        d.pos = i;
        i = i + 1;
        d.unlocks.forEach(function (u) {
            u.pos = i;
        });
    });
};