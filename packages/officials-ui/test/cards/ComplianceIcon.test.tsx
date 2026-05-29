import { createElement, type ReactNode } from 'react'
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComplianceIcon } from '../../src/cards/ComplianceIcon.tsx'
import { BrandModeOverrideContext } from '../../src/brand-hooks.ts'

const lightWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'light' }, children)
const darkWrapper = ({ children }: { children: ReactNode }) =>
  createElement(BrandModeOverrideContext.Provider, { value: 'dark' }, children)

describe('ComplianceIcon', () => {
  it('on-time variant renders ✓', () => {
    const { getByText } = render(<ComplianceIcon state="on-time" />)
    expect(getByText('✓')).toBeTruthy()
  })

  it('late variant renders ✖ (U+2716)', () => {
    const { getByText } = render(<ComplianceIcon state="late" />)
    const el = getByText('✖')
    expect(el.textContent?.charCodeAt(0)).toBe(0x2716)
  })

  it('exposes accessibility label per state', () => {
    const onTime = render(<ComplianceIcon state="on-time" />)
    expect(onTime.container.querySelector('[aria-label="Filed on time"]')).not.toBeNull()
    onTime.unmount()

    const late = render(<ComplianceIcon state="late" />)
    expect(late.container.querySelector('[aria-label="Late filing"]')).not.toBeNull()
  })

  it('on-time bg uses light strongly-aligned chip bg in light mode', () => {
    const { container } = render(<ComplianceIcon state="on-time" />, { wrapper: lightWrapper })
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #a8d4b0 to rgb(168, 212, 176) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(168,\s*212,\s*176\)/)
  })

  it('on-time bg uses dark strongly-aligned chip bg in dark mode', () => {
    const { container } = render(<ComplianceIcon state="on-time" />, { wrapper: darkWrapper })
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #143020 to rgb(20, 48, 32) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(20,\s*48,\s*32\)/)
  })

  it('late bg uses light mostly-differs chip bg in light mode', () => {
    const { container } = render(<ComplianceIcon state="late" />, { wrapper: lightWrapper })
    const outer = container.firstElementChild as HTMLElement | null
    expect(outer).not.toBeNull()
    const style = outer?.getAttribute('style') ?? ''
    // RNW normalizes #f0d3c0 to rgb(240, 211, 192) in inline style.
    expect(style).toMatch(/background-color:\s*rgb\(240,\s*211,\s*192\)/)
  })
})
