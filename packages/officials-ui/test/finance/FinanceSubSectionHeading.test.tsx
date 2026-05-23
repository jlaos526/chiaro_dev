import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FinanceSubSectionHeading } from '../../src/finance/FinanceSubSectionHeading.tsx'

describe('FinanceSubSectionHeading', () => {
  it('renders the label', () => {
    render(<FinanceSubSectionHeading label="Top Industries" textColor="#1a1714" ruleColor="#d8d4c9" />)
    expect(screen.getByText('Top Industries')).toBeTruthy()
  })

  it('label uses uppercase + 700 weight', () => {
    render(<FinanceSubSectionHeading label="Top Donors" textColor="#1a1714" ruleColor="#d8d4c9" />)
    const text = screen.getByText('Top Donors')
    // RN-web flattens styles onto inline style; assert key props directly.
    expect(text.style.textTransform).toBe('uppercase')
    // RN-web emits font-weight as a string (700 → '700').
    expect(text.style.fontWeight).toBe('700')
  })
})
