const core = require('@actions/core');
const { getMasterData, Schema, getStatusCode } = require('./utils.js');
const srcData = require('../src/data.js');

async function main() {
  // on master branch will be empty array
  const masterDataUrls = (await getMasterData()).map(d => d.url);
  // so here data will be an array with all users
  const data = srcData.filter(d => !masterDataUrls.includes(d.url));

  const errors = data
    .map(person =>
      Schema.validate(person, {
        abortEarly: false,
      })
    )
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

  return {
    failedUrls,
    errors,
    data,
  };
}

module.exports = main;
