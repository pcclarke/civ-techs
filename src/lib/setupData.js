import { oxfordizer, setImageLink } from './stringTools.js';

// Get technologies with prerequisites by order of tree depth
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
      return rel;
    });

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

// Assemble data required to draw the arcs
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

// Assemble data required to draw the spokes
export function buildSpokes(arcs, data, game, empire, relationships) {
  let spokes = [];
  let assignedUnlocks = [];

  for (const tech of relationships.reverse()) {
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
        .filter(d => d !== "technologies" && d !== "civilizations")
        .forEach(type => {
          for (const unlock of data[type]) {
            if (unlock.requires && (
              (Array.isArray(unlock.requires) && unlock.requires.find(u => u === tech.id)) ||
              (unlock.requires === tech.id)
            )) {
              if(unlock[empire.id]) {
                if (!assignedUnlocks.includes(unlock[empire.id].id)) {
                  found.push({
                    cat: type,
                    id: unlock[empire.id].id,
                    name: unlock[empire.id].name,
                    requires: unlock.requires
                  });
                  assignedUnlocks.push(unlock[empire.id].id);
                }
              } else if (unlock['CIVILIZATION_ALL']) {
                if (!assignedUnlocks.includes(unlock['CIVILIZATION_ALL'].id)) {
                  found.push({
                    cat: type,
                    id: unlock['CIVILIZATION_ALL'].id,
                    name: unlock['CIVILIZATION_ALL'].name,
                    requires: unlock.requires
                  });
                  assignedUnlocks.push(unlock['CIVILIZATION_ALL'].id);
                }
              } else {
                if (!assignedUnlocks.includes(unlock.id)) {
                  found.push({
                    cat: type,
                    id: unlock.id,
                    name: unlock.name,
                    requires: unlock.requires
                  });
                  assignedUnlocks.push(unlock.id);
                }
              }
            }
          }
        });

      const techItem = data.technologies.find(d => d.id === tech.id);
      if (techItem.special) {
        techItem.special.forEach(s => {
          found.push({
            cat: 'specials',
            id: s.id,
            name: s.id,
            requires: techItem.id
          });
        });
      }

      return found;
    })();

    obj.id = tech.id;
    obj.name = tech.name;

    // Add info to set up modal box
    obj.modal = {};

    const modalRelationship = relationships.find(r => r.id === tech.id);

    if (modalRelationship.prerequisites) {
      const prerequisites = modalRelationship.prerequisites
        .map(p => {
          return {
            name: relationships.find(r => r.id === p.id).name,
            type: p.type
          };
        });

        obj.modal.requirements = oxfordizer(
        prerequisites.filter(p => p.type === 'requires').map(p => p.name),
      'and');

      const optionals = prerequisites.filter(p => p.type === 'optional');
      if (optionals.length > 0) {
        obj.modal.optionals = oxfordizer(optionals.map(o => o.name), 'and');
      }
    }

    obj.modal.imagePath = setImageLink({
      cat: 'technologies',
      id: tech.id,
      name: tech.name
    }, game.id);

    obj.modal.title = tech.name;

    const leadsTechs = relationships.filter(r => {
      return r?.prerequisites?.find(p => p.id === tech.id);
    }).map(r => {
      const rel = r.prerequisites.find(p => p.id === tech.id);

      return {
        name: r.name,
        type: rel.type
      };
    });

    const leadsRequired = leadsTechs.filter(t => t.type === 'requires');
    if (leadsRequired.length > 0) {
      obj.modal.leadsRequirements = oxfordizer(leadsRequired.map(l => l.name), 'and');
    }

    const leadsOptional = leadsTechs.filter(t => t.type === 'optional');
    if (leadsOptional.length > 0) {
      obj.modal.leadsOptionals = oxfordizer(leadsOptional.map(l => l.name), 'and');
    }

    spokes.push(obj);
  }

  return spokes;
}