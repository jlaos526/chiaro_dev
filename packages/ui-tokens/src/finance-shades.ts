export const FINANCE_SUB_SECTION_SHADES = {
  contributors: {
    accent:  '#a8d2b1',
    heading: '#2d5d3a',
  },
  topDonor: {
    accent:  '#a8d4c0',
    heading: '#2a5d4a',
  },
} as const

export type FinanceSubSectionShade = typeof FINANCE_SUB_SECTION_SHADES[keyof typeof FINANCE_SUB_SECTION_SHADES]

// Slice 37: dark-mode shades. Inverts the light/dark relationship — `accent`
// (cell bg / accent stripe) becomes a deep tier-tinted surface; `heading`
// (bright caption text) becomes the readable bright token against it.
export const FINANCE_SUB_SECTION_SHADES_DARK = {
  contributors: {
    accent:  '#1f3a28',
    heading: '#a8d2b1',
  },
  topDonor: {
    accent:  '#1f3a30',
    heading: '#a8d4c0',
  },
} as const
