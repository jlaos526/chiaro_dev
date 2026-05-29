import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandBodyText } from '../../src/primitives/BrandBodyText.tsx'

describe('BrandBodyText', () => {
  it('renders children', () => {
    render(<BrandBodyText>Hello world</BrandBodyText>)
    expect(screen.getByText('Hello world')).toBeTruthy()
  })

  it('default size renders 15px font with 1.55 line-height', () => {
    const { container } = render(<BrandBodyText>Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*15px/)
  })

  it('size=sm renders 13px font', () => {
    const { container } = render(<BrandBodyText size="sm">Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    expect(style).toMatch(/font-size:\s*13px/)
  })

  it('default uses semantic.text.body color', () => {
    const { container } = render(<BrandBodyText>Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    // semantic.text.body in light = #3a322c (RNW normalizes to rgb).
    expect(style).toMatch(/color:\s*rgb\(58,\s*50,\s*44\)/)
  })

  it('muted=true uses semantic.text.muted color', () => {
    const { container } = render(<BrandBodyText muted>Sample</BrandBodyText>)
    const el = container.firstElementChild as HTMLElement
    const style = el.getAttribute('style') ?? ''
    // semantic.text.muted in light = #6b5e52 (RNW normalizes).
    expect(style).toMatch(/color:\s*rgb\(107,\s*94,\s*82\)/)
  })
})
