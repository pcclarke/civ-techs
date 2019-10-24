// Get a list of the required technology prerequisites for a given thing
export function getReqTechPreReqs(examine, data) {
  let preReqs = [];

  if (examine.requires) {
    for (let i = 0; i < data.technologies.length; i++) {
      if ((Array.isArray(examine.requires) && examine.requires.indexOf(data.technologies[i].id) !== -1) ||
        (examine.requires === data.technologies[i].id)) {
        preReqs.push(data.technologies[i]);
      }
    }
  }

  return preReqs;
};

// Get a list of the displayed things this technology leads to that require it
 export function getLeadsToReq(examine, compareData) {
  let leads = [];

  for (let i = 0; i < compareData.length; i++) {
    if (compareData[i].requires &&
      ((Array.isArray(compareData[i].requires) && compareData[i].requires.indexOf(examine.id) !== -1) ||
      (compareData[i].requires === examine.id))) {
      leads.push(compareData[i]);
    }
  }

  return leads;
};

// Get a list of the optional technology prerequisites for a given thing
export function getOptTechPreReqs (examine, data) {
  let preReqs = [];

  if (examine.optional) {
    for (let i = 0; i < data.technologies.length; i++) {
      if ((Array.isArray(examine.optional) && examine.optional.indexOf(data.technologies[i].id) !== -1) ||
        (examine.optional === data.technologies[i].id)) {
        preReqs.push(data.technologies[i]);
      }
    }
  }

  return preReqs;
};

// Get a list of the displayed things this technology leads to that optionally require it
export function getLeadsToOpt(examine, compareData) {
  let leads = [];

  for (let i = 0; i < compareData.length; i++) {
    if (compareData[i].optional &&
      ((Array.isArray(compareData[i].optional) && compareData[i].optional.indexOf(examine.id) !== -1) ||
      (compareData[i].optional === examine.id))) {
      leads.push(compareData[i]);
    }
  }

  return leads;
};

// Get a list of the technology prerequsites (required and optional) for a given thing (techs, units, whatever)
export function getTechPrereqs(examine, data) {
  let preReqs = [];

  if (examine.requires) {
    for (let i = 0; i < data.technologies.length; i++) {
      if ((Array.isArray(examine.requires) && examine.requires.indexOf(data.technologies[i].id) !== -1) ||
        (examine.requires === data.technologies[i].id)) {
        preReqs.push(data.technologies[i]);
      }
    }
  }
  if (examine.optional) {
    for (let i = 0; i < data.technologies.length; i++) {
      if ((Array.isArray(examine.optional) && examine.optional.indexOf(data.technologies[i].id) !== -1) ||
        (examine.optional === data.technologies[i].id)) {
        preReqs.push(data.technologies[i]);
      }
    }
  }

  return preReqs;
};

// Get a list of the displayed things this technology leads to (required and optional)
export function getLeadsTo(examine, compareData) {
  let leads = [];

  for (let i = 0; i < compareData.length; i++) {
    if (compareData[i].requires &&
      ((Array.isArray(compareData[i].requires) && compareData[i].requires.indexOf(examine.id) !== -1) ||
      (compareData[i].requires === examine.id))) {
      leads.push(compareData[i]);
    }
    if (compareData[i].optional &&
      ((Array.isArray(compareData[i].optional) && compareData[i].optional.indexOf(examine.id) !== -1) ||
      (compareData[i].optional === examine.id))) {
      leads.push(compareData[i]);
    }
  }

  return leads;
};

// Returns a technology item by its Id
export function getTechById(examineId, data) {
  let tech = 'BAD_ID';

  for (let i = 0; i < data.technologies.length; i++) {
    if (data.technologies[i].id === examineId) {
      tech = data.technologies[i];
    }
  }

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

  for (let i = 0; i < nearbyList.length; i++) {
    otherReqs = getTechPrereqs(nearbyList[i], data);

    for (let j = 0; j < otherReqs.length; j++) {
      if (otherReqs[j].id !== origin.id) {
        fartherList.push(otherReqs[j]);
      }
    }
  }

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
    for (let i = 0; i < examine.special.length; i++) {
      examine.special[i].requires = [];
      examine.special[i].requires.push(examine.id);
      examine.special[i].cat = 'specials';
      specials.push(examine.special[i]);
    }
  }

  return specials;
};