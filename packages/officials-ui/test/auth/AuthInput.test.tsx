import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { AuthInput } from '../../src/auth/AuthInput.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

describe('AuthInput', () => {
  it('renders label + input element', () => {
    const { container } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} />,
    )
    const input = container.querySelector('input')
    expect(input).not.toBeNull()
    // <label htmlFor> is wired; visible text contains "Email".
    const label = container.querySelector('label')
    expect(label).not.toBeNull()
    expect(label!.textContent).toBe('Email')
  })

  it('renders type="email" when type=email', () => {
    const { container } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} type="email" />,
    )
    const input = container.querySelector('input')!
    expect(input.getAttribute('type')).toBe('email')
  })

  it('renders type="password" when type=password', () => {
    const { container } = render(
      <AuthInput label="Password" value="" onChangeText={() => {}} type="password" />,
    )
    const input = container.querySelector('input')!
    expect(input.getAttribute('type')).toBe('password')
  })

  it('forwards autoComplete prop to input', () => {
    const { container } = render(
      <AuthInput
        label="Password"
        value=""
        onChangeText={() => {}}
        type="password"
        autoComplete="current-password"
      />,
    )
    const input = container.querySelector('input')!
    expect(input.getAttribute('autocomplete')).toBe('current-password')
  })

  it('shows error state with aria-invalid + error message', () => {
    const { container } = render(
      <AuthInput
        label="Email"
        value=""
        onChangeText={() => {}}
        error="Invalid email"
      />,
    )
    const input = container.querySelector('input')!
    // Direct DOM-attribute assertion per Gotcha #22 (RNW does not
    // translate accessibilityState reliably; we pass aria-invalid directly).
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(container.textContent).toContain('Invalid email')
    // aria-describedby links the error region.
    const describedBy = input.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    const errorEl = container.querySelector(`#${describedBy}`)
    expect(errorEl).not.toBeNull()
    expect(errorEl!.textContent).toContain('Invalid email')
  })

  it('shows disabled state via disabled attribute', () => {
    const { container } = render(
      <AuthInput
        label="Email"
        value=""
        onChangeText={() => {}}
        disabled
      />,
    )
    const input = container.querySelector('input')!
    expect(input.hasAttribute('disabled')).toBe(true)
  })

  it('fires onChangeText on input change', () => {
    const onChangeText = vi.fn()
    const { container } = render(
      <AuthInput label="Email" value="" onChangeText={onChangeText} />,
    )
    const input = container.querySelector('input')!
    fireEvent.change(input, { target: { value: 'jane@example.com' } })
    expect(onChangeText).toHaveBeenCalledWith('jane@example.com')
  })

  it('empty state: input value is empty + placeholder=" " enables :placeholder-shown CSS', () => {
    const { container } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} />,
    )
    const input = container.querySelector('input')!
    expect(input.getAttribute('value')).toBe('')
    // Single-space placeholder enables the :not(:placeholder-shown) CSS
    // selector to flip the floating label back to its default position
    // even when no value has been entered.
    expect(input.getAttribute('placeholder')).toBe(' ')
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('AuthInput — mode awareness', () => {
  it('renders different border colors in light vs dark', () => {
    const { container: light } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} />,
      { wrapper: lightWrapper },
    )
    const { container: dark } = render(
      <AuthInput label="Email" value="" onChangeText={() => {}} />,
      { wrapper: darkWrapper },
    )
    // Web CSS template contains the hex values for the active mode.
    expect(light.innerHTML).toContain('#e8d8c2') // light border.default
    expect(dark.innerHTML).toContain('#3a2e26') // dark border.default
  })
})
