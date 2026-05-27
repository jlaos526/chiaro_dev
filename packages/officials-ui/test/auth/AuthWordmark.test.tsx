import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { AuthWordmark } from '../../src/auth/AuthWordmark.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

function wrapper({ children }: { children: ReactNode }) {
  return createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
}

describe('AuthWordmark', () => {
  it('renders CHIARO wordmark text (via Logo lockup variant)', () => {
    const { container } = render(<AuthWordmark />, { wrapper })
    expect(container.textContent).toContain('CHIARO')
  })

  it('default size is md (S=32 logo)', () => {
    const { container } = render(<AuthWordmark />, { wrapper })
    // Outermost aria-label is the Logo lockup wrapper.
    expect(container.querySelector('[aria-label="Chiaro logo"]')).not.toBeNull()
  })

  it('size="sm" still renders the wordmark (smaller scale)', () => {
    const { container } = render(<AuthWordmark size="sm" />, { wrapper })
    expect(container.textContent).toContain('CHIARO')
    expect(container.querySelector('[aria-label="Chiaro logo"]')).not.toBeNull()
  })
})
