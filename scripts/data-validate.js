import Joi from '@hapi/joi';
import core from '@actions/core';
import data from '../src/data.js';

const schema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().required(),
  url: Joi.string()
    .uri()
    .required(),
  country: Joi.string().required(),
  twitter: Joi.string(),
  emoji: Joi.string(),
  computer: Joi.string().valid('apple', 'windows', 'linux'),
  phone: Joi.string().valid('iphone', 'ios', 'android'),
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
