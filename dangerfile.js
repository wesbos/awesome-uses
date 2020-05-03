/* eslint-disable import/no-extraneous-dependencies */
const { fail, markdown, schedule } = require('danger');
const validate = require('./scripts/data-validate');

async function main() {
  let comment = '';
  const { data: changedData, errorMsgs, failedUrls } = await validate();

  // If there are errors, will fail the action & add a comment detailing the issues
  // If there are no errors, will leave an "all-clear" comment with relevant URLs (to ease a potential manual check)
  if (errorMsgs.length || failedUrls.length) {
    fail(
      `Action failed with ${errorMsgs.length +
        failedUrls.length} errors, see logs & comment`
    );

    comment += [
      '🚨 We have detected the following issues, let us (contributors) know if you need support or clarifications:',

      ...errorMsgs.map(msg => `- ${msg}`),

      ...failedUrls.map(({ url, error, statusCode }) => {
        if (error) return `- URL is invalid: ${url}, error: ${error.message}`;
        return `- URL is invalid: ${url}, status code: ${statusCode}`;
      }),
    ].join('\n');
  } else if (changedData.length) {
    comment += [
      '✅ Automatic validation checks succeeded for:',
      // Comment with the URLs of users that have changed
      // for easy access, way easier than taking a screenshot
      ...changedData.map(({ name, url }) => `- ${name}, ${url}`),
    ].join('\n');
  }

  if (comment) markdown(comment);
}

schedule(main);
