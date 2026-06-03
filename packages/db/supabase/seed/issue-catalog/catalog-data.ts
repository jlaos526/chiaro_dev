// Slice 52 — the real issue-priorities catalog (13 locked topics).
//
// Stances are NEUTRAL & objectively measurable; `measurement_sources` wire to
// existing scorecard orgs (real slugs only — see seed/scorecards/*.ts +
// seed/state-scorecards/*.ts) and Congress.gov legislative-subject strings
// (exact/case-insensitive match against bill_subjects.subject; a miss returns
// NULL and degrades gracefully, NULL ≠ 0). Watchlists ship fully empty
// (no measurement_sources / evidence_sources / quiz_questions in v1).
//
// agree_direction on a quiz_question: +1 = "Agree" raises this stance's
// position; -1 = "Agree" lowers it.

export interface MeasurementSource {
  type: 'scorecard' | 'bill-vote'
  weight: number
  config: { orgs?: string[]; invert?: boolean; subjects?: string[]; agree_position?: 'yes' | 'no' }
}
export interface QuizQuestion { slug: string; prompt: string; agree_direction: 1 | -1; display_order: number }
export interface LensSeed {
  slug: string; label: string; lens_type: 'stance' | 'watchlist'; description?: string
  measurement_sources: MeasurementSource[]; evidence_sources: unknown[]; quiz_questions: QuizQuestion[]; display_order: number
}
export interface TopicSeed {
  slug: string; display_name: string; description: string; value_tags: string[]; display_order: number; lenses: LensSeed[]
}

