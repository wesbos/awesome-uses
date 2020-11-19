const { Schema, getStatusCode } = require('./utils.js');
const srcData = require('../src/data.js');

async function main(masterData = []) {
  const masterDataUrls = masterData.map(d => d.url);
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

  const errorMsgs = [];

  errors.forEach(e => {
    e.details.forEach(d =>
      errorMsgs.push(`${e._original.name || e._original.url}: ${d.message}`)
    );
  });

  /**
   * @type {{url: string, statusCode?: number, error?: Error}[]}
   */
  const failedUrls = [];
  for (const { url } of data) {
    try {
      const statusCode = await getStatusCode(url);
      if (statusCode < 200 || statusCode >= 400) {
        failedUrls.push({ url, statusCode });
      }
    } catch (e) {
      failedUrls.push({ url, error: e });
    }
  }

  return {
    failedUrls,
    errorMsgs,
    data,
  };
}

module.exports = main;
