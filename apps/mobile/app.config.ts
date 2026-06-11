import type { ExpoConfig } from 'expo/config'

const config: ExpoConfig = {
  name: 'Chiaro',
  slug: 'chiaro',
  scheme: 'chiaro',
  version: '0.0.0',
  orientation: 'portrait',
  newArchEnabled: true,
  // Splash is a flat brand-cream screen for now (BRAND surface.base light);
  // real splash/icon artwork is design-track work (audit C14) — evaluation
  // builds show the default Expo icon, which is cosmetic and accepted.
  splash: {
    backgroundColor: '#efece5',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.chiaro.app',
    infoPlist: {
      // GPS calibrate is foreground-only; no background location, no
      // encryption beyond HTTPS (audit C53 — keeps App Store submission
      // from prompting for export-compliance answers every build).
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: 'com.chiaro.app',
    permissions: ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION'],
  },
  plugins: [
    'expo-router',
    [
      // WhenInUse ONLY (audit C53): the GPS path (calibrate "Use my current
      // location") is foreground-only. The previous config requested
      // Always-and-WhenInUse and ALSO duplicated the WhenInUse string in
      // ios.infoPlist — the plugin is now the single source of truth.
      'expo-location',
      {
        locationWhenInUsePermission:
          'Chiaro uses your location to find the elected officials representing your address.',
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
