import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Text } from 'react-native'
import { CardSubsection } from '../../src/cards/CardSubsection.tsx'

describe('CardSubsection', () => {
  it('renders the label', () => {
    render(
      <CardSubsection label="Leadership history (3)" open={false} onToggle={() => {}}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    expect(screen.getByText(/Leadership history \(3\)/)).toBeTruthy()
  })

  it('hides children when open={false}', () => {
    render(
      <CardSubsection label="Leadership" open={false} onToggle={() => {}}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    expect(screen.queryByText('row 1')).toBeNull()
    expect(screen.getByText(/▸/)).toBeTruthy()
  })

  it('shows children when open={true}', () => {
    render(
      <CardSubsection label="Leadership" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    expect(screen.getByText('row 1')).toBeTruthy()
    expect(screen.getByText(/▾/)).toBeTruthy()
  })

  it('calls onToggle when pressed', () => {
    const onToggle = vi.fn()
    render(
      <CardSubsection label="Leadership" open={false} onToggle={onToggle}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Expand Leadership/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('exposes accessibility metadata reflecting open prop', () => {
    // The Pressable carries accessibilityRole="button" plus an
    // accessibilityLabel + accessibilityState that flip with `open`.
    // react-native-web translates accessibilityLabel → aria-label which
    // testing-library's getByRole({ name }) matches against; the
    // collapse/expand verb in the name is the durable signal.
    const { rerender } = render(
      <CardSubsection label="Leadership" open={false} onToggle={() => {}}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    expect(screen.getByRole('button', { name: /Expand Leadership/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Collapse Leadership/i })).toBeNull()

    rerender(
      <CardSubsection label="Leadership" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    expect(screen.getByRole('button', { name: /Collapse Leadership/i })).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Expand Leadership/i })).toBeNull()
  })

  it('triangle character matches open state', () => {
    const { rerender } = render(
      <CardSubsection label="Leadership" open={false} onToggle={() => {}}>
        <Text>x</Text>
      </CardSubsection>,
    )
    expect(screen.getByText(/▸ Leadership/)).toBeTruthy()

    rerender(
      <CardSubsection label="Leadership" open={true} onToggle={() => {}}>
        <Text>x</Text>
      </CardSubsection>,
    )
    expect(screen.getByText(/▾ Leadership/)).toBeTruthy()
  })

  it('Pressable reports aria-expanded reflecting open prop', () => {
    // RNW 0.19 does not translate accessibilityState={{ expanded }} to the
    // aria-expanded DOM attribute (it only reads from the explicit
    // aria-expanded prop or the deprecated accessibilityExpanded singleton).
    // CardSubsection sets aria-expanded={open} directly alongside
    // accessibilityState; this test asserts the DOM attribute flips.
    const onToggle = vi.fn()
    const { container, rerender } = render(
      <CardSubsection label="Leadership" open={false} onToggle={onToggle}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    const button = container.querySelector('[role="button"][aria-expanded]')
    expect(button).not.toBeNull()
    expect(button?.getAttribute('aria-expanded')).toBe('false')

    rerender(
      <CardSubsection label="Leadership" open={true} onToggle={onToggle}>
        <Text>row 1</Text>
      </CardSubsection>,
    )
    expect(
      container.querySelector('[role="button"]')?.getAttribute('aria-expanded'),
    ).toBe('true')
  })
})
