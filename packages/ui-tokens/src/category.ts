// Slice 77 (audit C24): the CategoryId/CATEGORY_LABEL/CATEGORY_ACCENT(_DARK)/
// SUB_CASCADE_ACCENT(_DARK) surface was DELETED — its only consumers were the
// orphaned slice-4-era MetricCardShell/finance-atom family removed in the same
// slice (dead since slice 6's Federal*Card redesign, yet reskinned in slices
// 41/42/43/57/61). CATEGORY_CARD_BG survives: BrandAlert consumes it.

// Slice 43: universal category card bg. Light value is V2b "medium pop" —
// visibly elevated above page bg #efece5 without overshooting into clinical
// white. Dark value sits above slice 40 surface.elevated #262a30 for clearer
// card boundaries against page bg #16181c.
// See docs/superpowers/specs/2026-05-29-card-bg-stripe-cascade-design.md §4.
export const CATEGORY_CARD_BG = '#fffaf2'
export const CATEGORY_CARD_BG_DARK = '#2a2e34'
