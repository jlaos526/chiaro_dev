import { createElement, type ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BrandButton } from '../../src/primitives/BrandButton.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('BrandButton', () => {
  it('renders children', () => {
    render(<BrandButton onPress={() => {}}>Save</BrandButton>)
    expect(screen.getByText('Save')).toBeTruthy()
  })

  it('calls onPress when clicked', () => {
    const onPress = vi.fn()
    render(<BrandButton onPress={onPress}>Save</BrandButton>)
    fireEvent.click(screen.getByText('Save'))
    expect(onPress).toHaveBeenCalledOnce()
  })

  it('primary variant uses accent.primary bg in light mode', () => {
    const { container } = render(<BrandButton onPress={() => {}}>Save</BrandButton>, {
      wrapper: lightWrapper,
    })
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn).not.toBeNull()
    const style = btn?.getAttribute('style') ?? ''
    // RNW normalizes #c46a2a to rgb(196, 106, 42).
    expect(style).toMatch(/background-color:\s*rgb\(196,\s*106,\s*42\)/)
  })

  it('primary variant uses slate-blue accent.primary bg in dark mode', () => {
    const { container } = render(<BrandButton onPress={() => {}}>Save</BrandButton>, {
      wrapper: darkWrapper,
    })
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn).not.toBeNull()
    const style = btn?.getAttribute('style') ?? ''
    // RNW normalizes #374f68 to rgb(55, 79, 104).
    expect(style).toMatch(/background-color:\s*rgb\(55,\s*79,\s*104\)/)
  })

  it('secondary variant renders transparent bg + colored border', () => {
    const { container } = render(
      <BrandButton variant="secondary" onPress={() => {}}>
        Save
      </BrandButton>,
      { wrapper: lightWrapper },
    )
    const btn = container.firstElementChild as HTMLElement | null
    const style = btn?.getAttribute('style') ?? ''
    expect(style).toMatch(/background-color:\s*(transparent|rgba\(0,\s*0,\s*0,\s*0\))/)
    // RNW's StyleSheet expands the `borderColor` shorthand to 4 longhand
    // properties (border-top-color / -right-color / -bottom-color / -left-color).
    // Assert all 4 carry the accent.primary color.
    expect(style).toMatch(/border-top-color:\s*rgb\(196,\s*106,\s*42\)/)
    expect(style).toMatch(/border-right-color:\s*rgb\(196,\s*106,\s*42\)/)
    expect(style).toMatch(/border-bottom-color:\s*rgb\(196,\s*106,\s*42\)/)
    expect(style).toMatch(/border-left-color:\s*rgb\(196,\s*106,\s*42\)/)
  })

  it('disabled prop sets aria-disabled + does NOT call onPress when clicked', () => {
    const onPress = vi.fn()
    render(
      <BrandButton onPress={onPress} disabled>
        Save
      </BrandButton>,
    )
    const btn = screen.getByText('Save').closest('[role="button"]') as HTMLElement | null
    expect(btn?.getAttribute('aria-disabled')).toBe('true')
    fireEvent.click(btn!)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('size sm renders 32px height', () => {
    const { container } = render(
      <BrandButton size="sm" onPress={() => {}}>
        Save
      </BrandButton>,
    )
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn?.getAttribute('style') ?? '').toMatch(/height:\s*32px/)
  })

  it('size lg renders 48px height', () => {
    const { container } = render(
      <BrandButton size="lg" onPress={() => {}}>
        Save
      </BrandButton>,
    )
    const btn = container.firstElementChild as HTMLElement | null
    expect(btn?.getAttribute('style') ?? '').toMatch(/height:\s*48px/)
  })
})
