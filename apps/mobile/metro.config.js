const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

// ShopNest Mobile — Metro config tuned for a Yarn/NPM workspaces monorepo.
// We add ../../packages/shared to the watch list and nodeModulesPaths so that
// the shared TypeScript package (no build step) is compiled in-place by the
// Expo bundler. This is the documented Expo monorepo recipe.
const projectRoot = __dirname
const monorepoRoot = path.resolve(projectRoot, '../..')

const config = getDefaultConfig(projectRoot)

config.watchFolders = [monorepoRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = false

// The shared package ships raw TS — Metro needs to know it's safe to bundle.
config.resolver.sourceExts = config.resolver.sourceExts || []
if (!config.resolver.sourceExts.includes('ts')) config.resolver.sourceExts.push('ts')
if (!config.resolver.sourceExts.includes('tsx')) config.resolver.sourceExts.push('tsx')

module.exports = config
