import { derived, get, writable } from 'svelte/store';

import { games } from './constants.js';
import { setupData } from './lib/setupData.js'; 

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

  return setupData(responseJson, game.base);
}

export const empires = writable([]);

export const empire = writable({id: null, name: null});
