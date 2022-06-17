import {cloneDeep} from 'lodash';

import {getLeadsTo} from './dataTools.js';
import {orderDisplayed}  from './orderDisplayed.js';
import {setupArcs} from './setupArcs.js';

export function setupData(data, nonTechnologies, installment, types) {
  const sortedData = createUnlocks(data, nonTechnologies, installment, types);
  const orderedData = orderDisplayed(sortedData, installment);
  const setupArc = setupArcs(orderedData);

  return setupArc;
}

function createUnlocks(data, nonTechnologies, installment, types) {
  let sortedData = cloneDeep(data);
  let displayed = [];
  let unlocksList = [];

  console.log(sortedData);

  // First, arrange the technologies by cost
  if (installment > 3) {
    sortedData.technologies.sort((a, b) => b.cost - a.cost);
  }

  // Scoop up all the things each technology leads to and put it in the unlocks object
  sortedData.technologies.forEach((d) => {
    let uniqueUnlocks = [];
    let unlocks = [];

    d.cat = 'technologies';
    displayed.push(d);

    const dataTypes = [
      'buildings',
      'build',
      'civics',
      'projects',
      'promotions',
      'religions',
      'resources',
      'units'
    ]
    for (let i = 0; i < dataTypes.length; i++) {
      if (sortedData[dataTypes[i]]) {
        unlocks = unlocks.concat(getLeadsTo(d, sortedData[dataTypes[i]]));
      }
    }

    if (d.special) {
      d.special.forEach((s) => {
        s.cat = 'specials';
        s.requires = [];
        s.requires.push(d.id);
        unlocks.push(s);
      });
    }

    unlocks.forEach((u, j) => {
      let matchFound = 0;
      unlocksList.forEach((l, k) => {
        if (u.id === l.id) {
          matchFound = 1;
        }
      });
      if (matchFound !== 1) {
          uniqueUnlocks.push(u);
      }
    });
    unlocksList = unlocksList.concat(uniqueUnlocks);

    let unlocksHandler = [];
    uniqueUnlocks.forEach((u, j) => {
      let unlocksItem = {};
      unlocksItem.rank = j;
      unlocksItem.ref = u;
      unlocksHandler.push(unlocksItem);
    });
    d.unlocks = unlocksHandler;
  });

  sortedData.displayed = displayed;

  // Label data categories
  types.forEach((t) => {
    if (sortedData[t]) {
      sortedData[t].forEach((d) => {
        d.cat = t;
      });
    }
  });

  return sortedData;
}