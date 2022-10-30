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