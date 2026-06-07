// Test-time stub for react-native-svg. The real package ships a native-only
// entry layout that Node's ESM loader rejects under jsdom. Tests don't need
// real RN-svg rendering — but we DO render real DOM <svg>/<path> elements so
// that test assertions can query SVG attributes (e.g. the fill literal on a
// pin path) via standard DOM APIs.

import { createElement, type ReactNode } from 'react'

interface BaseProps {
  children?: ReactNode
  style?: unknown
  width?: number | string
  height?: number | string
  viewBox?: string
  fill?: string
  d?: string
  points?: string
  stroke?: string
  strokeWidth?: number | string
  strokeLinecap?: string
  strokeLinejoin?: string
  strokeDasharray?: string
  x1?: number | string
  y1?: number | string
  x2?: number | string
  y2?: number | string
  x?: number | string
  y?: number | string
  fontSize?: number | string
  textAnchor?: string
}

function Svg({ children, width, height, viewBox, fill }: BaseProps): React.JSX.Element {
  return createElement(
    'svg',
    {
      width,
      height,
      viewBox,
      fill,
      xmlns: 'http://www.w3.org/2000/svg',
    },
    children,
  )
}

function Path({ d, fill }: BaseProps): React.JSX.Element {
  return createElement('path', { d, fill })
}

function Polyline({ points, stroke, strokeWidth, strokeLinecap, strokeLinejoin, fill }: BaseProps): React.JSX.Element {
  return createElement('polyline', {
    points,
    stroke,
    strokeWidth,
    strokeLinecap,
    strokeLinejoin,
    fill: fill ?? 'none',
  })
}

function Polygon({ points, fill, stroke, strokeWidth, strokeDasharray }: BaseProps): React.JSX.Element {
  return createElement('polygon', { points, fill, stroke, strokeWidth, strokeDasharray })
}

function Line({ x1, y1, x2, y2, stroke, strokeWidth }: BaseProps): React.JSX.Element {
  return createElement('line', { x1, y1, x2, y2, stroke, strokeWidth })
}

function Text({ x, y, fill, fontSize, textAnchor, children }: BaseProps): React.JSX.Element {
  return createElement('text', { x, y, fill, fontSize, textAnchor }, children)
}

export default Svg
export { Svg, Path, Polyline, Polygon, Line, Text }
