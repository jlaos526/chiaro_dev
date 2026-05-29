import { createElement, type ReactNode } from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { BrandLink } from '../../src/primitives/BrandLink.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BrandLink', () => {
  it('renders as a real <a href> on web', () => {
    const { container } = render(<BrandLink href="https://example.com">Visit</BrandLink>)
    const a = container.querySelector('a[href="https://example.com"]')
    expect(a).not.toBeNull()
    expect(a?.textContent).toBe('Visit')
  })

  it('uses semantic.link.fg color in light mode', () => {
    const { container } = render(<BrandLink href="/x">Tag</BrandLink>, { wrapper: lightWrapper })
    const a = container.querySelector('a') as HTMLAnchorElement
    const style = a.getAttribute('style') ?? ''
    // semantic.link.fg light = #3b6ed1 → rgb(59, 110, 209).
    expect(style).toMatch(/color:\s*rgb\(59,\s*110,\s*209\)/)
  })

  it('uses semantic.link.fg color in dark mode', () => {
    const { container } = render(<BrandLink href="/x">Tag</BrandLink>, { wrapper: darkWrapper })
    const a = container.querySelector('a') as HTMLAnchorElement
    const style = a.getAttribute('style') ?? ''
    // semantic.link.fg dark = #7a98e1 → rgb(122, 152, 225).
    expect(style).toMatch(/color:\s*rgb\(122,\s*152,\s*225\)/)
  })

  it('plain left-click calls onPress + preventDefault', () => {
    const onPress = vi.fn()
    const { container } = render(<BrandLink href="/x" onPress={onPress}>Tag</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('cmd-click falls through to browser default (no onPress)', () => {
    const onPress = vi.fn()
    const { container } = render(<BrandLink href="/x" onPress={onPress}>Tag</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('plain left-click without onPress calls Linking.openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(<BrandLink href="https://example.com">Tag</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    a.dispatchEvent(event)
    expect(spy).toHaveBeenCalledWith('https://example.com')
  })

  it('external=true adds target=_blank rel=noopener noreferrer', () => {
    const { container } = render(<BrandLink href="https://example.com" external>Visit</BrandLink>)
    const a = container.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toBe('noopener noreferrer')
  })
})
