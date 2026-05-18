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
