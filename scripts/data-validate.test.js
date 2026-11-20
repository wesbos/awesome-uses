/* eslint-disable @typescript-eslint/no-var-requires */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { parseDataSource, readCandidateData, Schema } = require('./utils.js');

const validEntry = `module.exports = [{
  name: 'Example',
  description: 'A developer setup',
  url: 'https://example.com/uses',
  country: '🇺🇸',
  tags: ['JavaScript'],
}];`;

test('parses the existing contributor file and valid entries', () => {
  const existing = parseDataSource(fs.readFileSync('src/data.js', 'utf8'));
  assert.ok(existing.length > 0);
  assert.equal(
    Schema.validate(parseDataSource(validEntry)[0]).error,
    undefined
  );
});

test('invalid entries retain schema errors', () => {
  const invalid = validEntry.replace('https://example.com/uses', 'not a URL');
  assert.match(
    Schema.validate(parseDataSource(invalid)[0]).error.message,
    /url/
  );
});

test('rejects executable expressions without running them', () => {
  global.__dataValidationSideEffect = false;
  const malicious = validEntry.replace(
    "name: 'Example'",
    'name: (global.__dataValidationSideEffect = true)'
  );
  assert.throws(() => {
    parseDataSource(malicious);
  }, /literal values/);
  assert.equal(global.__dataValidationSideEffect, false);
  delete global.__dataValidationSideEffect;
});

test('rejects statements outside the data assignment', () => {
  assert.throws(() => {
    parseDataSource(`${validEntry}\nprocess.exit(0);`);
  }, /one module.exports assignment/);
});

test('rejects a candidate file through a symlinked parent directory', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'uses-validation-'));
  const source = path.join(directory, 'trusted', 'src');
  const submitted = path.join(directory, 'candidate', 'src');
  fs.mkdirSync(source, { recursive: true });
  fs.mkdirSync(path.dirname(submitted));
  fs.writeFileSync(path.join(source, 'data.js'), validEntry);
  fs.symlinkSync(source, submitted);
  try {
    assert.equal(readCandidateData(path.join(source, 'data.js')).length, 1);
    assert.throws(() => {
      readCandidateData(path.join(submitted, 'data.js'));
    }, /symlinked parents/);
  } finally {
    fs.rmSync(directory, { recursive: true });
  }
});
