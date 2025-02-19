import exec from '@actions/exec';
import core from '@actions/core';
import github from '@actions/github';
import Joi from 'joi';
import http from 'http';
import https from 'https';
import flags from './flags.js';

async function getCurrentBranchName() {
  let myOutput = '';
  let myError = '';

  const options = {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => (myOutput += data.toString()),
      stderr: (data: Buffer) => (myError += data.toString()),
    },
  };

  await exec.exec('git rev-parse --abbrev-ref HEAD', [], options);
  return myOutput.trim();
}

/** on master branch will return an empty array */
export const getMasterData = async function () {
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

  // eslint-disable-next-line global-require
  const masterData = (await import('./masterData.js')).default as Person[];

  // restore `scripts/masterData.js` after was loaded
  if (curentBranchName !== 'master') {
    await exec.exec('git restore scripts/masterData.js', [], options);
  }

  return masterData;
};

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
  twitter: Joi.string().pattern(/^@?(\w){1,15}$/),
  mastodon: Joi.string().pattern(/^@(\w){1,30}@(\w)+\.(.?\w)+$/),
  bluesky: Joi.string().pattern(/^[\w-]+\.(?:[\w-]+\.)?[\w-]+$/),
  emoji: Joi.string().allow(''),
  computer: Joi.string().valid('apple', 'windows', 'linux', 'bsd'),
  phone: Joi.string().valid('iphone', 'android', 'windowsphone', 'flipphone'),
  tags: Joi.array().items(Joi.string()),
});

/*
   TODO: This should be inferred but then I want to move to Valibot. If you give a moose a muffin.
*/
export type Person = {
  name: string;
  description: string;
  url: string;
  country: string;
  twitter?: `@${string}`;
  mastodon?: string;
  bluesky?: string;
  emoji?: string;
  computer?: 'apple' | 'windows' | 'linux' | 'bsd';
  phone?: 'iphone' | 'android' | 'windowsphone' | 'flipphone';
  tags?: string[];
};

export const getStatusCode = function (url: string) {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const REQUEST_TIMEOUT = 10000;
    const timeoutId = setTimeout(
      reject,
      REQUEST_TIMEOUT,
      new Error('Request timed out')
    );

    client
      .get(url, (res) => {
        clearTimeout(timeoutId);
        resolve(res.statusCode);
      })
      .on('error', (err) => reject(err));
  });
};

// If there are errors, will fail the action & add a comment detailing the issues
// If there are no errors, will leave an "all-clear" comment with relevant URLs (to ease a potential manual check)
export const communicateValidationOutcome = function (
  errors: { message: string }[],
  failedUrls: string[],
  changedData: { name: string; url: string }[]
) {
  let comment = '';
  if (errors.length || failedUrls.length) {
    core.setFailed('Action failed with errors, see logs & comment');

    comment += [
      '🚨 We have detected the following issues, let us (contributors) know if you need support or clarifications:',
      ...errors.map((e) => `- ${e.message}`),
      ...failedUrls.map((url) => `- URL is invalid: ${url}`),
    ].join('\n');
  } else {
    comment += [
      '✅ Automatic validation checks succeeded for:',
      // Comment with the URLs of users that have changed
      // for easy access, way easier than taking a screenshot
      ...changedData.map(({ name, url }) => `- ${name}, ${url}`),
    ].join('\n');
  }

  const { GITHUB_TOKEN } = process.env;
  const { context } = github;
  if (!GITHUB_TOKEN || !context.payload.pull_request) {
    core.error(
      'Cannot add a comment if GITHUB_TOKEN or context.payload.pull_request is not set'
    );
    core.info(`Comment contents:\n${comment}`);
  }
  // TODO: Re-enable a way to comment on PRs that tests passed.
  // const pullRequestNumber = context.payload.pull_request.number;

  // const octokit = new github.getOctokit(GITHUB_TOKEN);
  // await octokit.rest.pulls.createReviewComment({
  //   ...context.repo,
  //   pullRequestNumber,
  //   body: comment,
  // });
};
