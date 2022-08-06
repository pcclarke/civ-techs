import { derived, writable } from 'svelte/store';
import { games } from './constants.js';

export const game = writable(games[0]);

export const hovered = writable('');

export const arcSpace = derived(game, ($game) => ($game.base < 4) ? 10 : 10);

export const empires = writable([]);

export const empire = writable({id: null, name: null});