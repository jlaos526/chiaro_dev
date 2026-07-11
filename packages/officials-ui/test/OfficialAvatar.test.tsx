import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { OfficialAvatar } from '../src/OfficialAvatar.tsx'
import { BrandModeOverrideContext } from '../src/brand-hooks.ts'

describe('OfficialAvatar', () => {
  it('renders portrait image when portraitUrl provided', () => {
    const { container } = render(
      <OfficialAvatar fullName="Jane Doe" portraitUrl="https://example.com/jane.jpg" size={64} />,
    )
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('https://example.com/jane.jpg')
  })

  it('renders initials fallback when portraitUrl is null', () => {
    const { getByText } = render(<OfficialAvatar fullName="Jane Doe" portraitUrl={null} />)
    expect(getByText('JD')).toBeTruthy()
  })

  it('exposes accessibility label with full name (image branch)', () => {
    const { container } = render(
      <OfficialAvatar fullName="Jane Doe" portraitUrl="https://example.com/jane.jpg" />,
    )
    expect(container.querySelector('[aria-label="Jane Doe"]')).not.toBeNull()
  })

  it('exposes accessibility label with full name (initials fallback)', () => {
    const { container } = render(<OfficialAvatar fullName="John Smith" portraitUrl={null} />)
    expect(container.querySelector('[aria-label="John Smith"]')).not.toBeNull()
  })
})

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('OfficialAvatar — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(<OfficialAvatar fullName="Jane Doe" portraitUrl={null} />, { wrapper: lightWrapper }),
    ).not.toThrow()
    expect(() =>
      render(<OfficialAvatar fullName="Jane Doe" portraitUrl={null} />, { wrapper: darkWrapper }),
    ).not.toThrow()
  })
})
