import { render, screen, fireEvent } from '@testing-library/react-native'
import { SubCascadeBar } from '@/components/performance/SubCascadeBar'

describe('SubCascadeBar', () => {
  it('renders name + teaser', () => {
    render(<SubCascadeBar categoryId="issue-positions" subId="environment" name="Environment" teaser="LCV Strongly Aligned" open={false} onToggle={() => {}} />)
    expect(screen.getByText('Environment')).toBeTruthy()
    expect(screen.getByText('LCV Strongly Aligned')).toBeTruthy()
  })
  it('plain chevron ▸ when closed', () => {
    render(<SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={() => {}} />)
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('placeholder is non-pressable', () => {
    const onToggle = jest.fn()
    render(<SubCascadeBar categoryId="finance" subId="x" name="Top Orgs" teaser="data coming" open={false} onToggle={onToggle} placeholder={true} />)
    fireEvent.press(screen.getByText('Top Orgs'))
    expect(onToggle).not.toHaveBeenCalled()
  })
  it('press fires onToggle when not placeholder', () => {
    const onToggle = jest.fn()
    render(<SubCascadeBar categoryId="finance" subId="pacs" name="PACs" teaser="x" open={false} onToggle={onToggle} />)
    fireEvent.press(screen.getByText('PACs'))
    expect(onToggle).toHaveBeenCalled()
  })
})
