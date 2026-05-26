import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { AuthScreen } from '../../src/auth/AuthScreen.tsx'

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
