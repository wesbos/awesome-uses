/* eslint-disable import/no-extraneous-dependencies */
const { fail, markdown, schedule } = require('danger');
const validate = require('./scripts/data-validate');

async function main() {
  let comment = '';
  const { data: changedData, errors, failedUrls } = await validate();

  // If there are errors, will fail the action & add a comment detailing the issues
  // If there are no errors, will leave an "all-clear" comment with relevant URLs (to ease a potential manual check)
  if (errors.length || failedUrls.length) {
    fail('Action failed with errors, see logs & comment');

    comment += [
      '🚨 We have detected the following issues, let us (contributors) know if you need support or clarifications:',
      ...errors.map(e => `- ${e.message}`),
      ...failedUrls.map(url => `- URL is invalid: ${url}`),
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
