const core = require('@actions/core');
const { getMasterData, Schema, getStatusCode } = require('./utils.js');
const srcData = require('../src/data.js');

(async () => {
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

  let failedUrlsCount = 0;
  for (const { url } of data) {
    try {
      const statusCode = await getStatusCode(url);
      if (statusCode < 200 || statusCode >= 400) {
        core.error(`Ping to "${url}" failed with status: ${statusCode}`);
        failedUrlsCount += 1;
      }
    } catch (e) {
      core.error(`Ping to "${url}" failed with error: ${e}`);
      failedUrlsCount += 1;
    }
  }

  if (failedUrlsCount) {
    core.error(`Action failed with ${failedUrlsCount} URL fetch failures`);
  }

  if (errors.length || failedUrlsCount) {
    core.setFailed('Action failed with errors, see logs');
  }
})();
