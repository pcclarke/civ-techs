// Determine the image path for an icon link
export function setImageLink(reference, game, empire) {
  let link = '';

  if ((reference.cat === 'units' || reference.cat === 'buildings') && !(game === 'civ1' || game === 'civ2')) {
    if (reference[empire]) {
      link = `${game}/${reference.cat}/${reference[empire].id}.png`;
    } else {
      link = `${game}/${reference.cat}/${reference.CIVILIZATION_ALL.id}.png`;
    }
  } else {
    link = `${game}/${reference.cat}/${reference.id}.png`;
  }

  return link;
}

// Turn an array of strings into an oxford comma sentence
export function oxfordizer(words, conjunction) {
  let sentence = '';

  if (words.length === 1) {
    sentence = words[0];
  } else if (words.length === 2) {
    sentence = `${words[0]} ${conjunction} ${words[1]}`;
  } else if (words.length >= 3) {
    sentence = words[0];
    for (let i = 1; i < words.length - 1; i++) {
      sentence = `${sentence}, ${words[i]}`;
    }
    sentence = `${sentence}, ${conjunction} ${words[words.length - 1]}`;
  }

  return sentence;
}
