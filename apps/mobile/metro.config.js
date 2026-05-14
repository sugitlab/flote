// Must be set before getDefaultConfig so Expo uses the monorepo root as
// serverRoot for both rewriteRequestUrl and unstable_serverRoot.
process.env.EXPO_USE_METRO_WORKSPACE_ROOT = "1";

const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// pnpm nests different React versions inside package-specific node_modules
// (e.g. zustand uses React 18.3.1, root has 18.2.0).
// Force all react/react-native imports to resolve to the single root copy
// so Metro never sees two React instances, which breaks hooks.
const FORCED_MODULES = {
  react: path.resolve(monorepoRoot, "node_modules/react/index.js"),
  "react-native": path.resolve(monorepoRoot, "node_modules/react-native/index.js"),
  "react/jsx-runtime": path.resolve(monorepoRoot, "node_modules/react/jsx-runtime.js"),
  "react/jsx-dev-runtime": path.resolve(monorepoRoot, "node_modules/react/jsx-dev-runtime.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const forced = FORCED_MODULES[moduleName];
  if (forced) {
    return { type: "sourceFile", filePath: forced };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
