const Joi = require('@hapi/joi');
const http = require('http');
const https = require('https');
const flags = require('./flags.js');

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
  emoji: Joi.string().allow(''),
  computer: Joi.string().valid('apple', 'windows', 'linux'),
  phone: Joi.string().valid('iphone', 'android'),
  tags: Joi.array().items(Joi.string()),
});

module.exports.getStatusCode = function(url) {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const REQUEST_TIMEOUT = 10000;
    const timeoutId = setTimeout(
      reject,
      REQUEST_TIMEOUT,
      new Error('Request timed out')
    );

    client
      .get(url, res => {
        clearTimeout(timeoutId);
        resolve(res.statusCode);
      })
      .on('error', err => reject(err));
  });
};
