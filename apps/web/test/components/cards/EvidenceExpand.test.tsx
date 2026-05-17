import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { EvidenceExpand } from '@/components/cards/EvidenceExpand'

describe('EvidenceExpand', () => {
  it('closed state shows "view evidence" pill chevron button', () => {
    render(
      <EvidenceExpand title="Transactions" open={false} onToggle={() => {}}>
        <div>row 1</div>
      </EvidenceExpand>
    )
    expect(screen.getByText('view evidence')).toBeTruthy()
    expect(screen.getByText('▸')).toBeTruthy()
    expect(screen.queryByText('row 1')).toBeNull()
  })

  it('open state shows ▾ + content + "Hide evidence"', () => {
    render(
      <EvidenceExpand title="Transactions" open={true} onToggle={() => {}}>
        <div>row 1</div>
      </EvidenceExpand>
    )
    expect(screen.getByText('Hide evidence')).toBeTruthy()
    expect(screen.getByText('▾')).toBeTruthy()
    expect(screen.getByText('row 1')).toBeTruthy()
  })

  it('open state renders the title heading', () => {
    render(
      <EvidenceExpand title="Missed Votes" open={true} onToggle={() => {}}>
        <div />
      </EvidenceExpand>
    )
    expect(screen.getByText('Missed Votes')).toBeTruthy()
  })

  it('toggle button calls onToggle', () => {
    const onToggle = vi.fn()
    render(
      <EvidenceExpand title="Transactions" open={false} onToggle={onToggle}>
        <div />
      </EvidenceExpand>
    )
    fireEvent.click(screen.getByText('view evidence').closest('button')!)
    expect(onToggle).toHaveBeenCalledOnce()
  })
})
