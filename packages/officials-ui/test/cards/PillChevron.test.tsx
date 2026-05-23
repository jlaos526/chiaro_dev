import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PillChevron } from '../../src/cards/PillChevron.tsx'

describe('PillChevron', () => {
  it('renders ▸ when open=false', () => {
    const { getByText } = render(<PillChevron open={false} />)
    expect(getByText('▸')).toBeTruthy()
  })

  it('renders ▾ when open=true', () => {
    const { getByText } = render(<PillChevron open={true} />)
    expect(getByText('▾')).toBeTruthy()
  })

  it('accepts size="sm" variant', () => {
    const { getByText } = render(<PillChevron open={false} size="sm" />)
    expect(getByText('▸')).toBeTruthy()
  })
})
