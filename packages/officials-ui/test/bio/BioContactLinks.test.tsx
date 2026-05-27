import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { BioContactLinks } from '../../src/bio/BioContactLinks.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BioContactLinks', () => {
  it('returns null when both links absent', () => {
    const { container } = render(<BioContactLinks officialUrl={null} twitterHandle={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the official URL stripped of protocol + trailing slash', () => {
    render(<BioContactLinks officialUrl="https://pelosi.house.gov/" twitterHandle={null} />)
    expect(screen.getByText('pelosi.house.gov')).toBeTruthy()
  })

  it('renders the twitter handle with @ prefix', () => {
    render(<BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />)
    expect(screen.getByText('@SpeakerPelosi')).toBeTruthy()
  })

  it('clicking the official URL invokes Linking.openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle={null} />)
    fireEvent.click(screen.getByText('pelosi.house.gov'))
    expect(spy).toHaveBeenCalledWith('https://pelosi.house.gov')
  })

  it('clicking the twitter handle opens twitter.com/<handle>', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />)
    fireEvent.click(screen.getByText('@SpeakerPelosi'))
    expect(spy).toHaveBeenCalledWith('https://twitter.com/SpeakerPelosi')
  })
})

describe('BioContactLinks — smart-anchor (officialUrl)', () => {
  it('renders the official URL as a real <a href> on web', () => {
    const { container } = render(
      <BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle={null} />,
    )
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('https://pelosi.house.gov')
  })

  it('plain left-click on official-URL anchor calls preventDefault + invokes openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(
      <BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle={null} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(spy).toHaveBeenCalledWith('https://pelosi.house.gov')
  })

  it('cmd-click on official-URL anchor falls through to browser default', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(
      <BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle={null} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('BioContactLinks — smart-anchor (twitterHandle)', () => {
  it('renders the twitter handle as a real <a href> on web', () => {
    const { container } = render(
      <BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />,
    )
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('https://twitter.com/SpeakerPelosi')
  })

  it('plain left-click on twitter anchor calls preventDefault + invokes openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(
      <BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(spy).toHaveBeenCalledWith('https://twitter.com/SpeakerPelosi')
  })

  it('ctrl-click on twitter anchor falls through to browser default', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(
      <BioContactLinks officialUrl={null} twitterHandle="SpeakerPelosi" />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(spy).not.toHaveBeenCalled()
  })

  it('respects officialHref override when provided', () => {
    const { container } = render(
      <BioContactLinks
        officialUrl="https://pelosi.house.gov"
        twitterHandle={null}
        officialHref="https://example.com/custom"
      />,
    )
    const anchor = container.querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('https://example.com/custom')
  })
})

describe('BioContactLinks — mode awareness', () => {
  it('renders under both light and dark wrappers without throwing', () => {
    expect(() =>
      render(
        <BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle="SpeakerPelosi" />,
        { wrapper: lightWrapper },
      ),
    ).not.toThrow()
    expect(() =>
      render(
        <BioContactLinks officialUrl="https://pelosi.house.gov" twitterHandle="SpeakerPelosi" />,
        { wrapper: darkWrapper },
      ),
    ).not.toThrow()
  })
})
