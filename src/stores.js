import { derived, get, writable } from 'svelte/store';

import { games } from './constants.js';

export const game = writable(games[0]);

export const data = derived(
  game,
  ($game) => {
    return loadData($game.id);
  }
);

async function loadData(gameId) {
  const response = await fetch(`./data/${gameId}.json`);
  const responseJson = await response.json();

  if (get(game).base >= 3) {
    const defaultEmpire = {id: 'any', name: 'Default'};
    empires.set([defaultEmpire, ...responseJson.civilizations]);
    selectedEmpire.set(defaultEmpire);
  } else {
    empires.set([]);
  }

  return responseJson;
}

export const empires = writable([]);

export const selectedEmpire = writable({id: null, name: null});

// export const empire = derived(
//   [game, data],
//   ([$game, $data]) => {
//     if ($game.base >= 3) {
//       empires = [{id: 'any', name: 'Default'}, ...data.civilizations];
//       selectedEmpire = empires[0];
//     } else {
//       empires = [];
//     }
//   }
// )