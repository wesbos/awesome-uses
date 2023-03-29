const exec = require('@actions/exec');
const core = require('@actions/core');
const github = require('@actions/github');
const Joi = require('joi');
const http = require('http');
const https = require('https');
const flags = require('./flags.js');

async function getCurrentBranchName() {
  let myOutput = '';
  let myError = '';

  const options = {
    silent: true,
    listeners: {
      stdout: (data) => (myOutput += data.toString()),
      stderr: (data) => (myError += data.toString()),
    },
  };

  await exec.exec('git rev-parse --abbrev-ref HEAD', [], options);
  return myOutput.trim();
}

/** on master branch will return an empty array */
module.exports.getMasterData = async function () {
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
  const masterData = require('./masterData.js');

  // restore `scripts/masterData.js` after was loaded
  if (curentBranchName !== 'master') {
    await exec.exec('git restore scripts/masterData.js', [], options);
  }

  return masterData;
};

module.exports.Schema = Joi.object({
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
  computer: Joi.string().valid('apple', 'windows', 'linux', 'bsd'),
  phone: Joi.string().valid('iphone', 'android', 'windowsphone', 'flipphone'),
  tags: Joi.array().items(Joi.string()),
});

module.exports.getStatusCode = function (url) {
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
module.exports.communicateValidationOutcome = async function (
  errors,
  failedUrls,
  changedData
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
    return;
  }

  const pullRequestNumber = context.payload.pull_request.number;

  const octokit = new github.getOctokit(GITHUB_TOKEN);
  await octokit.rest.issues.createComment({
    ...context.repo,
    issue_number: pullRequestNumber,
    body: comment,
  });
};
