import { createElement, type ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
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
  it('applies light-mode orange gradient on web when portrait missing', () => {
    const { container } = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: lightWrapper },
    )
    const outer = container.firstElementChild as HTMLElement | null
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(135deg, #c46a2a 0%, #e8a060 100%\)/)
  })

  it('applies dark-mode sage gradient on web when portrait missing', () => {
    const { container } = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: darkWrapper },
    )
    const outer = container.firstElementChild as HTMLElement | null
    const bg = outer?.getAttribute('style') ?? ''
    expect(bg).toMatch(/linear-gradient\(135deg, #6b7a5d 0%, #9caa8e 100%\)/)
  })

  it('initials text uses semantic.portrait.initials (light = white, dark = cream)', () => {
    const light = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: lightWrapper },
    )
    // Scope query to this render's container (multiple renders share document.body).
    const lightStyle = (within(light.container).getByText('NP') as HTMLElement).getAttribute('style') ?? ''
    expect(lightStyle).toMatch(/color:\s*(?:#ffffff|rgb\(255,\s*255,\s*255\))/i)

    const dark = render(
      <BioPortrait fullName="Nancy Pelosi" portraitUrl={null} size={72} />,
      { wrapper: darkWrapper },
    )
    const darkStyle = (within(dark.container).getByText('NP') as HTMLElement).getAttribute('style') ?? ''
    expect(darkStyle).toMatch(/color:\s*(?:#fff0dc|rgb\(255,\s*240,\s*220\))/i)
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
