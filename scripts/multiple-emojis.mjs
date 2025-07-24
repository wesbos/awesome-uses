import people from '../src/data.js';

function stringLength(str) {
  return Array.from(new Intl.Segmenter().segment(str)).length;
}

function checkEmojiLength(person) {
  if(stringLength(person.emoji) > 1 && person.emoji) {
    console.log(person.name, person.emoji);
  }
}

people.map(checkEmojiLength);
