// Lets plain Node scripts import server modules: "server-only" is provided by Next's bundler, not node_modules.
const Module = require("module");
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return require.resolve("./server-only-empty.cjs");
  return resolve.call(this, request, ...rest);
};
