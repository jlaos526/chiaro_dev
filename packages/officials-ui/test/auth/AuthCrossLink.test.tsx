import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { AuthCrossLink } from '../../src/auth/AuthCrossLink.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

describe('AuthCrossLink', () => {
  it('renders sign-in mode copy', () => {
    const { container } = render(<AuthCrossLink mode="sign-in" onPress={() => {}} />)
    expect(container.textContent).toContain('New here?')
    expect(container.textContent).toContain('Create account')
  })

  it('renders sign-up mode copy', () => {
    const { container } = render(<AuthCrossLink mode="sign-up" onPress={() => {}} />)
    expect(container.textContent).toContain('Already have one?')
    expect(container.textContent).toContain('Sign in')
  })

  it('renders a real <a href> on web when href provided (smart-anchor)', () => {
    const { container } = render(
      <AuthCrossLink mode="sign-in" onPress={() => {}} href="/sign-up" />,
    )
    const a = container.querySelector('a[href="/sign-up"]')
    expect(a).not.toBeNull()
  })

  it('calls onPress on plain left-click (preventDefault intercept)', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AuthCrossLink mode="sign-in" onPress={onPress} href="/sign-up" />,
    )
    const a = container.querySelector('a')!
    fireEvent.click(a, { button: 0, metaKey: false, ctrlKey: false, shiftKey: false })
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('does NOT call onPress on Ctrl-click (lets browser open new tab)', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AuthCrossLink mode="sign-in" onPress={onPress} href="/sign-up" />,
    )
    const a = container.querySelector('a')!
    fireEvent.click(a, { button: 0, ctrlKey: true })
    expect(onPress).not.toHaveBeenCalled()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('AuthCrossLink — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<AuthCrossLink mode="sign-in" onPress={() => {}} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<AuthCrossLink mode="sign-in" onPress={() => {}} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
