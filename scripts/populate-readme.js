import fs from 'fs';
import data from '../src/data.js';

/** @type {string} */
const readmeTemplate = fs.readFileSync('./scripts/readme-template.md', 'utf8');
const formatedData = data
  .map(page => `* [${page.name}](${page.url}) — ${page.description}`)
  .join('\r\n');

fs.writeFileSync(
  'generated-readme.md',
  readmeTemplate.replace('###DATA_PLACEHOLDER###', formatedData)
);
