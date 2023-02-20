/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  appDirectory: "src",
  future: {
    unstable_postcss: true,
  },
  ignoredRouteFiles: ["**/.*"],
  server:
    process.env.NETLIFY || process.env.NETLIFY_LOCAL
      ? "./server.js"
      : undefined,
  serverBuildPath: ".netlify/functions-internal/server.js",
};
