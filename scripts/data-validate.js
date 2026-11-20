/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('@actions/core');
const {
  getMasterData,
  readCandidateData,
  Schema,
  getStatusCode,
  communicateValidationOutcome,
} = require('./utils.js');

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions */
async function main() {
  const candidatePath = process.argv[2];
  if (!candidatePath) throw new Error('Provide the contributor data file path');
  const srcData = readCandidateData(candidatePath);
  const masterDataUrls = getMasterData().map((d) => d.url);
  const data = srcData.filter(
    (d) => !d || typeof d !== 'object' || !masterDataUrls.includes(d.url)
  );

  const results = data.map((person) => Schema.validate(person));
  const errors = results
    .filter((result) => result.error)
    .map((result) => result.error);

  errors.forEach((e) => {
    core.error(
      e._original?.name || e._original?.url || 'Invalid contributor entry'
    );
    e.details.forEach((d) => core.error(d.message));
  });

  const failedUrls = [];
  for (const {
    value: { url },
  } of results.filter((result) => !result.error)) {
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

  await communicateValidationOutcome(errors, failedUrls, data);
}

main().catch((error) => core.setFailed(error.message));
/* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/restrict-template-expressions */
