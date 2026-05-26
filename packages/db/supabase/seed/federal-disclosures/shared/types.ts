import type { SkipReason } from '../../shared/instrumentation.ts'

export interface NormalizedPtr {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  transaction_date:      string  // ISO date YYYY-MM-DD
  filing_date:           string
  asset_ticker?:         string
  asset_name?:           string
  transaction_type:      'purchase' | 'sale' | 'exchange'
  amount_range_low?:     number
  amount_range_high?:    number
  source_url:            string
  external_id:           string
}

export interface NormalizedHolding {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  asset_name?:           string
  asset_ticker?:         string
  asset_type?:           'stock' | 'bond' | 'mutual_fund' | 'etf' | 'trust' | 'partnership' | 'real_estate' | 'cash' | 'other'
  value_min?:            number
  value_max?:            number
  income_type?:          'dividends' | 'interest' | 'capital_gains' | 'rent' | 'royalties' | 'none' | 'other'
  income_min?:           number
  income_max?:           number
  source_url:            string
  external_id:           string
}

export interface NormalizedDisclosureOther {
  official_bioguide_id?: string
  official_full_name?:   string
  filing_year:           number
  category:              'gift' | 'travel' | 'position' | 'agreement' | 'liability' | 'compensation' | 'honoraria'
  description?:          string
  source_party?:         string
  value_min?:            number
  value_max?:            number
  value_text?:           string
  source_url:            string
  external_id:           string
}

export interface FederalAdapterOpts {
  year:    number
  fetcher?: typeof fetch
  onSkip?: (r: SkipReason) => void
}

export interface PtrAdapter {
  slug: 'house-efd-ptr' | 'senate-efpfd-ptr'
  fetchTransactions(opts: FederalAdapterOpts): Promise<NormalizedPtr[]>
}

export interface FdAdapter {
  slug: 'house-efd-fd' | 'senate-efpfd-fd'
  fetchDisclosures(opts: FederalAdapterOpts): Promise<{
    holdings: NormalizedHolding[]
    other:    NormalizedDisclosureOther[]
  }>
}
