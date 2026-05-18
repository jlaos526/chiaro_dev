import { render, screen, fireEvent } from '@testing-library/react-native'
import { Linking } from 'react-native'
import { MetricCardShell } from '@/components/cards/MetricCardShell'

describe('MetricCardShell', () => {
  it('renders value + label + caption', () => {
    render(
      <MetricCardShell
        value="$223,500"
        label="Base Salary"
        caption="Speaker"
        categoryId="service-record"
        externalSourceUrl="https://crsreports.congress.gov/example"
      />
    )
    expect(screen.getByText('$223,500')).toBeTruthy()
    expect(screen.getByText('Base Salary')).toBeTruthy()
    expect(screen.getByText('Speaker')).toBeTruthy()
  })

  it('press onExpand fires', () => {
    const onExpand = jest.fn()
    render(<MetricCardShell value="50%" label="Attendance" categoryId="voting-bills" onExpand={onExpand} />)
    fireEvent.press(screen.getByText('view evidence →'))
    expect(onExpand).toHaveBeenCalled()
  })

  it('press externalSourceUrl link opens via Linking', () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true)
    render(<MetricCardShell value="$5M" label="Total Raised" categoryId="finance" externalSourceUrl="https://www.opensecrets.org" />)
    fireEvent.press(screen.getByText('view source →'))
    expect(spy).toHaveBeenCalledWith('https://www.opensecrets.org')
    spy.mockRestore()
  })

  it('unavailable forces label to "Unavailable"', () => {
    render(<MetricCardShell value="No Data" label="Lives in District" categoryId="community-presence" unavailable={true} />)
    expect(screen.getByText('Unavailable')).toBeTruthy()
    expect(screen.queryByText('Lives in District')).toBeNull()
  })

  it('unavailable suppresses CTA', () => {
    const onExpand = jest.fn()
    render(<MetricCardShell value="No Data" label="Test" categoryId="finance" unavailable={true} onExpand={onExpand} />)
    expect(screen.queryByText('view evidence →')).toBeNull()
  })
})
