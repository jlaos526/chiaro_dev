import { render, waitFor } from '@testing-library/react-native'

// Home-route navigation test for apps/mobile/app/(app)/index.tsx. The OfficialsCard
// onSelect builds the rep-detail href (with the issue-positions sub-cascade deep
// link when subCascadeSlug is present). We mock @chiaro/officials-ui to CAPTURE
// OfficialsCard's onSelect (and stub the other home components), render the home
// screen, then invoke the captured callback to assert router.push targets.
// Top-level jest.mock (hoisted) — no resetModules (Gotcha #11).

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}))
jest.mock('expo-router/drawer', () => ({ Drawer: { Screen: () => null } }))
jest.mock('@/lib/supabase', () => ({ supabase: {} }))
jest.mock('@/components/DistrictPanel', () => ({ DistrictPanel: () => null }))

jest.mock('@chiaro/profile', () => ({
  getMyProfile: jest.fn().mockResolvedValue({
    display_name: 'Ada',
    username: 'ada',
    completed: true,
  }),
}))

jest.mock('@chiaro/issues', () => ({
  useMySelections: () => ({ data: [] }),
  useIssueCatalog: () => ({ data: [] }),
}))

type SelectArg = { officialId: string; subCascadeSlug?: string }
let capturedOnSelect: ((arg: SelectArg) => void) | null = null
jest.mock('@chiaro/officials-ui', () => {
  const React = require('react')
  const { Text } = require('react-native')
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children)
  const nullStub = () => null
  return {
    BrandPageScreen: passthrough,
    BrandHeading: passthrough,
    BrandBodyText: passthrough,
    BrandAlert: nullStub,
    BrandLink: nullStub,
    Logo: nullStub,
    MyIssuesCard: nullStub,
    OfficialsCard: (props: { onSelect: (arg: SelectArg) => void }) => {
      capturedOnSelect = props.onSelect
      return React.createElement(Text, null, 'OfficialsCard')
    },
  }
})

import Home from '../app/(app)/index'

async function mountAndCapture(): Promise<(arg: SelectArg) => void> {
  capturedOnSelect = null
  const { findByText } = render(<Home />)
  // Home renders OfficialsCard only after getMyProfile resolves (loaded gate).
  await findByText('OfficialsCard')
  await waitFor(() => expect(capturedOnSelect).not.toBeNull())
  return capturedOnSelect!
}

describe('mobile home — OfficialsCard navigation', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('pushes the sub-cascade deep link when subCascadeSlug is present', async () => {
    const onSelect = await mountAndCapture()
    onSelect({ officialId: 'o1', subCascadeSlug: 'finance' })
    expect(mockPush).toHaveBeenCalledWith('/officials/o1?cat=issue-positions&sub=finance')
  })

  it('pushes the plain rep-detail href when subCascadeSlug is absent', async () => {
    const onSelect = await mountAndCapture()
    onSelect({ officialId: 'o1' })
    expect(mockPush).toHaveBeenCalledWith('/officials/o1')
  })
})
