import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Chiaro',
  slug: 'chiaro',
  scheme: 'chiaro',
  version: '0.0.0',
  orientation: 'portrait',
  newArchEnabled: true,
  ios: { supportsTablet: false, bundleIdentifier: 'com.chiaro.app' },
  android: { package: 'com.chiaro.app' },
  plugins: ['expo-router'],
  experiments: { typedRoutes: true },
}

export default config
