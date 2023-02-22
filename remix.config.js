const { config } = require("@netlify/remix-edge-adapter");
/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ...config,
  appDirectory: "src",
  future: {
    unstable_postcss: true,
  },
  assetsBuildDirectory: "publicxxxx/baller",
  ignoredRouteFiles: ["**/.*"],
  server:
    process.env.NETLIFY || process.env.NETLIFY_LOCAL
      ? "./server.js"
      : undefined,
  // serverBuildPath: ".netlify/functions-internal/server.js",
};
