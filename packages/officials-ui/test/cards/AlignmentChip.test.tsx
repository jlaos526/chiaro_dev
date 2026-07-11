import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AlignmentChip } from '../../src/cards/AlignmentChip.tsx'

describe('AlignmentChip — inert + Pressable fallback', () => {
  it('renders the label', () => {
    render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.getByText('Environment')).toBeTruthy()
  })

  it('renders inert (no link role, no anchor) when both href and onPress are omitted', () => {
    const { container } = render(<AlignmentChip label="Environment" tier="strongly-aligned" />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(container.querySelector('a')).toBeNull()
  })

  it('with onPress only (no href): renders Pressable with link role + accessibility label', () => {
    const onPress = vi.fn()
    render(<AlignmentChip label="Environment" tier="strongly-aligned" onPress={onPress} />)
    const link = screen.getByRole('link', { name: /View Environment positions/i })
    expect(link).toBeTruthy()
    expect(link.tagName.toLowerCase()).not.toBe('a')
  })

  it('with onPress only: clicking invokes onPress', () => {
    const onPress = vi.fn()
    render(<AlignmentChip label="Environment" tier="strongly-aligned" onPress={onPress} />)
    const link = screen.getByRole('link', { name: /View Environment positions/i })
    fireEvent.click(link)
    expect(onPress).toHaveBeenCalledTimes(1)
  })
})

describe('AlignmentChip — web smart-anchor (href present)', () => {
  it('renders a real <a href> when href is provided on web', () => {
    const { container } = render(
      <AlignmentChip
        label="Environment"
        tier="strongly-aligned"
        href="/officials/123?issue=environment"
      />,
    )
    const anchor = container.querySelector('a')
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute('href')).toBe('/officials/123?issue=environment')
    expect(anchor?.getAttribute('aria-label')).toBe('View Environment positions')
  })

  it('plain left-click on anchor calls preventDefault + invokes onPress', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AlignmentChip label="Environment" tier="strongly-aligned" href="/x" onPress={onPress} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notDefaultPrevented = anchor.dispatchEvent(event)
    expect(notDefaultPrevented).toBe(false)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('cmd-click falls through to browser default (does NOT call onPress)', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AlignmentChip label="Environment" tier="strongly-aligned" href="/x" onPress={onPress} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      metaKey: true,
    })
    anchor.dispatchEvent(event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('ctrl-click falls through to browser default', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AlignmentChip label="Environment" tier="strongly-aligned" href="/x" onPress={onPress} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      ctrlKey: true,
    })
    anchor.dispatchEvent(event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('shift-click falls through to browser default', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AlignmentChip label="Environment" tier="strongly-aligned" href="/x" onPress={onPress} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      button: 0,
      shiftKey: true,
    })
    anchor.dispatchEvent(event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('middle-click (button=1) falls through to browser default', () => {
    const onPress = vi.fn()
    const { container } = render(
      <AlignmentChip label="Environment" tier="strongly-aligned" href="/x" onPress={onPress} />,
    )
    const anchor = container.querySelector('a')!
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 })
    anchor.dispatchEvent(event)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('renders <a href> WITHOUT onPress: browser handles plain click (no preventDefault)', () => {
    const { container } = render(
      <AlignmentChip label="Environment" tier="strongly-aligned" href="/officials/123" />,
    )
    const anchor = container.querySelector('a')!
    expect(anchor.getAttribute('href')).toBe('/officials/123')
    const event = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 })
    const notPrevented = anchor.dispatchEvent(event)
    expect(notPrevented).toBe(true)
  })
})
