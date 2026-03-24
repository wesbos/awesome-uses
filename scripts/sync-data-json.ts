import {
  getGeneratedPeopleJsonPath,
  loadPeopleFromDataJs,
  writePeopleJsonSnapshot,
} from './lib/data-file';

async function main() {
  const people = await loadPeopleFromDataJs();
  await writePeopleJsonSnapshot(people);
  console.log(
    `Wrote ${people.length} people to ${getGeneratedPeopleJsonPath()}.`
  );
}

void main();
