import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { AuthForm } from '../../src/auth/AuthForm.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe('AuthForm', () => {
  it('sign-in mode renders headline + 2 inputs + CTA (no confirm field)', () => {
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={async () => {}} onCrossLinkPress={() => {}} />,
    )
    expect(container.textContent).toContain('Sign in')
    expect(container.querySelectorAll('input').length).toBe(2)
  })

  it('sign-up mode renders headline + 3 inputs + CTA (with confirm field)', () => {
    const { container } = render(
      <AuthForm mode="sign-up" onSubmit={async () => {}} onCrossLinkPress={() => {}} />,
    )
    expect(container.textContent).toContain('Create account')
    expect(container.querySelectorAll('input').length).toBe(3)
  })

  it('sign-up: password mismatch blocks submit + shows banner error', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <AuthForm mode="sign-up" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    const email = inputs[0]!
    const password = inputs[1]!
    const confirm = inputs[2]!
    fireEvent.change(email, { target: { value: 'a@b.com' } })
    fireEvent.change(password, { target: { value: 'password123' } })
    fireEvent.change(confirm, { target: { value: 'different456' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Passwords do not match')
  })

  it('sign-up: password < 8 chars blocks submit + shows banner error', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <AuthForm mode="sign-up" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    const email = inputs[0]!
    const password = inputs[1]!
    const confirm = inputs[2]!
    fireEvent.change(email, { target: { value: 'a@b.com' } })
    fireEvent.change(password, { target: { value: 'short' } })
    fireEvent.change(confirm, { target: { value: 'short' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    expect(onSubmit).not.toHaveBeenCalled()
    expect(container.textContent).toContain('Password must be at least 8 characters')
  })

  it('submit success path: onSubmit awaited with email + password; no banner', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    expect(onSubmit).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' })
    // No error banner rendered (role="alert" absent).
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('submit failure path: thrown error message renders in banner above CTA', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Invalid login credentials')
    })
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'wrongpass' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    expect(onSubmit).toHaveBeenCalledOnce()
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toContain('Invalid login credentials')
  })

  it('notice channel: onSubmit resolving { notice } renders in the status banner, NOT the danger alert', async () => {
    const onSubmit = vi.fn(async () => ({ notice: 'Check your email to confirm your account.' }))
    const { container } = render(
      <AuthForm mode="sign-up" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    fireEvent.change(inputs[2]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    expect(onSubmit).toHaveBeenCalledOnce()
    // Notice renders in the status banner (role="status"), not the danger alert.
    const status = container.querySelector('[role="status"]')
    expect(status).not.toBeNull()
    expect(status!.textContent).toContain('Check your email to confirm your account.')
    // The danger error banner (role="alert") must NOT be present.
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('resend action: renders inside the notice banner, calls onResend with the email (slice 79.5)', async () => {
    const onSubmit = vi.fn(async () => ({ notice: 'Check your email to confirm your account.' }))
    const onResend = vi.fn(async () => {})
    const { container, getByTestId } = render(
      <AuthForm
        mode="sign-up"
        onSubmit={onSubmit}
        onResend={onResend}
        onCrossLinkPress={() => {}}
      />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    fireEvent.change(inputs[2]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(getByTestId('auth-submit'))
      await flush()
    })
    const resend = getByTestId('auth-resend')
    expect(resend.textContent).toContain('Resend email')
    await act(async () => {
      fireEvent.click(resend)
      await flush()
    })
    expect(onResend).toHaveBeenCalledWith('a@b.com')
    expect(getByTestId('auth-resend').textContent).toContain('Email re-sent')
  })

  it('resend action: onResend throw surfaces in the danger banner and re-arms the button', async () => {
    const onSubmit = vi.fn(async () => ({ notice: 'Check your email.' }))
    const onResend = vi.fn(async () => {
      throw new Error('Rate limited')
    })
    const { container, getByTestId } = render(
      <AuthForm
        mode="sign-up"
        onSubmit={onSubmit}
        onResend={onResend}
        onCrossLinkPress={() => {}}
      />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    fireEvent.change(inputs[2]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(getByTestId('auth-submit'))
      await flush()
    })
    await act(async () => {
      fireEvent.click(getByTestId('auth-resend'))
      await flush()
    })
    expect(container.querySelector('[role="alert"]')!.textContent).toContain('Rate limited')
    expect(getByTestId('auth-resend').textContent).toContain('Resend email')
  })

  it('resend action: absent without the onResend prop', async () => {
    const onSubmit = vi.fn(async () => ({ notice: 'Check your email.' }))
    const { container, queryByTestId, getByTestId } = render(
      <AuthForm mode="sign-up" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    fireEvent.change(inputs[2]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(getByTestId('auth-submit'))
      await flush()
    })
    expect(queryByTestId('auth-resend')).toBeNull()
  })

  it('notice channel: void resolution renders no status banner', async () => {
    const onSubmit = vi.fn(async () => {})
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('thrown error still renders in the danger banner, not the status banner', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Email already registered')
    })
    const { container } = render(
      <AuthForm mode="sign-up" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    fireEvent.change(inputs[2]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert!.textContent).toContain('Email already registered')
    expect(container.querySelector('[role="status"]')).toBeNull()
  })

  it('disabled-during-submit: inputs + CTA disabled while onSubmit pending', async () => {
    let resolveSubmit!: () => void
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve
    })
    const onSubmit = vi.fn(() => submitPromise)
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    // Inputs disabled mid-submit (AuthInput renders <input disabled>).
    const inputsMid = container.querySelectorAll('input')
    for (const inp of inputsMid) {
      expect(inp.hasAttribute('disabled')).toBe(true)
    }
    // Resolve to clean up the pending promise.
    await act(async () => {
      resolveSubmit()
      await flush()
    })
  })

  it('CTA text swaps to loading copy during submit', async () => {
    let resolveSubmit!: () => void
    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve
    })
    const onSubmit = vi.fn(() => submitPromise)
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    // Pre-submit copy.
    expect(container.textContent).toContain('Sign in')
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    // Mid-submit copy.
    expect(container.textContent).toContain('Signing in…')
    await act(async () => {
      resolveSubmit()
      await flush()
    })
  })

  it('cross-link callback fires when pressed', () => {
    const onCrossLinkPress = vi.fn()
    const { container } = render(
      <AuthForm
        mode="sign-in"
        onSubmit={async () => {}}
        onCrossLinkPress={onCrossLinkPress}
        crossLinkHref="/sign-up"
      />,
    )
    const a = container.querySelector('a[href="/sign-up"]')!
    fireEvent.click(a, { button: 0 })
    expect(onCrossLinkPress).toHaveBeenCalledOnce()
  })

  it('initialEmail prefills the email field', () => {
    const { container } = render(
      <AuthForm
        mode="sign-in"
        onSubmit={async () => {}}
        onCrossLinkPress={() => {}}
        initialEmail="prefilled@example.com"
      />,
    )
    const email = container.querySelectorAll('input')[0]!
    expect(email.getAttribute('value')).toBe('prefilled@example.com')
  })

  it('headline carries accessibilityRole="header" + accessibilityLevel={1} (role=heading, aria-level=1)', () => {
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={async () => {}} onCrossLinkPress={() => {}} />,
    )
    const heading = container.querySelector('[role="heading"]')
    expect(heading).not.toBeNull()
    expect(heading?.getAttribute('aria-level')).toBe('1')
    expect(heading?.textContent).toContain('Sign in')
  })

  it('error banner carries accessibilityRole="alert" (role=alert)', async () => {
    const onSubmit = vi.fn(async () => {
      throw new Error('Something broke')
    })
    const { container } = render(
      <AuthForm mode="sign-in" onSubmit={onSubmit} onCrossLinkPress={() => {}} />,
    )
    const inputs = container.querySelectorAll('input')
    fireEvent.change(inputs[0]!, { target: { value: 'a@b.com' } })
    fireEvent.change(inputs[1]!, { target: { value: 'password123' } })
    await act(async () => {
      fireEvent.click(screen.getByRole('button'))
      await flush()
    })
    const alert = container.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('AuthForm — mode awareness', () => {
  const minimalProps = {
    mode: 'sign-in' as const,
    onSubmit: async () => {},
    onCrossLinkPress: () => {},
  }

  it('renders under both light and dark wrappers without throwing', () => {
    expect(() => render(<AuthForm {...minimalProps} />, { wrapper: lightWrapper })).not.toThrow()
    expect(() => render(<AuthForm {...minimalProps} />, { wrapper: darkWrapper })).not.toThrow()
  })
})
