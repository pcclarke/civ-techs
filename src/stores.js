import { derived, get, writable } from 'svelte/store';

import { games } from './constants.js';
import {
  buildArcs,
  buildRelationships,
  buildSpokes,
  setupData
} from './lib/setupData.js'; 

export const game = writable(games[0]);

export const arcSpace = derived(game, ($game) => ($game.base < 4) ? 16 : 18);

export const data = derived(
  game,
  ($game) => {
    return loadData($game);
  }
);

async function loadData(game) {
  const response = await fetch(`./data/${game.id}.json`);
  const responseJson = await response.json();

  if (game.base >= 3) {
    const defaultEmpire = {id: 'any', name: 'Default'};
    empires.set([defaultEmpire, ...responseJson.civilizations]);
    empire.set(defaultEmpire);
  } else {
    empires.set([]);
  }

  let d = setupData(responseJson, game.base);

  const relationships = buildRelationships(d);
  d.arcs = buildArcs(relationships);
  d.spokes = buildSpokes(d, relationships)

  return d;
}

export const empires = writable([]);

export const empire = writable({id: null, name: null});
