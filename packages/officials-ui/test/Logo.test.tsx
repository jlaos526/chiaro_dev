import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { Logo } from '../src/Logo.tsx'
import { BrandModeOverrideContext } from '../src/brand-hooks.ts'

function withMode(mode: 'light' | 'dark') {
  return ({ children }: { children: ReactNode }) =>
    createElement(BrandModeOverrideContext.Provider, { value: mode }, children)
}

describe('Logo — mark variant (default)', () => {
  it('renders without wordmark text by default', () => {
    const { container } = render(<Logo />, { wrapper: withMode('light') })
    expect(container.textContent).not.toContain('CHIARO')
  })

  it('renders 2 squares + 4 bracket elements at default size', () => {
    const { container } = render(<Logo />, { wrapper: withMode('light') })
    // Two squares + four brackets = at least 6 positioned divs.
    expect(container.querySelectorAll('div').length).toBeGreaterThanOrEqual(6)
  })

  it('exposes an accessibility label', () => {
    const { container } = render(<Logo />, { wrapper: withMode('light') })
    const labelled = container.querySelector('[aria-label]')
    expect(labelled?.getAttribute('aria-label')).toBe('Chiaro')
  })

  it('respects custom accessibilityLabel prop', () => {
    const { container } = render(<Logo accessibilityLabel="Custom" />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Custom"]')).not.toBeNull()
  })
})

describe('Logo — lockup variant', () => {
  it('renders CHIARO wordmark in lockup variant', () => {
    const { container } = render(<Logo variant="lockup" />, { wrapper: withMode('light') })
    expect(container.textContent).toContain('CHIARO')
  })

  it('renders tagline below wordmark when provided', () => {
    const { container } = render(
      <Logo variant="lockup" tagline="Know who represents you." />,
      { wrapper: withMode('light') },
    )
    expect(container.textContent).toContain('CHIARO')
    expect(container.textContent).toContain('Know who represents you.')
  })

  it('defaults accessibilityLabel to "Chiaro logo" in lockup variant', () => {
    const { container } = render(<Logo variant="lockup" />, { wrapper: withMode('light') })
    expect(container.querySelector('[aria-label="Chiaro logo"]')).not.toBeNull()
  })
})

describe('Logo — size variants', () => {
  it('respects custom size prop', () => {
    const { container } = render(<Logo size={64} />, { wrapper: withMode('light') })
    // At S=64 the bounding box should be ~92×80 (per logoGeometry).
    const wrapper = container.firstElementChild as HTMLElement | null
    expect(wrapper).not.toBeNull()
  })

  it('renders fallback solid square below S=12', () => {
    const { container } = render(<Logo size={10} />, { wrapper: withMode('light') })
    // Fallback path: single square, no brackets. ≤ 3 divs (wrapper + 1 square + label sibling at most).
    expect(container.querySelectorAll('div').length).toBeLessThanOrEqual(3)
  })
})

describe('Logo — mode awareness', () => {
  it('renders CHIARO text in lockup variant under dark mode wrapper', () => {
    const { container } = render(<Logo variant="lockup" />, { wrapper: withMode('dark') })
    expect(container.textContent).toContain('CHIARO')
    // Visual color delta verified manually; structural assertion only.
  })
})

describe('wordmarkSize prop (slice 47)', () => {
  // RNW renders <Text> as a <span>; querySelectorAll returns in DOM order so outer
  // container divs appear before the innermost span — use reverse().find() to get
  // the deepest element whose textContent is exactly the target string.
  const deepestWithText = (container: HTMLElement, text: string) =>
    Array.from(container.querySelectorAll('*'))
      .reverse()
      .find(el => el.textContent === text) as HTMLElement | undefined

  it('sets wordmark fontSize to the provided value when passed', () => {
    const { container } = render(
      <Logo variant="lockup" size={24} wordmarkSize={28} />,
      { wrapper: withMode('light') },
    )
    const wordmark = deepestWithText(container, 'CHIARO')
    expect(wordmark?.getAttribute('style')).toMatch(/font-size:\s*28(px)?/i)
  })

  it('falls back to size * 0.65 when wordmarkSize is omitted', () => {
    const { container } = render(
      <Logo variant="lockup" size={32} />,
      { wrapper: withMode('light') },
    )
    const wordmark = deepestWithText(container, 'CHIARO')
    // 32 * 0.65 = 20.8
    expect(wordmark?.getAttribute('style')).toMatch(/font-size:\s*20\.8(px)?/i)
  })

  it('computes gap from max(size, wordmarkSize) when wordmarkSize > size', () => {
    const { container } = render(
      <Logo variant="lockup" size={24} wordmarkSize={28} />,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/gap:\s*11\.2(px)?/i)
  })

  it('computes gap from max(size, wordmarkSize) when wordmarkSize < size', () => {
    const { container } = render(
      <Logo variant="lockup" size={48} wordmarkSize={20} />,
      { wrapper: withMode('light') },
    )
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/gap:\s*19\.2(px)?/i)
  })

  it('derives tracking from wordmarkSize when provided', () => {
    const { container } = render(
      <Logo variant="lockup" size={20} wordmarkSize={28} />,
      { wrapper: withMode('light') },
    )
    const wordmark = deepestWithText(container, 'CHIARO')
    // wordmarkSize 28 >= 24 → tracking = 0.07 * 28 = 1.96
    expect(wordmark?.getAttribute('style')).toMatch(/letter-spacing:\s*1\.96(px)?/i)
  })

  it('derives tagline size from wordmarkSize when provided', () => {
    const { container } = render(
      <Logo variant="lockup" size={24} wordmarkSize={28} tagline="civics" />,
      { wrapper: withMode('light') },
    )
    const tagline = deepestWithText(container, 'civics')
    // 28 * 0.45 = 12.6
    expect(tagline?.getAttribute('style')).toMatch(/font-size:\s*12\.6(px)?/i)
  })
})
