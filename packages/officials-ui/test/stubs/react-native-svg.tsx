// Test-time stub for react-native-svg. The real package ships a native-only
// entry layout that Node's ESM loader rejects under jsdom. Tests don't need
// real SVG rendering — these RN-shaped no-op components keep the component
// API surface identical so visual smoke is preserved at the prop level.

import type { ReactNode } from 'react'
import { View } from 'react-native'

interface BaseProps {
  children?: ReactNode
  style?: unknown
  width?: number | string
  height?: number | string
  viewBox?: string
  fill?: string
  d?: string
}

function Svg({ children, ...rest }: BaseProps): React.JSX.Element {
  return <View {...(rest as object)}>{children}</View>
}

function Path(_props: BaseProps): React.JSX.Element {
  return <View />
}

export default Svg
export { Svg, Path }
