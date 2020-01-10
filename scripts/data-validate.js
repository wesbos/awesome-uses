import Joi from '@hapi/joi';
import core from '@actions/core';
import data from '../src/data.js';
import flags from './flags.js';

const schema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  url: Joi.string()
    .uri()
    .required(),
  country: Joi.string()
    .valid(...flags)
    .required(),
  twitter: Joi.string().pattern(new RegExp(/^@?(\w){1,15}$/)),
  emoji: Joi.string().allow(''),
  computer: Joi.string().valid('apple', 'windows', 'linux'),
  phone: Joi.string().valid('iphone', 'android'),
  tags: Joi.array().items(Joi.string()),
});

const errors = data
  .map(person => schema.validate(person))
  .filter(v => v.error)
  .map(v => v.error);

errors.forEach(e => {
  core.error(e._original.name);
  e.details.forEach(d => core.error(d.message));
});

if (errors.length) {
  core.setFailed('Action failed with validation errors, see logs');
}
