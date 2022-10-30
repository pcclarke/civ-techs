import { game } from '../stores.js';
import { get } from 'svelte/store';

// Determine the image path for an icon link
export function setImageLink(category, id) {
  return `${get(game).id}/${category}/${id}.png`;
}

// Turn an array of strings into an oxford comma sentence
export function oxfordizer(words = [], conjunction = 'and') {
  if (words.length <= 0) {
    console.warn('Oxfordizer passed empty array');
    return null;
  };
  if (words.length === 1) return words[0];
  if (words.length === 2) return `${words[0]} ${conjunction} ${words[1]}`;

  let sentence = words[0];
  for (let i = 1; i < words.length - 1; i++) {
    sentence = `${sentence}, ${words[i]}`;
  }
  sentence = `${sentence}, ${conjunction} ${words[words.length - 1]}`;
  return sentence;
}