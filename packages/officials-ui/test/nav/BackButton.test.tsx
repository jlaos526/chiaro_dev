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
  it('renders ← character', () => {
    const { getByText } = render(<BackButton />, { wrapper: withMode('light') })
    expect(getByText('←')).toBeTruthy()
  })

  it('sets accessibilityLabel "Back"', () => {
    const { container } = render(<BackButton />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Back"]')).toBeTruthy()
  })

  it('calls router.back() on press', () => {
    backMock.mockClear()
    const { getByText } = render(<BackButton />, { wrapper: withMode('light') })
    fireEvent.click(getByText('←'))
    expect(backMock).toHaveBeenCalled()
  })
})
