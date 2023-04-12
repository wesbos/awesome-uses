const { config } = require("@netlify/remix-edge-adapter");
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ...(process.env.NETLIFY || process.env.NETLIFY_LOCAL ? config : {}),
  appDirectory: "src",
  future: {
    unstable_postcss: true,
  },
  ignoredRouteFiles: ["**/.*"],
  server:
    process.env.NETLIFY || process.env.NETLIFY_LOCAL
      ? "./server.js"
      : undefined,
  // serverBuildPath: ".netlify/functions-internal/server.js",
};
