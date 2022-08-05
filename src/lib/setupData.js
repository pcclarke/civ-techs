import { cloneDeep } from 'lodash';
import { object_without_properties } from 'svelte/internal';

import { dataTypes } from '../constants.js';
import { getLeadsTo } from './dataTools.js';
import { orderDisplayed }  from './orderDisplayed.js';
import { setupArcs } from './setupArcs.js';

export function setupData(data, installment) {
  const sortedData = createUnlocks(data, installment);
  const orderedData = orderDisplayed(sortedData, installment);
  const setupArc = setupArcs(orderedData);

  return setupArc;
}

export function buildRelationships(data) {
  let requirementData = data.technologies.map(d => {
    let obj = { id: d.id, name: d.name };
    let prerequisites = [];

    if (d.requires) {
      const reqs = d.requires.map(r => ({id: r, type: 'requires'}));
      prerequisites = prerequisites.concat(reqs);
    }
    if (d.optional) {
      const opts = d.optional.map(o => ({id: o, type: 'optional'}));
      prerequisites = prerequisites.concat(opts);
    }
    if (prerequisites.length > 0) {
      obj.prerequisites = prerequisites;
    }

    return obj;
  });

  const orderedData = requirementData.map(d => {
    d.depth = [...new Set(getAllPrerequisites(d, requirementData))].length;
    return d;
  }).sort((a, b) => a.depth - b.depth)
    .map((d, i) => {
      let {depth, ...rel} = d;
      rel.pos = i;
      return rel
    });

  console.log(orderedData);

  return orderedData;
}

// Returns the tree depth from the earliest requirement to a given technology
function getAllPrerequisites(tech, data) {
  let prerequisites = [];

  if (tech.prerequisites) {
    prerequisites = prerequisites.concat(tech.prerequisites.map(p => p.id));

    tech.prerequisites.forEach(pre => {
      const t = data.find(d => d.id === pre.id);
      prerequisites = prerequisites.concat(getAllPrerequisites(t, data));
    });
  }

  return prerequisites;
}

export function buildArcs(data) {
  let arcs = [];
  let arcOrbitEnds = [];

  for (const techArc of data) {
    let leadsTo = [];

    for (const techCompare of data) {
      if (techCompare.prerequisites) {
        const rel = techCompare.prerequisites.find(p => p.id === techArc.id);
        if (rel) {
          leadsTo.push({
            id: techCompare.id,
            pos: techCompare.pos,
            type: rel.type
          });
        }
      }
    }

    if (leadsTo.length > 0) {
      leadsTo.push({
        id: techArc.id,
        pos: techArc.pos,
        type: 'origin'
      });

      const start = Math.min(...leadsTo.map(l => l.pos));
      const end = Math.max(...leadsTo.map(l => l.pos));
      const orbit = (() => {
        let orbitIndex = arcOrbitEnds.findIndex(e => e < start);
        if (orbitIndex >= 0) {
          arcOrbitEnds[orbitIndex] = end;
          return orbitIndex;
        } else {
          arcOrbitEnds.push(end);
          return arcOrbitEnds.length - 1;
        }
      })();

      arcs.push({
        start: start,
        end: end,
        orbit: orbit,
        leads: leadsTo.sort((a, b) => a.pos - b.pos)
      });
    }
  }
  
  return arcs;
}

export function buildSpokes(arcs, data, relationships) {
  let spokes = [];

  for (const tech of relationships) {
    let obj = {};

    obj.pos = tech.pos;

    obj.orbit = (() => {
      if (tech.prerequisites) {
        let minOrbit = 500;

        for (const arc of arcs) {
          if (arc.leads.find(l => l.id === tech.id) && arc.orbit < minOrbit) {
            minOrbit = arc.orbit;
          }
        }

        return minOrbit;
      } else {
        return -1;
      }
    })();

    obj.unlocks = (() => {
      let found = [];

      Object.keys(data)
        .filter(d => d !== "technologies" && d !== "civilizations" && d !== "displayed")
        .forEach(type => {
        for (const unlock of data[type]) {
          if (unlock.requires && (
            (Array.isArray(unlock.requires) && unlock.requires.find(u => u === tech.id)) ||
            (unlock.requires === tech.id)
          )) {
            found.push(unlock);
          }
        }
      });

      return found;
    })();

    obj.id = tech.id;
    obj.name = tech.name;

    spokes.push(obj);
  }

  return spokes;
}

function createUnlocks(data, installment) {
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
    let unlocks = [];

    d.cat = 'technologies';
    displayed.push(d);

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
  dataTypes.forEach((t) => {
    if (sortedData[t]) {
      sortedData[t].forEach((d) => {
        d.cat = t;
      });
    }
  });

  return sortedData;
}