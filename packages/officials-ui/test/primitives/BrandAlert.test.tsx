import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BrandAlert } from '../../src/primitives/BrandAlert.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BrandAlert', () => {
  it('renders title + body', () => {
    render(<BrandAlert severity="danger" title="Couldn't save">Address not found.</BrandAlert>)
    expect(screen.getByText("Couldn't save")).toBeTruthy()
    expect(screen.getByText('Address not found.')).toBeTruthy()
  })

  it('exposes role=alert on the outer container', () => {
    const { container } = render(<BrandAlert severity="danger" title="Oops">body</BrandAlert>)
    const outer = container.querySelector('[role="alert"]')
    expect(outer).not.toBeNull()
  })

  it('danger band uses burgundy #8a3a4d', () => {
    const { container } = render(<BrandAlert severity="danger" title="Oops">body</BrandAlert>, { wrapper: lightWrapper })
    // Pill is the only element styled with rgb(138, 58, 77) bg.
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(138,\s*58,\s*77\)/))
    expect(hasBand).toBe(true)
  })

  it('warning band uses gold #c89a4e', () => {
    const { container } = render(<BrandAlert severity="warning" title="Heads up">body</BrandAlert>, { wrapper: lightWrapper })
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    // RNW normalizes #c89a4e to rgb(200, 154, 78).
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(200,\s*154,\s*78\)/))
    expect(hasBand).toBe(true)
  })

  it('success band uses emerald #1a8f5a', () => {
    const { container } = render(<BrandAlert severity="success" title="Saved">body</BrandAlert>, { wrapper: lightWrapper })
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    // RNW normalizes #1a8f5a to rgb(26, 143, 90).
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(26,\s*143,\s*90\)/))
    expect(hasBand).toBe(true)
  })

  it('info band uses terracotta #b86340', () => {
    const { container } = render(<BrandAlert severity="info" title="FYI">body</BrandAlert>, { wrapper: lightWrapper })
    const allStyled = Array.from(container.querySelectorAll('[style*="background-color"]')) as HTMLElement[]
    // RNW normalizes #b86340 to rgb(184, 99, 64).
    const hasBand = allStyled.some(el => (el.getAttribute('style') ?? '').match(/background-color:\s*rgb\(184,\s*99,\s*64\)/))
    expect(hasBand).toBe(true)
  })

  it('icon glyph differs per severity', () => {
    const dangerR = render(<BrandAlert severity="danger" title="x">y</BrandAlert>)
    expect(dangerR.container.textContent).toContain('!')
    dangerR.unmount()
    const successR = render(<BrandAlert severity="success" title="x">y</BrandAlert>)
    expect(successR.container.textContent).toContain('✓')
    successR.unmount()
    const infoR = render(<BrandAlert severity="info" title="x">y</BrandAlert>)
    expect(infoR.container.textContent).toContain('i')
  })

  it('dark mode card bg is slice 43 universal #2a2e34', () => {
    const { container } = render(<BrandAlert severity="danger" title="Oops">body</BrandAlert>, { wrapper: darkWrapper })
    const outer = container.querySelector('[role="alert"]') as HTMLElement
    const style = outer.getAttribute('style') ?? ''
    // RNW normalizes #2a2e34 to rgb(42, 46, 52).
    expect(style).toMatch(/background-color:\s*rgb\(42,\s*46,\s*52\)/)
  })

  it('title omitted: renders only body content', () => {
    render(<BrandAlert severity="info">Just informational.</BrandAlert>)
    expect(screen.getByText('Just informational.')).toBeTruthy()
  })

  describe('glyph color (slice 47 cleanup item 2)', () => {
    it('uses semantic.text.onAccent in light mode', () => {
      const { container } = render(
        <BrandAlert severity="info">Body</BrandAlert>,
        { wrapper: lightWrapper },
      )
      // Glyph is the 'i' Text node inside the 18px circle. Use deepest match
      // to grab the RNW Text span (not its container divs).
      const glyph = Array.from(container.querySelectorAll('*'))
        .reverse()
        .find(el => el.textContent === 'i') as HTMLElement | undefined
      // Light onAccent is '#ffffff' which RNW normalizes to 'rgb(255, 255, 255)'
      expect(glyph?.getAttribute('style')).toMatch(/color:\s*(rgb\(255,\s*255,\s*255\)|#fff)/i)
    })

    it('uses semantic.text.onAccent in dark mode', () => {
      const { container } = render(
        <BrandAlert severity="info">Body</BrandAlert>,
        { wrapper: darkWrapper },
      )
      const glyph = Array.from(container.querySelectorAll('*'))
        .reverse()
        .find(el => el.textContent === 'i') as HTMLElement | undefined
      // Dark onAccent is p.ink[1000] = '#fdf8f3' which RNW normalizes to 'rgb(253, 248, 243)'
      expect(glyph?.getAttribute('style')).toMatch(/color:\s*(rgb\(253,\s*248,\s*243\)|#fdf8f3)/i)
    })
  })
})
