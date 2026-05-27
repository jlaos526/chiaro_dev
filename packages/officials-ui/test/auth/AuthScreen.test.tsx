import { createElement, type ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AuthScreen } from '../../src/auth/AuthScreen.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

describe('AuthScreen', () => {
  const baseProps = {
    mode: 'sign-in' as const,
    onSubmit: async () => {},
    onCrossLinkPress: () => {},
  }

  it('renders AuthForm with passed props', () => {
    const { container } = render(<AuthScreen {...baseProps} />)
    expect(container.textContent).toContain('Sign in')
  })

  it('shows AuthWordmark when showBranding=true (default)', () => {
    const { container } = render(<AuthScreen {...baseProps} />)
    expect(container.textContent).toContain('CHIARO')
  })

  it('hides AuthWordmark when showBranding=false', () => {
    const { container } = render(<AuthScreen {...baseProps} showBranding={false} />)
    expect(container.textContent).not.toContain('CHIARO')
  })

  it('renders the sign-up cross-link in sign-in mode', () => {
    const { container } = render(<AuthScreen {...baseProps} />)
    expect(container.textContent).toContain('Create account')
  })

  it('passes mode to AuthForm correctly', () => {
    const { container } = render(<AuthScreen {...baseProps} mode="sign-up" />)
    expect(container.textContent).toContain('Create account')
    expect(container.querySelectorAll('input').length).toBe(3) // sign-up has 3 inputs
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('AuthScreen — mode awareness', () => {
  const baseProps = {
    mode: 'sign-in' as const,
    onSubmit: async () => {},
    onCrossLinkPress: () => {},
  }

  it('renders under both light and dark wrappers without throwing', () => {
    expect(() => render(<AuthScreen {...baseProps} />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<AuthScreen {...baseProps} />, { wrapper: darkWrapper })).not.toThrow()
  })
})
