const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Share FE service/type sources without moving the existing web application.
config.watchFolders = [path.resolve(__dirname, "../src"), path.resolve(__dirname, "../shared")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Shared sources must resolve React from the native project, not the web root.
  const nativeRuntime = /^(react|react-native)(\/|$)/.test(moduleName);
  return context.resolveRequest(
    nativeRuntime ? { ...context, originModulePath: path.join(__dirname, "package.json") } : context,
    moduleName,
    platform,
  );
};
module.exports = config;
