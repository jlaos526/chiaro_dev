import { render, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Text } from 'react-native'
import { EvidenceExpand } from '../../src/cards/EvidenceExpand.tsx'

describe('EvidenceExpand', () => {
  it('closed state shows "view evidence" + chevron ▸, hides children', () => {
    const { getByText, queryByText } = render(
      <EvidenceExpand title="Transactions" open={false} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>,
    )
    expect(getByText('view evidence')).toBeTruthy()
    expect(getByText('▸')).toBeTruthy()
    expect(queryByText('row 1')).toBeNull()
  })

  it('open state shows ▾ + content + "Hide evidence"', () => {
    const { getByText } = render(
      <EvidenceExpand title="Transactions" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>,
    )
    expect(getByText('Hide evidence')).toBeTruthy()
    expect(getByText('▾')).toBeTruthy()
    expect(getByText('row 1')).toBeTruthy()
  })

  it('open state renders the title heading', () => {
    const { getByText } = render(
      <EvidenceExpand title="Missed Votes" open={true} onToggle={() => {}}>
        <Text>x</Text>
      </EvidenceExpand>,
    )
    expect(getByText('Missed Votes')).toBeTruthy()
  })

  it('clicking the toggle calls onToggle', () => {
    const onToggle = vi.fn()
    const { getByText } = render(
      <EvidenceExpand title="x" open={false} onToggle={onToggle}>
        <Text>x</Text>
      </EvidenceExpand>,
    )
    fireEvent.click(getByText('view evidence'))
    expect(onToggle).toHaveBeenCalledOnce()
  })

  it('borderTopColor uses semantic.border.default in light mode (slice 46)', () => {
    const { container } = render(
      <EvidenceExpand title="Test" open={true} onToggle={() => {}}>
        <Text>row 1</Text>
      </EvidenceExpand>,
    )
    // The first child View has the dashed top border (when open=true).
    const inner = container.querySelector('[style*="border-top"]') as HTMLElement | null
    expect(inner).not.toBeNull()
    const style = inner?.getAttribute('style') ?? ''
    // RNW normalizes #e8d8c2 (semantic.border.default light) to rgb(232, 216, 194).
    expect(style).toMatch(/border-top-color:\s*rgb\(232,\s*216,\s*194\)/)
  })
})
