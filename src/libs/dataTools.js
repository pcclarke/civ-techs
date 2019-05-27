// Get a list of the required technology prerequisites for a given thing
export function getReqTechPreReqs(examine, data) {
  let preReqs = [];

  if (examine.requires) {
    data.technologies.forEach((t) => {
      if (Array.isArray(examine.requires)) {
        examine.requires.forEach((r) => {
            if (r === t.id) {
              preReqs.push(t);
            }
        });
      } else {
        if (examine.requires === t.id) {
          preReqs.push(t);
        }
      }
    });
  }

  return preReqs;
};

// Get a list of the displayed things this technology leads to that require it
 export function getLeadsToReq(examine, compareData) {
  let leads = [];

  compareData.forEach((d) => {
    if (d.requires) {
      if (Array.isArray(d.requires)) {
        d.requires.forEach((r) => {
            if(r === examine.id) {
              leads.push(d);
            }
        });
      } else {
        if (d.requires === examine.id) {
          leads.push(d);
        }
      }
    }
  });

  return leads;
};

// Get a list of the optional technology prerequisites for a given thing
export function getOptTechPreReqs (examine, data) {
  let preReqs = [];

  if (examine.optional) {
    data.technologies.forEach((t) => {
      if (Array.isArray(examine.optional)) {
        examine.optional.forEach((o) => {
          if (o === t.id) {
            preReqs.push(t);
          }
        });
      } else {
        if (examine.optional === t.id) {
          preReqs.push(t);
        }
      }
    });
  }

  return preReqs;
};

// Get a list of the displayed things this technology leads to that optionally require it
export function getLeadsToOpt(examine, compareData) {
  let leads = [];

  compareData.forEach((c) => {
    if (c.optional) {
      if (Array.isArray(c.optional)) {
        c.optional.forEach((o) => {
          if (o === examine.id) {
            leads.push(c);
          }
        });
      } else {
        if (c.optional === examine.id) {
          leads.push(c);
        }
      }
    }
  });

    return leads;
};

// Get a list of the technology prerequsites (required and optional) for a given thing (techs, units, whatever)
export function getTechPrereqs(examine, data) {
  let preReqs = [];

  if (examine.requires) {
    data.technologies.forEach((t) => {
      if (Array.isArray(examine.requires)) {
        examine.requires.forEach((r) => {
          if (r === t.id) {
            preReqs.push(t);
          }
        });
      } else {
        if (examine.requires === t.id) {
          preReqs.push(t);
        }
      }
    });
  }
  if (examine.optional) {
    data.technologies.forEach((t) => {
      if (Array.isArray(examine.optional)) {
        examine.optional.forEach((o) => {
          if (o === t.id) {
            preReqs.push(t);
          }
        });
      } else {
        if (examine.optional === t.id) {
          preReqs.push(t);
        }
      }
    });
  }

  return preReqs;
};

// Get a list of the displayed things this technology leads to (required and optional)
export function getLeadsTo(examine, compareData) {
  let leads = [];

  compareData.forEach((c) => {
    if (c.requires) {
      if (Array.isArray(c.requires)) {
        c.requires.forEach((r) => {
          if (r === examine.id) {
            leads.push(c);
          }
        });
      } else {
        if (c.requires === examine.id) {
          leads.push(c);
        }
      }
    }
    if (c.optional) {
      if (Array.isArray(c.optional)) {
        c.optional.forEach((o) => {
          if (o === examine.id) {
            leads.push(c);
          }
        });
      } else {
        if (c.optional === examine.id) {
          leads.push(c);
        }
      }
    }
  });

  return leads;
};

// Returns a technology item by its Id
export function getTechById(examineId, data) {
  let tech = 'BAD_ID';

  data.technologies.forEach((t) => {
    if (t.id === examineId) {
      tech = t;
    }
  });

  return tech;
};

// For a given technology, creates a list including:
// technologies that it requires (optional & mandatory)
// technologies it leads to
// anything else it leads to and the other technologies they require
export function findNearby(origin, data) {
  let nearbyList;
  let fartherList = [];
  let obsoleteTech;
  let otherReqs;

  nearbyList = getTechPrereqs(origin, data);
  nearbyList = nearbyList.concat(convertSpecial(origin));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.technologies));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.promotions));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.projects));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.build));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.buildings));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.civics));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.religions));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.resources));
  nearbyList = nearbyList.concat(getLeadsTo(origin, data.units));

  nearbyList.forEach((n) => {
    otherReqs = getTechPrereqs(n, data);

    otherReqs.forEach((o) => {
      if (o.id !== origin.id) {
        fartherList.push(o);
      }
    });
  });

  nearbyList = nearbyList.concat(fartherList);
  nearbyList.push(origin);

  if (origin.obsolete) {
    obsoleteTech = getTechById(origin.obsolete, data);
    nearbyList.push(obsoleteTech);
  }

  return nearbyList;
};

// Converts the specials in a technology into prereq objects
export function convertSpecial(examine) {
  let specials = [];

  if (examine.special) {
    examine.special.forEach((s) => {
      s.requires = [];
      s.requires.push(examine.id);
      s.cat = 'specials';
      specials.push(s);
    });
  }

  return specials;
};