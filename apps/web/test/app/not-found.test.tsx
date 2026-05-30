import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import NotFound from '../../app/not-found'

describe('NotFound page', () => {
  it('renders the title as h1 "Page not found"', () => {
    const { container } = render(<NotFound />)
    const h1 = container.querySelector('h1')
    expect(h1?.textContent).toBe('Page not found')
  })

  it('renders inside BrandPageScreen (centered column on brand bg)', () => {
    const { container } = render(<NotFound />)
    // BrandPageScreen outer View has inline backgroundColor (semantic.bg.app).
    const outer = container.firstChild as HTMLElement
    expect(outer?.getAttribute('style')).toMatch(/background-color:/i)
  })

  it('renders Go home link with href="/"', () => {
    const { container } = render(<NotFound />)
    const link = container.querySelector('a[href="/"]')
    expect(link?.textContent).toContain('Go home')
  })
})
