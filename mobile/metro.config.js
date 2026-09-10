const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);
// Share FE service/type sources without moving the existing web application.
config.watchFolders = [path.resolve(__dirname, "../src"), path.resolve(__dirname, "../shared")];
config.resolver.nodeModulesPaths = [path.resolve(__dirname, "node_modules")];
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Any non-relative module import (react, react-native, react-native-svg, etc.)
  // must strictly resolve from mobile/node_modules to prevent duplicate native component registrations.
  const isBareModule = !moduleName.startsWith(".") && !path.isAbsolute(moduleName);
  return context.resolveRequest(
    isBareModule ? { ...context, originModulePath: path.join(__dirname, "package.json") } : context,
    moduleName,
    platform,
  );
};
module.exports = config;
