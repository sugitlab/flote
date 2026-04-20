const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the entire monorepo
config.watchFolders = [monorepoRoot];

// Resolve modules from both project and monorepo root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// With hoisted node_modules, the project root for resolution should include monorepo root
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
