/** @type {import('@remix-run/dev').AppConfig} */
const postcssNesting = require("postcss-nesting");
module.exports = {
  appDirectory: "src",
  future: {
    unstable_postcss: true,
  },
};
