import { createElement, type ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BioPortrait } from '../../src/bio/BioPortrait.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BioPortrait', () => {
  it('renders <img> via RN-web when portraitUrl present', () => {
    const { container } = render(<BioPortrait fullName="Nancy Pelosi" portraitUrl="https://example.org/np.jpg" size={72} />)
    const img = container.querySelector('img') as HTMLImageElement | null
    expect(img).toBeTruthy()
    expect(img?.src).toBe('https://example.org/np.jpg')
  })
  it('falls back to initials when portraitUrl missing', () => {
    render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    expect(screen.getByText('NP')).toBeTruthy()
  })
  it('initials are first letter of first + last word', () => {
    render(<BioPortrait fullName="Adam B. Schiff" portraitUrl={null} size={72} />)
    expect(screen.getByText('AS')).toBeTruthy()
  })
  it('single-word name → single letter', () => {
    render(<BioPortrait fullName="Cher" portraitUrl={null} size={72} />)
    expect(screen.getByText('C')).toBeTruthy()
  })
  it('applies diagonal blue gradient on web when portrait missing', () => {
    const { container } = render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />)
    // Outer wrapper is the raw <div> that carries the CSS gradient.
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(135deg, #3b6ed1 0%, #5b8de1 100%\)/)
  })
})

describe('BioPortrait — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />, {
        wrapper: lightWrapper,
      }),
    ).not.toThrow()
    expect(() =>
      render(<BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />, {
        wrapper: darkWrapper,
      }),
    ).not.toThrow()
  })
})
