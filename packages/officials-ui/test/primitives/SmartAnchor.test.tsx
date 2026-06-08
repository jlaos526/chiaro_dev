import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Linking } from 'react-native'
import { SmartAnchor } from '../../src/primitives/SmartAnchor.tsx'

describe('SmartAnchor', () => {
  it('renders as a real <a href> on web', () => {
    const { container } = render(<SmartAnchor href="https://example.com">Visit</SmartAnchor>)
    const a = container.querySelector('a[href="https://example.com"]')
    expect(a).not.toBeNull()
    expect(a?.textContent).toBe('Visit')
  })

  it('passes accessibilityLabel through as aria-label', () => {
    const { container } = render(
      <SmartAnchor href="/x" accessibilityLabel="Go somewhere">Tag</SmartAnchor>,
    )
    const a = container.querySelector('a') as HTMLAnchorElement
    expect(a.getAttribute('aria-label')).toBe('Go somewhere')
  })

  it('merges caller style after the base textDecoration/color', () => {
    const { container } = render(
      <SmartAnchor href="/x" style={{ display: 'inline-block', cursor: 'pointer' }}>Tag</SmartAnchor>,
    )
    const a = container.querySelector('a') as HTMLAnchorElement
    const style = a.getAttribute('style') ?? ''
    expect(style).toMatch(/text-decoration:\s*none/)
    expect(style).toMatch(/display:\s*inline-block/)
  })

  it('plain left-click calls onPress + preventDefault', () => {
    const onPress = vi.fn()
    const { container } = render(<SmartAnchor href="/x" onPress={onPress}>Tag</SmartAnchor>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(false)
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('cmd-click falls through to browser default (no onPress)', () => {
    const onPress = vi.fn()
    const { container } = render(<SmartAnchor href="/x" onPress={onPress}>Tag</SmartAnchor>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, metaKey: true })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('ctrl-click falls through to browser default (no onPress)', () => {
    const onPress = vi.fn()
    const { container } = render(<SmartAnchor href="/x" onPress={onPress}>Tag</SmartAnchor>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    const notPrevented = a.dispatchEvent(event)
    expect(notPrevented).toBe(true)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('middle-click (button=1) falls through to browser default (no onPress)', () => {
    const onPress = vi.fn()
    const { container } = render(<SmartAnchor href="/x" onPress={onPress}>Tag</SmartAnchor>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 })
    a.dispatchEvent(event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('plain left-click without onPress calls Linking.openURL', () => {
    const spy = vi.spyOn(Linking, 'openURL').mockResolvedValue(true)
    const { container } = render(<SmartAnchor href="https://example.com">Tag</SmartAnchor>)
    const a = container.querySelector('a') as HTMLAnchorElement
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    a.dispatchEvent(event)
    expect(spy).toHaveBeenCalledWith('https://example.com')
  })
})
