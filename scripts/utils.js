/* eslint-disable @typescript-eslint/no-var-requires */
const core = require('@actions/core');
const Joi = require('joi');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const ts = require('typescript');
const flags = require('./flags.js');

/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
module.exports.parseDataSource = function (source) {
  const file = ts.createSourceFile(
    'data.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  if (file.parseDiagnostics.length || file.statements.length !== 1) {
    throw new Error(
      'Contributor data must contain one module.exports assignment'
    );
  }

  const statement = file.statements[0];
  const assignment = statement.expression;
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isBinaryExpression(assignment) ||
    assignment.operatorToken.kind !== ts.SyntaxKind.EqualsToken ||
    !ts.isPropertyAccessExpression(assignment.left) ||
    !ts.isIdentifier(assignment.left.expression) ||
    assignment.left.expression.text !== 'module' ||
    assignment.left.name.text !== 'exports'
  ) {
    throw new Error('Contributor data must assign an array to module.exports');
  }

  function literal(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      return node.text;
    if (ts.isNumericLiteral(node)) return Number(node.text);
    if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (node.kind === ts.SyntaxKind.NullKeyword) return null;
    if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
    if (ts.isObjectLiteralExpression(node)) {
      const value = Object.create(null);
      for (const property of node.properties) {
        if (
          !ts.isPropertyAssignment(property) ||
          (!ts.isIdentifier(property.name) &&
            !ts.isStringLiteral(property.name))
        ) {
          throw new Error(
            'Contributor data may contain only literal properties'
          );
        }
        value[property.name.text] = literal(property.initializer);
      }
      return value;
    }
    throw new Error('Contributor data may contain only literal values');
  }

  const data = literal(assignment.right);
  if (!Array.isArray(data))
    throw new Error('Contributor data must be an array');
  return data;
};

module.exports.getMasterData = function () {
  return module.exports.parseDataSource(fs.readFileSync('src/data.js', 'utf8'));
};

module.exports.readCandidateData = function (filePath) {
  if (
    fs.realpathSync(filePath) !== path.resolve(filePath) ||
    !fs.lstatSync(filePath).isFile()
  ) {
    throw new Error(
      'Contributor data must be a regular file without symlinked parents'
    );
  }
  return module.exports.parseDataSource(fs.readFileSync(filePath, 'utf8'));
};
/* eslint-enable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

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
  mastodon: Joi.string().pattern(new RegExp(/^@(\w){1,30}@(\w)+\.(.?\w)+$/)),
  bluesky: Joi.string().pattern(new RegExp(/^[\w-]+\.(?:[\w-]+\.)?[\w-]+$/)),
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

    // Some hosts (Cloudflare, Caddy, etc.) block requests that don't send a
    // browser-like User-Agent, returning a 403 even though the page is live.
    // Send one so we don't produce false-positive failures for those sites.
    const requestOptions = {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; awesome-uses-link-checker/1.0; +https://github.com/wesbos/awesome-uses)',
      },
    };

    client
      .get(url, requestOptions, (res) => {
        clearTimeout(timeoutId);
        resolve(res.statusCode);
      })
      .on('error', (err) => reject(err));
  });
};

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

  core.info(`Validation results:\n${comment}`);
};
