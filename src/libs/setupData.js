import {cloneDeep} from 'lodash';

import {getLeadsTo} from './dataTools.js';
import {orderDisplayed}  from '../libs/orderDisplayed.js';
import {setupArcs} from '../libs/setupArcs.js';

export function setupData(data, nonTechnologies, installment, types) {
  const sortedData = createUnlocks(data, nonTechnologies, installment, types);
  const orderedData = orderDisplayed(sortedData, installment);
  return setupArcs(orderedData);
}

function createUnlocks(data, nonTechnologies, installment, types) {
  let sortedData = cloneDeep(data);
  let displayed = [];
  let unlocksList = [];

  // First, arrange the technologies by cost
  if (installment > 3) {
    sortedData.technologies.sort((a, b) => b.cost - a.cost);
  }

  // Scoop up all the things each technology leads to and put it in the unlocks object
  sortedData.technologies.forEach((d) => {
    let uniqueUnlocks = [];
    let unlocks;

    d.cat = 'technologies';
    displayed.push(d);

    unlocks = getLeadsTo(d, sortedData.units);
    unlocks = unlocks.concat(getLeadsTo(d, sortedData.buildings));
    unlocks = unlocks.concat(getLeadsTo(d, sortedData.build));
    if (sortedData.civics) {
        unlocks = unlocks.concat(getLeadsTo(d, sortedData.civics));
    }
    if (sortedData.projects) {
        unlocks = unlocks.concat(getLeadsTo(d, sortedData.projects));
    }
    if (sortedData.promotions) {
        unlocks = unlocks.concat(getLeadsTo(d, sortedData.promotions));
    }
    if (sortedData.religions) {
        unlocks = unlocks.concat(getLeadsTo(d, sortedData.religions));
    }
    if (sortedData.resources) {
        unlocks = unlocks.concat(getLeadsTo(d, sortedData.resources));
    }

    if (d.special) {
      d.special.forEach(function (s) {
        s.cat = 'specials';
        s.requires = [];
        s.requires.push(d.id);
        unlocks.push(s);
      });
    }

    unlocks.forEach(function (u, j) {
      let matchFound = 0;
      unlocksList.forEach(function (l, k) {
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
    uniqueUnlocks.forEach(function (u, j) {
      let unlocksItem = {};
      unlocksItem.rank = j;
      unlocksItem.ref = u;
      unlocksHandler.push(unlocksItem);
    });
    d.unlocks = unlocksHandler;
  });

  sortedData.displayed = displayed;

  // Label data categories
  types.forEach(function (t) {
    if (sortedData[t]) {
      sortedData[t].forEach(function (d) {
        d.cat = t;
      });
    }
  });

  return sortedData;
}