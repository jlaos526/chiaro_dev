import { render, screen } from '@testing-library/react-native'
import { ComplianceIcon } from '@/components/cards/ComplianceIcon'

describe('ComplianceIcon', () => {
  it('on-time renders ✓', () => {
    render(<ComplianceIcon state="on-time" />)
    expect(screen.getByText('✓')).toBeTruthy()
  })
  it('late renders ✖ (U+2716)', () => {
    render(<ComplianceIcon state="late" />)
    expect(screen.getByText('✖')).toBeTruthy()
  })
})
