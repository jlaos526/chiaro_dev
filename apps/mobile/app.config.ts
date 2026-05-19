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
    [
      '@sentry/react-native/expo',
      { organization: 'chiaro', project: 'chiaro-mobile' },
    ],
  ],
  experiments: { typedRoutes: true },
  updates: {
    url: 'https://u.expo.dev/f4d18da9-9c95-4c6a-8a34-c77189eca749',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  extra: {
    eas: {
      projectId: 'f4d18da9-9c95-4c6a-8a34-c77189eca749',
    },
    sentryDsn: process.env.EXPO_PUBLIC_SENTRY_DSN_MOBILE,
  },
}

export default config
