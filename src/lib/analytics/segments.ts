import type { AddonKey, Customer, Filters, RiskCategory, SegmentKey, Thresholds } from './types'

export interface SegmentDef {
  key: SegmentKey
  name: string
  rule: (t: Thresholds) => string
  test: (c: Customer, t: Thresholds) => boolean
}

const money = (n: number) => `$${n.toFixed(2)}`

export const SEGMENTS: SegmentDef[] = [
  {
    key: 'new',
    name: 'New Customers',
    rule: () => 'Tenure ≤ 12 months',
    test: (c) => c.tenure <= 12,
  },
  {
    key: 'long_term',
    name: 'Long-Term Customers',
    rule: () => 'Tenure ≥ 48 months',
    test: (c) => c.tenure >= 48,
  },
  {
    key: 'high_value',
    name: 'High-Value Customers',
    rule: (t) => `Monthly charges ≥ ${money(t.monthlyP75)} (top quartile of the dataset)`,
    test: (c, t) => c.monthlyCharges >= t.monthlyP75,
  },
  {
    key: 'month_to_month',
    name: 'Month-to-Month Customers',
    rule: () => 'Contract = Month-to-month',
    test: (c) => c.contract === 'Month-to-month',
  },
  {
    key: 'price_sensitive',
    name: 'Price-Sensitive Customers',
    rule: (t) =>
      `Monthly charges above the median (${money(t.monthlyMedian)}), month-to-month contract and ≤ 1 protective add-on`,
    test: (c, t) => c.monthlyCharges > t.monthlyMedian && c.contract === 'Month-to-month' && c.protectiveAddons <= 1,
  },
  {
    key: 'high_risk',
    name: 'High-Churn-Risk Customers',
    rule: () => 'Still active (Churn = No) and risk score ≥ 70% (High risk category)',
    test: (c) => !c.churn && c.riskCategory === 'High',
  },
  {
    key: 'recently_churned',
    name: 'Recently Churned Customers',
    rule: () => 'Churn = Yes (left within the dataset’s observation month)',
    test: (c) => c.churn,
  },
]

export const ADDON_FILTERS: { key: AddonKey; label: string; test: (c: Customer) => boolean }[] = [
  { key: 'online_security', label: 'Has online security', test: (c) => c.onlineSecurity === 'Yes' },
  { key: 'tech_support', label: 'Has tech support', test: (c) => c.techSupport === 'Yes' },
  { key: 'online_backup', label: 'Has online backup', test: (c) => c.onlineBackup === 'Yes' },
  { key: 'device_protection', label: 'Has device protection', test: (c) => c.deviceProtection === 'Yes' },
  { key: 'streaming', label: 'Streams TV or movies', test: (c) => c.streamingTV === 'Yes' || c.streamingMovies === 'Yes' },
  {
    key: 'phone_only',
    label: 'Phone only (no internet)',
    test: (c) => c.phoneService && c.internetService === 'No',
  },
  {
    key: 'no_addons',
    label: 'Internet, no protective add-ons',
    test: (c) => c.internetService !== 'No' && c.internetService !== 'Unknown' && c.protectiveAddons === 0,
  },
]

export const RISK_FILTERS: RiskCategory[] = ['High', 'Medium', 'Low']

export function segmentsOf(c: Customer, t: Thresholds): SegmentKey[] {
  return SEGMENTS.filter((s) => s.test(c, t)).map((s) => s.key)
}

export function applyFilters(customers: Customer[], f: Filters, t: Thresholds): Customer[] {
  const seg = f.segment === 'all' ? null : SEGMENTS.find((s) => s.key === f.segment)
  const addon = f.addon === 'all' ? null : ADDON_FILTERS.find((a) => a.key === f.addon)
  return customers.filter(
    (c) =>
      c.tenure >= f.tenureMin &&
      c.tenure <= f.tenureMax &&
      (f.contract === 'all' || c.contract === f.contract) &&
      (f.internet === 'all' || c.internetService === f.internet) &&
      (f.payment === 'all' || c.paymentMethod === f.payment) &&
      (!addon || addon.test(c)) &&
      (f.risk === 'all' || c.riskCategory === f.risk) &&
      (!seg || seg.test(c, t)),
  )
}

/** True when any non-tenure filter is active. */
export function hasCategoricalFilters(f: Filters): boolean {
  return (
    f.contract !== 'all' ||
    f.internet !== 'all' ||
    f.payment !== 'all' ||
    f.addon !== 'all' ||
    f.risk !== 'all' ||
    f.segment !== 'all'
  )
}

export function parseFilters(input: Record<string, unknown>): Filters {
  const num = (v: unknown, d: number) => {
    if (v === undefined || v === null || v === '') return d
    const n = Number(v)
    return Number.isFinite(n) ? n : d
  }
  const str = (v: unknown) => (typeof v === 'string' && v.length ? v : 'all')
  const segment = str(input.segment)
  const addon = str(input.addon)
  const risk = str(input.risk)
  return {
    tenureMin: Math.max(0, num(input.tenureMin ?? input.tenure_min, 0)),
    tenureMax: Math.min(1000, num(input.tenureMax ?? input.tenure_max, 1000)),
    contract: str(input.contract),
    internet: str(input.internet),
    payment: str(input.payment),
    addon: (ADDON_FILTERS.some((a) => a.key === addon) ? addon : 'all') as Filters['addon'],
    risk: (RISK_FILTERS.includes(risk as RiskCategory) ? risk : 'all') as Filters['risk'],
    segment: (SEGMENTS.some((s) => s.key === segment) ? segment : 'all') as Filters['segment'],
  }
}
