import { render, screen, fireEvent } from '@testing-library/react-native'
import { Text } from 'react-native'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

describe('EvidenceExpand', () => {
  it('closed: shows "view evidence", hides children', () => {
    render(
      <EvidenceExpand title="Transactions" open={false} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>
    )
    expect(screen.getByText('view evidence')).toBeTruthy()
    expect(screen.queryByText('row 1')).toBeNull()
  })

  it('open: shows "Hide evidence" + title + children', () => {
    render(
      <EvidenceExpand title="Transactions" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>
    )
    expect(screen.getByText('Hide evidence')).toBeTruthy()
    expect(screen.getByText('Transactions')).toBeTruthy()
    expect(screen.getByText('row 1')).toBeTruthy()
  })

  it('press toggle calls onToggle', () => {
    const onToggle = jest.fn()
    render(
      <EvidenceExpand title="x" open={false} onToggle={onToggle}>
        <Text>x-child</Text>
      </EvidenceExpand>
    )
    fireEvent.press(screen.getByText('view evidence'))
    expect(onToggle).toHaveBeenCalled()
  })
})
