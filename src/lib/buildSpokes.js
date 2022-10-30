import { oxfordizer, setImageLink } from './stringTools.js';

// Assemble data required to draw the spokes
export function buildSpokes(arcs, data, game, empire, relationships) {
  let spokes = [];
  let assignedUnlocks = [];

  for (const tech of [...relationships].reverse()) {
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
              let u = {cat: type};

              u.requirements = (() => {
                const reqArr = (Array.isArray(unlock.requires)) ? unlock.requires : [unlock.requires];
                const reqNames = reqArr.map(q => relationships.find(r => r.id === q).name);
                return oxfordizer(reqNames);
              })();

              if(unlock[empire.id]) {
                u.id = unlock[empire.id].id;
                u.name = unlock[empire.id].name;
              } else if (unlock['CIVILIZATION_ALL']) {
                u.id = unlock['CIVILIZATION_ALL'].id;
                u.name = unlock['CIVILIZATION_ALL'].name;
              } else {
                u.id = unlock.id;
                u.name = unlock.name;
              }
              
              if (!assignedUnlocks.includes(u.id)) {
                u.imagePath = setImageLink(type, u.id);
                found.push(u);
                assignedUnlocks.push(u.id);
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
            imagePath: setImageLink('specials', s.id),
            name: s.name,
            requirements: techItem.name
          });
        });
      }

      return found;
    })();

    obj.id = tech.id;
    obj.name = tech.name;

    obj.imagePath = setImageLink('technologies', tech.id);

    // Add info to set up modal box
    const modalRelationship = relationships.find(r => r.id === tech.id);

    if (modalRelationship.prerequisites) {
      const prerequisites = modalRelationship.prerequisites
        .map(({id, type}) => ({
          name: relationships.find(r => r.id === id).name,
          type: type
        }));

      const requirements = prerequisites.filter(({type}) => type === 'requires');
      if (requirements.length > 0) {
        obj.requirements = requirements.map(({name}) => name);
      }

      const optionals = prerequisites.filter(({type}) => type === 'optional');
      if (optionals.length > 0) {
        obj.optionals = oxfordizer(optionals.map(({name}) => name), 'or');
      }
    }

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
      obj.leadsRequirements = oxfordizer(leadsRequired.map(l => l.name), 'and');
    }

    const leadsOptional = leadsTechs.filter(t => t.type === 'optional');
    if (leadsOptional.length > 0) {
      obj.leadsOptionals = oxfordizer(leadsOptional.map(l => l.name), 'and');
    }

    spokes.push(obj);
  }

  return spokes;
}