function orderDisplayed(data) {
    // Give each technology an arbitrary position value
    for (var i = 0; i < data.displayed.length; i++) {
        data.displayed[i].pos = i;
    }

    for (var i = 0; i < data.displayed.length; i++) {
        var maxCost = 0;
        if (data.displayed[i].cost) {
            maxCost = data.displayed[i].cost;
        }
        var preReqs = getTechPrereqs(data.displayed[i], data);

        for (var j = 0; j < preReqs.length; j++) {
            if (preReqs[j].cost > maxCost) {
                maxCost = preReqs[j].cost;
            }
        }

        data.displayed[i].pos = maxCost;
    }
    
    data.displayed.sort(function(a, b) {
        return a.pos - b.pos;
    });

    for (var i = 0; i < data.displayed.length; i++) {
        data.displayed[i].pos = i;
        for (var j = 0; j < data.displayed[i].unlocks.length; j++) {
            data.displayed[i].unlocks[j].pos = i;
        }            
    }
}