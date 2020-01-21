const core = require('@actions/core');
const github = require('@actions/github');
const { getMasterData, Schema, getStatusCode } = require('./utils.js');
const srcData = require('../src/data.js');

async function commentPullRequest(errors, failedUrls, changedData) {
  let comment = '';
  if (errors.length || failedUrls.length) {
    core.setFailed('Action failed with errors, see logs & comment');

    comment += [
      '🚨 We have detected the following issues, let us contributors know if you need support or clarifications:',
      ...errors.map(e => `- ${e.message}`),
      ...failedUrls.map(url => `- URL is invalid: ${url}`),
    ].join('\n');
  } else {
    comment += [
      '✅ Automatic validation checks succeeded for URLs:',
      // Comment with the URLs of users that have changed
      // for easy access, way easier than taking a screenshot
      ...changedData.map(({ url }) => `- ${url}`),
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

  await commentPullRequest(errors, failedUrls, data);
}

main();