export const ISSUE_CATALOG: TopicSeed[] = [
  // === EXEMPLAR 1: environment (4 stances + 1 watchlist) ===
  { slug: 'environment', display_name: 'Environment', description: 'Conservation, climate, energy, and pollution policy.',
    value_tags: ['progressive'], display_order: 1,
    lenses: [
      { slug: 'conservation', label: 'Conservation', lens_type: 'stance', display_order: 0,
        measurement_sources: [
          { type: 'scorecard', weight: 0.6, config: { orgs: ['lcv', 'sierra-club'] } },
          { type: 'bill-vote', weight: 0.4, config: { subjects: ['Environmental protection', 'Public lands and natural resources'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'public-lands-expand', prompt: 'Public lands should be expanded and protected from new development.', agree_direction: 1, display_order: 0 },
          { slug: 'drilling-protected', prompt: 'Oil and gas drilling should be allowed in currently protected areas.', agree_direction: -1, display_order: 1 },
          { slug: 'epa-stronger', prompt: 'The EPA should have stronger authority to enforce conservation rules.', agree_direction: 1, display_order: 2 } ] },
      { slug: 'climate-action', label: 'Climate Action', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Climate change and greenhouse gases'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'carbon-limits', prompt: 'The government should set binding limits on carbon emissions.', agree_direction: 1, display_order: 0 },
          { slug: 'renewables-subsidy', prompt: 'Renewable energy should receive major public investment.', agree_direction: 1, display_order: 1 },
          { slug: 'climate-overstated', prompt: 'The risks of climate change are overstated.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'industry-donor-recipients', label: 'Industry Donor Recipients', lens_type: 'watchlist', display_order: 2,
        description: 'Reps receiving major fossil-fuel industry contributions.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] } ] },

  // === immigration (2 stances) ===
  { slug: 'immigration', display_name: 'Immigration', description: 'Border enforcement, legal pathways, and the treatment of immigrants.',
    value_tags: [], display_order: 2,
    lenses: [
      { slug: 'border-enforcement', label: 'Border Enforcement', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Immigration', 'Border security and unlawful immigration'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'border-wall', prompt: 'The federal government should invest heavily in physical and technological barriers at the border.', agree_direction: 1, display_order: 0 },
          { slug: 'more-agents', prompt: 'Border Patrol and immigration enforcement agencies should be expanded.', agree_direction: 1, display_order: 1 },
          { slug: 'sanctuary-cities', prompt: 'Local "sanctuary" policies that limit cooperation with federal immigration enforcement are acceptable.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'pathways-to-status', label: 'Pathways to Status', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['aclu'] } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'dreamers-citizenship', prompt: 'People brought to the country as children should have a path to citizenship.', agree_direction: 1, display_order: 0 },
          { slug: 'expand-legal-immigration', prompt: 'Legal immigration levels should be increased.', agree_direction: 1, display_order: 1 },
          { slug: 'deport-undocumented', prompt: 'Most undocumented immigrants should be deported rather than offered legal status.', agree_direction: -1, display_order: 2 } ] } ] },

  // === law-and-order (2 stances + 4 watchlists, per spec) ===
  { slug: 'law-and-order', display_name: 'Law & Order', description: 'Policing, public safety, the criminal-justice system, and government integrity.',
    value_tags: [], display_order: 3,
    lenses: [
      { slug: 'public-safety', label: 'Public Safety', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Law enforcement officers', 'Crime prevention'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'more-police-funding', prompt: 'Police departments should receive more funding and personnel.', agree_direction: 1, display_order: 0 },
          { slug: 'tougher-sentences', prompt: 'Tougher sentences are an effective way to reduce crime.', agree_direction: 1, display_order: 1 },
          { slug: 'defund-police', prompt: 'Some police funding should be redirected to social services and mental-health responders.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'criminal-justice-reform', label: 'Criminal Justice Reform', lens_type: 'stance', display_order: 1,
        measurement_sources: [
          { type: 'scorecard', weight: 0.5, config: { orgs: ['aclu', 'naacp'] } },
          { type: 'bill-vote', weight: 0.5, config: { subjects: ['Criminal justice', 'Sentencing'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'end-cash-bail', prompt: 'Cash bail should be eliminated or sharply curtailed.', agree_direction: 1, display_order: 0 },
          { slug: 'reduce-incarceration', prompt: 'The country should reduce its prison population through sentencing reform.', agree_direction: 1, display_order: 1 },
          { slug: 'mandatory-minimums', prompt: 'Mandatory-minimum sentences should be kept in place.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'anti-fraud-self-interest', label: 'Anti-Fraud & Self-Interest', lens_type: 'watchlist', display_order: 2,
        description: 'Reps tied to fraud findings or votes that advanced their own financial interests.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] },
      { slug: 'for-profit-prisons', label: 'For-Profit Prisons', lens_type: 'watchlist', display_order: 3,
        description: 'Reps receiving major private-prison-industry contributions.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] },
      { slug: 'epstein-related-protectors', label: 'Epstein-Related Protectors', lens_type: 'watchlist', display_order: 4,
        description: 'Reps who acted to block or delay release of Epstein-related records.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] },
      { slug: 'slapp-suit-participants', label: 'SLAPP-Suit Participants', lens_type: 'watchlist', display_order: 5,
        description: 'Reps who filed or supported lawsuits aimed at silencing critics or the press.',
        measurement_sources: [], evidence_sources: [], quiz_questions: [] } ] },

  // === civil-liberties → display "Personal Freedoms" (2 stances) ===
  { slug: 'civil-liberties', display_name: 'Personal Freedoms', description: 'Privacy, free speech, surveillance, and limits on government power over individuals.',
    value_tags: [], display_order: 4,
    lenses: [
      { slug: 'privacy-and-speech', label: 'Privacy & Speech', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['aclu'] } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'limit-surveillance', prompt: 'Government surveillance of citizens should require a warrant and strict limits.', agree_direction: 1, display_order: 0 },
          { slug: 'protect-speech', prompt: 'Even offensive speech should be protected from government restriction.', agree_direction: 1, display_order: 1 },
          { slug: 'security-over-privacy', prompt: 'National security should take priority over individual privacy.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'limited-government', label: 'Limited Government', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Government information and archives', 'Civil rights and liberties, minority issues'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'reduce-fed-power', prompt: 'The federal government has too much power over everyday life.', agree_direction: 1, display_order: 0 },
          { slug: 'states-decide', prompt: 'More decisions should be left to states and individuals rather than Washington.', agree_direction: 1, display_order: 1 },
          { slug: 'federal-standards', prompt: 'Strong national standards are better than letting each state decide.', agree_direction: -1, display_order: 2 } ] } ] },

  // === civil-rights → display "Equality" (2 stances) ===
  { slug: 'civil-rights', display_name: 'Equality', description: 'Anti-discrimination protections and equal treatment under the law.',
    value_tags: ['progressive'], display_order: 5,
    lenses: [
      { slug: 'anti-discrimination', label: 'Anti-Discrimination', lens_type: 'stance', display_order: 0,
        measurement_sources: [
          { type: 'scorecard', weight: 0.6, config: { orgs: ['naacp', 'aclu'] } },
          { type: 'bill-vote', weight: 0.4, config: { subjects: ['Civil rights and liberties, minority issues'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'expand-protections', prompt: 'Anti-discrimination protections should be expanded to cover more groups.', agree_direction: 1, display_order: 0 },
          { slug: 'voting-access', prompt: 'The government should make it easier, not harder, to register and vote.', agree_direction: 1, display_order: 1 },
          { slug: 'colorblind-law', prompt: 'The law should not consider race at all, even to remedy past discrimination.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'equal-opportunity', label: 'Equal Opportunity', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Sex, gender, sexual orientation discrimination'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'pay-equity', prompt: 'The government should act to close pay gaps between demographic groups.', agree_direction: 1, display_order: 0 },
          { slug: 'lgbtq-protections', prompt: 'LGBTQ people should have explicit protection from discrimination in jobs and housing.', agree_direction: 1, display_order: 1 },
          { slug: 'merit-only', prompt: 'Outcomes should be based purely on merit with no consideration of group disparities.', agree_direction: -1, display_order: 2 } ] } ] },

  // === labor (2 stances) ===
  { slug: 'labor', display_name: 'Labor', description: 'Workers’ rights, wages, unions, and workplace protections.',
    value_tags: ['progressive'], display_order: 6,
    lenses: [
      { slug: 'worker-protections', label: 'Worker Protections', lens_type: 'stance', display_order: 0,
        measurement_sources: [
          { type: 'scorecard', weight: 0.6, config: { orgs: ['afl-cio'] } },
          { type: 'bill-vote', weight: 0.4, config: { subjects: ['Labor and employment', 'Employee benefits and pensions'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'raise-min-wage', prompt: 'The federal minimum wage should be raised.', agree_direction: 1, display_order: 0 },
          { slug: 'protect-unions', prompt: 'Workers should have strong legal protections to organize and join unions.', agree_direction: 1, display_order: 1 },
          { slug: 'right-to-work', prompt: '"Right-to-work" laws that weaken union dues requirements are good policy.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'business-flexibility', label: 'Business Flexibility', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['us-chamber'] } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'reduce-mandates', prompt: 'Employers should face fewer mandates so they can hire and grow more easily.', agree_direction: 1, display_order: 0 },
          { slug: 'gig-flexibility', prompt: 'Companies should be able to classify many workers as independent contractors.', agree_direction: 1, display_order: 1 },
          { slug: 'more-regulation', prompt: 'Stronger workplace regulation is worth it even if it raises business costs.', agree_direction: -1, display_order: 2 } ] } ] },

  // === abortion-policy (2 stances; neutral framing, no "pro-life" topic framing) ===
  { slug: 'abortion-policy', display_name: 'Abortion Policy', description: 'The legal availability of and restrictions on abortion.',
    value_tags: [], display_order: 7,
    lenses: [
      { slug: 'abortion-rights', label: 'Abortion Rights', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['planned-parenthood'] } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'legal-most-cases', prompt: 'Abortion should be legal in most or all cases.', agree_direction: 1, display_order: 0 },
          { slug: 'protect-access', prompt: 'The government should protect access to abortion services nationwide.', agree_direction: 1, display_order: 1 },
          { slug: 'restrict-funding', prompt: 'Public funding should not be used for abortion services.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'abortion-restrictions', label: 'Abortion Restrictions', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['planned-parenthood'], invert: true } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'limit-later-term', prompt: 'Abortion should be banned or sharply limited after a set point in pregnancy.', agree_direction: 1, display_order: 0 },
          { slug: 'states-set-limits', prompt: 'States should be free to set their own restrictions on abortion.', agree_direction: 1, display_order: 1 },
          { slug: 'no-restrictions', prompt: 'There should be no government restrictions on abortion.', agree_direction: -1, display_order: 2 } ] } ] },

  // === EXEMPLAR 2: gun-policy (2 stances) ===
  { slug: 'gun-policy', display_name: 'Gun Policy', description: 'Firearm rights and regulation.',
    value_tags: [], display_order: 8,
    lenses: [
      { slug: 'gun-rights', label: 'Gun Rights', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['nra'] } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'concealed-carry', prompt: 'Law-abiding citizens should be able to carry concealed firearms with minimal restriction.', agree_direction: 1, display_order: 0 },
          { slug: 'assault-ban', prompt: 'Civilian ownership of semi-automatic "assault-style" rifles should be banned.', agree_direction: -1, display_order: 1 },
          { slug: 'background-checks', prompt: 'All gun sales should require a universal background check.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'gun-control', label: 'Gun Control', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'scorecard', weight: 1.0, config: { orgs: ['nra'], invert: true } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'red-flag', prompt: 'Courts should be able to temporarily remove guns from people deemed a danger (red-flag laws).', agree_direction: 1, display_order: 0 },
          { slug: 'waiting-period', prompt: 'There should be a mandatory waiting period for gun purchases.', agree_direction: 1, display_order: 1 },
          { slug: 'no-new-laws', prompt: 'No new gun laws are needed.', agree_direction: -1, display_order: 2 } ] } ] },

  // === economy (2 stances) ===
  { slug: 'economy', display_name: 'Economy', description: 'Taxes, spending, regulation, and the role of government in markets.',
    value_tags: [], display_order: 9,
    lenses: [
      { slug: 'free-markets', label: 'Free Markets', lens_type: 'stance', display_order: 0,
        measurement_sources: [
          { type: 'scorecard', weight: 0.6, config: { orgs: ['us-chamber'] } },
          { type: 'bill-vote', weight: 0.4, config: { subjects: ['Taxation', 'Business investment and capital'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'cut-taxes', prompt: 'Lower taxes on businesses and individuals grow the economy.', agree_direction: 1, display_order: 0 },
          { slug: 'reduce-regulation', prompt: 'Less government regulation of business is generally better.', agree_direction: 1, display_order: 1 },
          { slug: 'raise-top-taxes', prompt: 'Taxes on high earners and corporations should be raised.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'economic-safety-net', label: 'Economic Safety Net', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Social welfare', 'Income tax credits'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'expand-safety-net', prompt: 'The government should spend more to support people who are struggling financially.', agree_direction: 1, display_order: 0 },
          { slug: 'public-investment', prompt: 'Major public investment in infrastructure and jobs is worth the cost.', agree_direction: 1, display_order: 1 },
          { slug: 'cut-spending', prompt: 'Government spending and the deficit should be cut, even if programs shrink.', agree_direction: -1, display_order: 2 } ] } ] },

  // === healthcare (2 stances) ===
  { slug: 'healthcare', display_name: 'Healthcare', description: 'Coverage, costs, and the government’s role in health care.',
    value_tags: ['pro-life'], display_order: 10,
    lenses: [
      { slug: 'public-coverage', label: 'Public Coverage', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Health care coverage and access', 'Medicare'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'expand-public-plan', prompt: 'The government should guarantee health coverage for everyone.', agree_direction: 1, display_order: 0 },
          { slug: 'protect-medicaid', prompt: 'Programs like Medicaid and Medicare should be expanded, not cut.', agree_direction: 1, display_order: 1 },
          { slug: 'repeal-aca', prompt: 'The Affordable Care Act should be repealed.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'market-healthcare', label: 'Market Healthcare', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Health care costs and insurance', 'Health programs administration and funding'], agree_position: 'no' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'private-competition', prompt: 'Competition among private insurers lowers health costs better than government plans.', agree_direction: 1, display_order: 0 },
          { slug: 'less-gov-healthcare', prompt: 'The government should have a smaller role in health care.', agree_direction: 1, display_order: 1 },
          { slug: 'single-payer', prompt: 'A single government-run health plan should replace private insurance.', agree_direction: -1, display_order: 2 } ] } ] },

  // === education (2 stances) ===
  { slug: 'education', display_name: 'Education', description: 'Public schools, funding, curriculum, and school choice.',
    value_tags: [], display_order: 11,
    lenses: [
      { slug: 'public-schools', label: 'Public Schools', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Elementary and secondary education', 'Educational facilities and institutions'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'fund-public-schools', prompt: 'Public schools should receive more federal funding.', agree_direction: 1, display_order: 0 },
          { slug: 'teacher-pay', prompt: 'Teacher pay and school staffing should be increased.', agree_direction: 1, display_order: 1 },
          { slug: 'cut-dept-ed', prompt: 'The federal Department of Education should be shrunk or eliminated.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'school-choice', label: 'School Choice', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Charter schools', 'Educational guidance'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'support-vouchers', prompt: 'Parents should be able to use public funds for private or charter schools.', agree_direction: 1, display_order: 0 },
          { slug: 'parental-control', prompt: 'Parents should have more say over curriculum and school materials.', agree_direction: 1, display_order: 1 },
          { slug: 'oppose-vouchers', prompt: 'Public money should stay in public schools, not vouchers.', agree_direction: -1, display_order: 2 } ] } ] },

  // === housing (2 stances) ===
  { slug: 'housing', display_name: 'Housing', description: 'Affordability, development, zoning, and homelessness.',
    value_tags: [], display_order: 12,
    lenses: [
      { slug: 'affordability-investment', label: 'Affordability Investment', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Housing and community development funding', 'Low- and moderate-income housing'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'fund-affordable-housing', prompt: 'The government should invest more in building affordable housing.', agree_direction: 1, display_order: 0 },
          { slug: 'rent-assistance', prompt: 'Rental assistance and tenant protections should be expanded.', agree_direction: 1, display_order: 1 },
          { slug: 'market-only-housing', prompt: 'Housing supply should be left mainly to the private market.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'development-and-supply', label: 'Development & Supply', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Housing finance and home ownership', 'Land use and conservation'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'ease-zoning', prompt: 'Zoning rules should be loosened to allow more homes to be built.', agree_direction: 1, display_order: 0 },
          { slug: 'speed-permits', prompt: 'Permitting for new housing should be faster and simpler.', agree_direction: 1, display_order: 1 },
          { slug: 'preserve-zoning', prompt: 'Local communities should keep tight control over what gets built.', agree_direction: -1, display_order: 2 } ] } ] },

  // === foreign-policy (2 stances) ===
  { slug: 'foreign-policy', display_name: 'Foreign Policy', description: 'Defense, alliances, trade, and America’s role abroad.',
    value_tags: [], display_order: 13,
    lenses: [
      { slug: 'global-engagement', label: 'Global Engagement', lens_type: 'stance', display_order: 0,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['International affairs', 'Foreign aid and international relief'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'support-allies', prompt: 'The U.S. should actively support its allies abroad, including with aid.', agree_direction: 1, display_order: 0 },
          { slug: 'value-alliances', prompt: 'International alliances and treaties make the country safer.', agree_direction: 1, display_order: 1 },
          { slug: 'less-foreign-aid', prompt: 'The U.S. should cut foreign aid and focus on problems at home.', agree_direction: -1, display_order: 2 } ] },
      { slug: 'military-strength', label: 'Military Strength', lens_type: 'stance', display_order: 1,
        measurement_sources: [ { type: 'bill-vote', weight: 1.0, config: { subjects: ['Military operations and strategy', 'Defense spending'], agree_position: 'yes' } } ],
        evidence_sources: [],
        quiz_questions: [
          { slug: 'raise-defense', prompt: 'Defense spending should be increased.', agree_direction: 1, display_order: 0 },
          { slug: 'project-strength', prompt: 'A strong, ready military is the best way to keep the country safe.', agree_direction: 1, display_order: 1 },
          { slug: 'cut-defense', prompt: 'Defense spending should be reduced.', agree_direction: -1, display_order: 2 } ] } ] },
]
