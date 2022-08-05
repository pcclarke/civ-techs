import { derived, get, writable } from 'svelte/store';

import { games } from './constants.js';
import {
  buildArcs,
  buildRelationships,
  buildSpokes,
  setupData
} from './lib/setupData.js';

export const game = writable(games[0]);

export const hovered = writable('');

export const arcSpace = derived(game, ($game) => ($game.base < 4) ? 10 : 10);

export const empires = writable([]);

export const empire = writable({id: null, name: null});

