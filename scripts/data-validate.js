import Joi from '@hapi/joi';
import core from '@actions/core';
import * as http from 'http';
import * as https from 'https';
import data from '../src/data.js';
import flags from './flags.js';

if (process.env.CI !== 'true') {
  core.error = console.error;
  core.setFailed = console.error;
}

const schema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  url: Joi.string()
    .uri()
    .required(),
  country: Joi.string()
    .valid(...flags)
    .required(),
  twitter: Joi.string().pattern(new RegExp(/^@?(\w){1,15}$/)),
  emoji: Joi.string().allow(''),
  computer: Joi.string().valid('apple', 'windows', 'linux'),
  phone: Joi.string().valid('iphone', 'android'),
  tags: Joi.array().items(Joi.string()),
});

const errors = data
  .map(person => schema.validate(person))
  .filter(v => v.error)
  .map(v => v.error);

errors.forEach(e => {
  core.error(e._original.name);
  e.details.forEach(d => core.error(d.message));
});

if (errors.length) {
  core.setFailed('Action failed with validation errors, see logs');
}
const REQUEST_TIMEOUT = 10000;

function getStatusCode(url) {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    setTimeout(() => reject(new Error('Request timed out')), REQUEST_TIMEOUT);
    client
      .get(url, res => {
        resolve(res.statusCode);
      })
      .on('error', err => {
        reject(err);
      });
  });
}

async function isWorkingUrl(url) {
  try {
    const statusCode = await getStatusCode(url);
    if (statusCode < 200 || statusCode >= 400) {
      core.error(`Ping to "${url}" failed with status: ${statusCode}`);
      return false;
    }
    return true;
  } catch (e) {
    core.error(`Ping to "${url}" failed with error: ${e}`);
    return false;
  }
}

(async () => {
  // TODO: we might need to batch these in sets instead of requesting 100+ URLs
  // at the same time
  const areWorkingUrls = await Promise.all(
    data.map(p => p.url).map(url => isWorkingUrl(url))
  );
  const failingUrls = areWorkingUrls.filter(a => !a);
  if (failingUrls.length > 0) {
    core.setFailed(
      `Action failed with ${failingUrls.length} URL fetch failures, see logs`
    );
  }
  process.exit(0);
})();
