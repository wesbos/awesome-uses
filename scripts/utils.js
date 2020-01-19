import exec from '@actions/exec';
import core from '@actions/core';
import Joi from '@hapi/joi';
import * as http from 'http';
import * as https from 'https';
import flags from './flags.js';

async function getCurrentBranchName() {
  let myOutput = '';
  let myError = '';

  const options = {
    silent: true,
    listeners: {
      stdout: data => (myOutput += data.toString()),
      stderr: data => (myError += data.toString()),
    },
  };

  await exec.exec('git rev-parse --abbrev-ref HEAD', [], options);
  return myOutput.trim();
}

/** on master branch will return an empty array */
export async function getMasterData() {
  const options = { silent: true };
  const curentBranchName = await getCurrentBranchName();
  // when on a branch/PR different from master
  // will populate scripts/masterData.js with src/data.js from master
  if (curentBranchName !== 'master') {
    core.info('Executing action on branch different from master');
    await exec.exec('mv src/data.js src/tmpData.js', [], options);
    await exec.exec('git fetch origin master', [], options);
    await exec.exec('git restore --source=FETCH_HEAD src/data.js', [], options);
    await exec.exec('mv src/data.js scripts/masterData.js', [], options);
    await exec.exec('mv src/tmpData.js src/data.js', [], options);
  } else {
    core.info('Executing action on master branch');
  }

  const masterData = await import('./masterData.js').then(m => m.default);

  // restore `scripts/masterData.js` after was loaded
  if (curentBranchName !== 'master') {
    await exec.exec('git restore scripts/masterData.js', [], options);
  }

  return masterData;
}

export const Schema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  url: Joi.string()
    .uri()
    .required()
    .pattern(/(use|uses|using|setup|environment|^https:\/\/gist.github.com\/)/),
  country: Joi.string()
    .valid(...flags)
    .required(),
  twitter: Joi.string().pattern(new RegExp(/^@?(\w){1,15}$/)),
  emoji: Joi.string().allow(''),
  computer: Joi.string().valid('apple', 'windows', 'linux'),
  phone: Joi.string().valid('iphone', 'android'),
  tags: Joi.array().items(Joi.string()),
});

export function getStatusCode(url) {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const REQUEST_TIMEOUT = 10000;
    const timeoutId = setTimeout(
      reject,
      REQUEST_TIMEOUT,
      new Error('Request timed out')
    );

    client
      .get(url, res => {
        clearTimeout(timeoutId);
        resolve(res.statusCode);
      })
      .on('error', err => reject(err));
  });
}
