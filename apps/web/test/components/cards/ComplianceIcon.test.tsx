import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'

describe('ComplianceIcon', () => {
  it('on-time variant renders ✓ on Strongly-Aligned palette', () => {
    render(<ComplianceIcon state="on-time" />)
    const el = screen.getByText('✓')
    expect(el.style.background).toContain('rgb(197, 227, 199)')
    expect(el.style.color).toContain('rgb(31, 77, 36)')
  })

  it('late variant renders ✖ (U+2716) on Mostly-Differs palette', () => {
    render(<ComplianceIcon state="late" />)
    const el = screen.getByText('✖')
    expect(el.textContent).toBe('✖')
    expect(el.textContent?.charCodeAt(0)).toBe(0x2716)
    expect(el.style.background).toContain('rgb(244, 211, 192)')
    expect(el.style.color).toContain('rgb(122, 62, 28)')
  })

  it('has aria-label for screen readers', () => {
    render(<ComplianceIcon state="late" />)
    expect(screen.getByLabelText('Late filing')).toBeTruthy()
    render(<ComplianceIcon state="on-time" />)
    expect(screen.getByLabelText('Filed on time')).toBeTruthy()
  })
})
