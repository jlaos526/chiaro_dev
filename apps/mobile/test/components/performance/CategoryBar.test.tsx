import { render, screen, fireEvent } from '@testing-library/react-native'
import { CategoryBar } from '@/components/performance/CategoryBar'

describe('CategoryBar', () => {
  it('renders label + teaser when closed', () => {
    render(<CategoryBar categoryId="finance" teaser="$5M raised" open={false} onToggle={() => {}} />)
    expect(screen.getByText('Finance')).toBeTruthy()
    expect(screen.getByText('$5M raised')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
  })
  it('renders ▾ when open', () => {
    render(<CategoryBar categoryId="finance" teaser={null} open={true} onToggle={() => {}} />)
    expect(screen.getByText('▾')).toBeTruthy()
  })
  it('press fires onToggle', () => {
    const onToggle = jest.fn()
    render(<CategoryBar categoryId="finance" teaser="x" open={false} onToggle={onToggle} />)
    fireEvent.press(screen.getByText('Finance'))
    expect(onToggle).toHaveBeenCalled()
  })
})
