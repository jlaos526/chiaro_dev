import '@testing-library/jest-native/extend-expect'
import { cleanup } from '@testing-library/react-native'

afterEach(() => {
  cleanup()
})

// Slice 48: Reanimated 4 + Gesture Handler jest mocks (required for any test that
// transitively imports either library, including BrandDrawer / BrandDrawerContent).
import 'react-native-gesture-handler/jestSetup'
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'))
