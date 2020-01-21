const core = require('@actions/core');
const github = require('@actions/github');
const { getMasterData, Schema, getStatusCode } = require('./utils.js');
const srcData = require('../src/data.js');

async function commentPullRequest(errors, failedUrls /* , imagePath */) {
  let comment = '';
  if (errors.length || failedUrls.length) {
    core.setFailed('Action failed with errors, see logs & comment');

    comment += 'Fix the following issues: ';
    comment += errors.map(e => e.message).join('\n');
    comment += failedUrls.join('\n');
  } else {
    comment += 'No validation issues detected.';
  }

  const GITHUB_TOKEN = core.getInput('GITHUB_TOKEN');
  console.log('GITHUB_TOKEN', GITHUB_TOKEN);
  console.log('process.env.GITHUB_TOKEN', process.env.GITHUB_TOKEN);
  const { context } = github;
  console.log(context.payload.pull_request);
  if (!GITHUB_TOKEN || !context.payload.pull_request) return;

  const pullRequestNumber = context.payload.pull_request.number;

  const octokit = new github.GitHub(GITHUB_TOKEN);
  await octokit.issues.createComment({
    ...context.repo,
    issue_number: pullRequestNumber,
    body: comment,
  });
}

async function main() {
  // on master branch will be empty array
  const masterDataUrls = (await getMasterData()).map(d => d.url);
  // so here data will be an array with all users
  const data = srcData.filter(d => !masterDataUrls.includes(d.url));

  const errors = data
    .map(person => Schema.validate(person))
    .filter(v => v.error)
    .map(v => v.error);

  errors.forEach(e => {
    core.error(e._original.name || e._original.url);
    e.details.forEach(d => core.error(d.message));
  });

  const failedUrls = [];
  for (const { url } of data) {
    try {
      const statusCode = await getStatusCode(url);
      if (statusCode < 200 || statusCode >= 400) {
        core.error(`Ping to "${url}" failed with status: ${statusCode}`);
        failedUrls.push(url);
      }
    } catch (e) {
      core.error(`Ping to "${url}" failed with error: ${e}`);
      failedUrls.push(url);
    }
  }

  await commentPullRequest(errors, failedUrls, '');
}

main();
