import { Platform } from 'react-native'

// Web parent <main>/<body>/<html> have no defined height by default, so the
// flex:1 on screen-shell outer Views collapses unless we fill the viewport.
// Mobile (RN) gets a flex-filled Screen wrapper from the navigator and
// ignores this. Same value previously duplicated across AuthScreen,
// SettingsScreen, CalibrateScreen — hoisted in slice 47.
//
// RN's DimensionValue type doesn't admit arbitrary CSS unit strings like
// '100vh' but RNW passes them through to CSS at runtime. Cast through
// `unknown` so strict typecheck doesn't reject the value the runtime wants.
export const WEB_VIEWPORT_FILL =
  Platform.OS === 'web' ? { minHeight: '100vh' as unknown as number } : null
