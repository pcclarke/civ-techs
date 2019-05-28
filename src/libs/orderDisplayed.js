import {getTechPrereqs} from './dataTools.js';
import {cloneDeep} from 'lodash';

export function orderDisplayed(data, installment) {
  let orderedData = cloneDeep(data);
  let i = 0;
  let maxCost;
  let preReqs;

  // Give each technology an arbitrary position value
  orderedData.displayed.forEach((d) => {
    d.pos = i;
    i = i + 1;
  });

  if (installment > 3) {
    orderedData.displayed.forEach((d) => {
      maxCost = 0;
      if (d.cost) {
        maxCost = d.cost;
      }
      preReqs = getTechPrereqs(d, data);

      preReqs.forEach((p) => {
        if (p.cost > maxCost) {
          maxCost = p.cost;
        }
      });

      d.pos = maxCost;
    });
  }

  orderedData.displayed.sort((a, b) => a.pos - b.pos);

  i = 0;
  orderedData.displayed.forEach((d) => {
    d.pos = i;
    i = i + 1;

    d.unlocks.forEach((u) => u.pos = i);
  });

  return orderedData;
};