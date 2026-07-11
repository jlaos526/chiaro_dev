import { render, } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandHeading } from '../../src/primitives/BrandHeading.tsx'

describe('BrandHeading', () => {
  it('level=1 renders an <h1> element on web', () => {
    const { container } = render(<BrandHeading level={1}>Settings</BrandHeading>)
    const h = container.querySelector('h1')
    expect(h).not.toBeNull()
    expect(h?.textContent).toBe('Settings')
  })

  it('level=2 renders an <h2> element on web', () => {
    const { container } = render(<BrandHeading level={2}>Account</BrandHeading>)
    const h = container.querySelector('h2')
    expect(h).not.toBeNull()
  })

  it('level=3 renders an <h3> element on web', () => {
    const { container } = render(<BrandHeading level={3}>Appearance</BrandHeading>)
    const h = container.querySelector('h3')
    expect(h).not.toBeNull()
  })

  it('level=1 applies 28px font-size + 1.2 line-height', () => {
    const { container } = render(<BrandHeading level={1}>Settings</BrandHeading>)
    const h = container.querySelector('h1') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*28px/)
    expect(style).toMatch(/line-height:\s*1\.2/)
  })

  it('level=2 applies 22px font-size + 1.25 line-height', () => {
    const { container } = render(<BrandHeading level={2}>Account</BrandHeading>)
    const h = container.querySelector('h2') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*22px/)
    expect(style).toMatch(/line-height:\s*1\.25/)
  })

  it('level=3 applies 18px font-size + 1.3 line-height', () => {
    const { container } = render(<BrandHeading level={3}>Appearance</BrandHeading>)
    const h = container.querySelector('h3') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*18px/)
    expect(style).toMatch(/line-height:\s*1\.3/)
  })

  it('color prop overrides default semantic.text.primary', () => {
    const { container } = render(<BrandHeading level={1} color="#ff0000">Custom</BrandHeading>)
    const h = container.querySelector('h1') as HTMLElement
    const style = h.getAttribute('style') ?? ''
    // RNW normalizes #ff0000 to rgb(255, 0, 0).
    expect(style).toMatch(/color:\s*rgb\(255,\s*0,\s*0\)/)
  })
})
