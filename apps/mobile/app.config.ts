import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Chiaro',
  slug: 'chiaro',
  scheme: 'chiaro',
  version: '0.0.0',
  orientation: 'portrait',
  newArchEnabled: true,
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.chiaro.app',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Chiaro uses your location to find the elected officials representing your address.',
    },
  },
  android: {
    package: 'com.chiaro.app',
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  plugins: [
    'expo-router',
    [
      'expo-location',
      {
        locationAlwaysAndWhenInUsePermission:
          'Allow Chiaro to use your location to find your elected officials.',
      },
    ],
  ],
  experiments: { typedRoutes: true },
}

export default config
