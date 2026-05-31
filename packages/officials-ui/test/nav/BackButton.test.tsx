import { describe, expect, it, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const backMock = vi.fn()
vi.mock('expo-router', () => ({
  useRouter: () => ({ back: backMock }),
}))

import { BackButton } from '../../src/nav/BackButton.tsx'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('BackButton', () => {
  it('renders an SVG chevron (slice 51)', () => {
    const { container } = render(<BackButton />, { wrapper: withMode('light') })
    // The slice 46 react-native-svg test stub renders real DOM <svg>/<polyline>.
    const svg = container.querySelector('svg')
    expect(svg).toBeTruthy()
    const polyline = container.querySelector('svg polyline')
    expect(polyline?.getAttribute('points')).toBe('15 6 9 12 15 18')
  })

  it('sets accessibilityLabel "Back"', () => {
    const { container } = render(<BackButton />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Back"]')).toBeTruthy()
  })

  it('calls router.back() on press', () => {
    backMock.mockClear()
    const { container } = render(<BackButton />, { wrapper: withMode('light') })
    const pressable = container.querySelector('[aria-label="Back"]') as HTMLElement
    fireEvent.click(pressable)
    expect(backMock).toHaveBeenCalled()
  })
})
