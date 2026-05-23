import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ComplianceIcon } from '../../src/cards/ComplianceIcon.tsx'

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
})
