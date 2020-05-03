/* eslint-disable import/no-extraneous-dependencies */
const { fail, markdown, message, schedule } = require('danger');
const validate = require('./scripts/data-validate');

async function main() {
  const { data: changedData, errorMsgs, failedUrls } = await validate();

  // If there are errors, will fail the action & add a comment detailing the issues
  if (errorMsgs.length) {
    fail(`There are ${errorMsgs.length} validation error(s)`);

    markdown(
      `### Validation Issues\n${errorMsgs.map(msg => `- ${msg}`).join('\n')}`
    );
  }

  if (failedUrls.length) {
    fail(`There are ${failedUrls.length} failing URL(s)`);

    markdown(
      `### Failing URLs\n${failedUrls
        .map(({ url, error, statusCode }) => {
          if (error)
            return `- URL, ${url}, failed with error: ${error.message}`;
          return `- URL, ${url}, failed with status code: ${statusCode}`;
        })
        .join('\n')}`
    );
  }

  // If there are no errors, will leave an "all-clear" comment with relevant URLs (to ease a potential manual check)
  if (!errorMsgs.length && !failedUrls.length && changedData.length) {
    message('Automatic validation checks succeeded', { icon: '✅' });
    // Comment with the URLs of users that have changed
    // for easy access, way easier than taking a screenshot
    markdown(
      `### Changed URLs\n${changedData
        .map(({ name, url }) => `- ${name}, ${url}`)
        .join('\n')}`
    );
  }
}

schedule(main);
