import { render, screen } from '@testing-library/react-native'
import { Text } from 'react-native'

describe('smoke', () => {
  it('renders a Text node and finds it', () => {
    render(<Text>hello mobile tests</Text>)
    expect(screen.getByText('hello mobile tests')).toBeTruthy()
  })
})
