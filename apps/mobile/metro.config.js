const { getSentryExpoConfig } = require('@sentry/react-native/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')

// Wrap Expo's default Metro config with Sentry source-map / debug-id support.
const config = getSentryExpoConfig(projectRoot)

// Preserve monorepo path resolution (pnpm workspaces).
config.watchFolders = [workspaceRoot]
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
]
config.resolver.disableHierarchicalLookup = true

module.exports = config
