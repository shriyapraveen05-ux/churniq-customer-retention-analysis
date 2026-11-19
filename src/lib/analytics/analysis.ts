import type { ModelOutput } from './model'
import { CHARGE_BANDS, TENURE_GROUPS, TOTAL_BANDS, type PreparedData } from './pipeline'
import { buildInsights, buildRecommendations } from './recommendations'
import { ADDON_FILTERS, RISK_FILTERS, SEGMENTS, applyFilters, hasCategoricalFilters } from './segments'
import { RISK_THRESHOLDS } from './model'
import { chiSquare, mean, pearson, quantile, sortedCopy, sum, welchTTest } from './stats'
import type { Customer, Filters, RiskInfo } from './types'

export interface Prepared extends PreparedData {
  model: ModelOutput
  riskById: Map<string, RiskInfo>
  hash: string
}

const rate = (num: number, den: number) => (den ? num / den : 0)

export interface BreakdownRow {
  label: string
  customers: number
  churned: number
  retained: number
  churnRate: number
  share: number
  avgMonthly: number
  lostMRR: number
}

export function breakdown(list: Customer[], key: (c: Customer) => string, order?: string[]): BreakdownRow[] {
  const groups = new Map<string, Customer[]>()
  for (const c of list) {
    const k = key(c)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(c)
  }
  const rows = [...groups.entries()].map(([label, g]) => {
    const churned = g.filter((c) => c.churn).length
    return {
      label,
      customers: g.length,
      churned,
      retained: g.length - churned,
      churnRate: rate(churned, g.length),
      share: rate(g.length, list.length),
      avgMonthly: mean(g.map((c) => c.monthlyCharges)),
      lostMRR: sum(g.filter((c) => c.churn).map((c) => c.monthlyCharges)),
    }
  })
  if (order) return rows.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
  return rows.sort((a, b) => b.churnRate - a.churnRate)
}

const yesNo = (b: boolean) => (b ? 'Yes' : 'No')

export const DIMENSIONS: { key: string; label: string; get: (c: Customer) => string; order?: string[] }[] = [
  { key: 'contract', label: 'Contract type', get: (c) => c.contract, order: ['Month-to-month', 'One year', 'Two year'] },
  { key: 'tenureGroup', label: 'Tenure group', get: (c) => c.tenureGroup, order: TENURE_GROUPS },
  { key: 'chargeBand', label: 'Monthly charges', get: (c) => c.chargeBand, order: CHARGE_BANDS },
  { key: 'totalBand', label: 'Total charges', get: (c) => c.totalBand, order: TOTAL_BANDS },
  { key: 'paymentMethod', label: 'Payment method', get: (c) => c.paymentMethod },
  { key: 'internetService', label: 'Internet service', get: (c) => c.internetService },
  { key: 'techSupport', label: 'Tech support', get: (c) => c.techSupport },
  { key: 'onlineSecurity', label: 'Online security', get: (c) => c.onlineSecurity },
  { key: 'onlineBackup', label: 'Online backup', get: (c) => c.onlineBackup },
  { key: 'deviceProtection', label: 'Device protection', get: (c) => c.deviceProtection },
  { key: 'streamingTV', label: 'Streaming TV', get: (c) => c.streamingTV },
  { key: 'streamingMovies', label: 'Streaming movies', get: (c) => c.streamingMovies },
  { key: 'phoneService', label: 'Phone service', get: (c) => yesNo(c.phoneService) },
  { key: 'multipleLines', label: 'Multiple lines', get: (c) => c.multipleLines },
  { key: 'paperlessBilling', label: 'Paperless billing', get: (c) => yesNo(c.paperlessBilling) },
  { key: 'senior', label: 'Senior citizen', get: (c) => yesNo(c.senior) },
  { key: 'partner', label: 'Partner', get: (c) => yesNo(c.partner) },
  { key: 'dependents', label: 'Dependents', get: (c) => yesNo(c.dependents) },
  { key: 'gender', label: 'Gender', get: (c) => c.gender },
]

/** Kaplan–Meier estimate using tenure as duration and churn as the event (active customers are censored). */
export function kaplanMeier(list: Customer[], maxT: number) {
  const atTenure = new Array(maxT + 2).fill(0)
  const eventsAt = new Array(maxT + 2).fill(0)
  for (const c of list) {
    const t = Math.min(c.tenure, maxT)
    atTenure[t]++
    if (c.churn) eventsAt[t]++
  }
  let atRisk = list.length
  let s = 1
  const curve: { month: number; atRisk: number; events: number; hazard: number; survival: number }[] = []
  for (let t = 0; t <= maxT; t++) {
    const d = t === 0 ? 0 : eventsAt[t]
    const h = atRisk ? d / atRisk : 0
    s *= 1 - h
    curve.push({ month: t, atRisk, events: d, hazard: h, survival: s })
    atRisk -= atTenure[t]
  }
  const rmst = sum(curve.slice(0, maxT).map((p) => p.survival))
  return { curve, rmst }
}

function kpiSet(list: Customer[], riskById: Map<string, RiskInfo>) {
  const churned = list.filter((c) => c.churn)
  const active = list.filter((c) => !c.churn)
  const highRisk = active.filter((c) => riskById.get(c.id)?.category === 'High')
  return {
    totalCustomers: list.length,
    churnRate: rate(churned.length, list.length),
    retentionRate: rate(active.length, list.length),
    activeCustomers: active.length,
    churnedCustomers: churned.length,
    avgTenure: mean(list.map((c) => c.tenure)),
    avgMonthly: mean(list.map((c) => c.monthlyCharges)),
    revenueAtRisk: sum(highRisk.map((c) => c.monthlyCharges)),
  }
}

export type KpiSet = ReturnType<typeof kpiSet>

function histogram(list: Customer[], value: (c: Customer) => number, edges: number[], fmt: (lo: number, hi: number) => string) {
  const churned = list.filter((c) => c.churn)
  const retained = list.filter((c) => !c.churn)
  return edges.slice(0, -1).map((lo, i) => {
    const hi = edges[i + 1]
    const last = i === edges.length - 2
    const inBin = (c: Customer) => value(c) >= lo && (last ? value(c) <= hi : value(c) < hi)
    const r = retained.filter(inBin).length
    const ch = churned.filter(inBin).length
    return {
      bin: fmt(lo, hi),
      retained: rate(r, retained.length),
      churned: rate(ch, churned.length),
      retainedCount: r,
      churnedCount: ch,
      churnRate: rate(ch, r + ch),
    }
  })
}

function mix(list: Customer[], key: (c: Customer) => string) {
  const churned = list.filter((c) => c.churn)
  const retained = list.filter((c) => !c.churn)
  const labels = [...new Set(list.map(key))]
  return labels
    .map((label) => ({
      label,
      retained: rate(retained.filter((c) => key(c) === label).length, retained.length),
      churned: rate(churned.filter((c) => key(c) === label).length, churned.length),
    }))
    .sort((a, b) => b.churned - a.churned)
}

const MILESTONES = [1, 3, 6, 12, 18, 24, 36, 48, 60, 72]

function computeBase(p: Prepared, filters: Filters) {
  const { thresholds: t, riskById } = p
  const all = p.customers
  const list = applyFilters(all, filters, t)
  const maxT = t.maxTenure
  const isTenureFiltered = filters.tenureMin > 0 || filters.tenureMax < maxT
  const otherFilters = hasCategoricalFilters(filters)

  // Comparison set: previous acquisition window of equal length when a tenure window is selected
  let comparison: { label: string; kpis: KpiSet } | null = null
  if (isTenureFiltered) {
    const len = Math.min(filters.tenureMax, maxT) - filters.tenureMin + 1
    const prevMin = Math.min(filters.tenureMax, maxT) + 1
    const prevMax = prevMin + len - 1
    const prev = applyFilters(all, { ...filters, tenureMin: prevMin, tenureMax: prevMax }, t)
    if (prev.length >= 20)
      comparison = { label: `vs. customers with tenure ${prevMin}–${prevMax} mo`, kpis: kpiSet(prev, riskById) }
    else comparison = { label: 'vs. full portfolio', kpis: kpiSet(all, riskById) }
  } else if (otherFilters) comparison = { label: 'vs. full portfolio', kpis: kpiSet(all, riskById) }

  const empty = list.length === 0
  const kpis = kpiSet(list, riskById)
  const churned = list.filter((c) => c.churn)
  const retained = list.filter((c) => !c.churn)

  // Lifecycle (tenure-month) churn and survival
  const km = kaplanMeier(list, maxT)
  const lifecycle = km.curve.slice(1).map((pt) => ({
    month: pt.month,
    hazard: pt.hazard,
    survival: pt.survival,
    atRisk: pt.atRisk,
    events: pt.events,
  }))
  const lifecycleQuarterly: { label: string; churnRate: number; customers: number; churned: number }[] = []
  for (let q = 0; q < Math.ceil(maxT / 3); q++) {
    const lo = q * 3 + 1
    const hi = Math.min(maxT, q * 3 + 3)
    const pts = km.curve.filter((x) => x.month >= lo && x.month <= hi)
    const events = sum(pts.map((x) => x.events))
    const atRisk = sum(pts.map((x) => x.atRisk))
    lifecycleQuarterly.push({
      label: `M${lo}–${hi}`,
      churnRate: rate(events, atRisk),
      customers: list.filter((c) => c.tenure >= lo && c.tenure <= hi).length,
      churned: events,
    })
  }

  const breakdowns = Object.fromEntries(
    DIMENSIONS.map((d) => [d.key, { label: d.label, rows: breakdown(list, d.get, d.order) }]),
  ) as Record<string, { label: string; rows: BreakdownRow[] }>

  const internetCustomers = list.filter((c) => c.internetService !== 'No' && c.internetService !== 'Unknown')
  const serviceDefs: { service: string; base: Customer[]; has: (c: Customer) => boolean }[] = [
    { service: 'Online security', base: internetCustomers, has: (c) => c.onlineSecurity === 'Yes' },
    { service: 'Tech support', base: internetCustomers, has: (c) => c.techSupport === 'Yes' },
    { service: 'Online backup', base: internetCustomers, has: (c) => c.onlineBackup === 'Yes' },
    { service: 'Device protection', base: internetCustomers, has: (c) => c.deviceProtection === 'Yes' },
    { service: 'Streaming TV', base: internetCustomers, has: (c) => c.streamingTV === 'Yes' },
    { service: 'Streaming movies', base: internetCustomers, has: (c) => c.streamingMovies === 'Yes' },
    { service: 'Multiple lines', base: list.filter((c) => c.phoneService), has: (c) => c.multipleLines === 'Yes' },
    { service: 'Paperless billing', base: list, has: (c) => c.paperlessBilling },
  ]
  const services = serviceDefs.map(({ service, base, has }) => {
    const w = base.filter(has)
    const wo = base.filter((c) => !has(c))
    return {
      service,
      withRate: rate(w.filter((c) => c.churn).length, w.length),
      withoutRate: rate(wo.filter((c) => c.churn).length, wo.length),
      withCount: w.length,
      withoutCount: wo.length,
      adoption: rate(w.length, base.length),
    }
  })

  // Behaviour comparison
  const pctOf = (g: Customer[], f: (c: Customer) => boolean) => rate(g.filter(f).length, g.length)
  const profile = [
    { metric: 'Average tenure', unit: 'months', retained: mean(retained.map((c) => c.tenure)), churned: mean(churned.map((c) => c.tenure)) },
    { metric: 'Average monthly charges', unit: 'currency', retained: mean(retained.map((c) => c.monthlyCharges)), churned: mean(churned.map((c) => c.monthlyCharges)) },
    { metric: 'Average total charges', unit: 'currency', retained: mean(retained.map((c) => c.totalCharges)), churned: mean(churned.map((c) => c.totalCharges)) },
    { metric: 'Protective add-ons', unit: 'count', retained: mean(retained.map((c) => c.protectiveAddons)), churned: mean(churned.map((c) => c.protectiveAddons)) },
    { metric: 'Month-to-month contract', unit: 'percent', retained: pctOf(retained, (c) => c.contract === 'Month-to-month'), churned: pctOf(churned, (c) => c.contract === 'Month-to-month') },
    { metric: 'Electronic check payment', unit: 'percent', retained: pctOf(retained, (c) => c.paymentMethod === 'Electronic check'), churned: pctOf(churned, (c) => c.paymentMethod === 'Electronic check') },
    { metric: 'Fiber optic internet', unit: 'percent', retained: pctOf(retained, (c) => c.internetService === 'Fiber optic'), churned: pctOf(churned, (c) => c.internetService === 'Fiber optic') },
    { metric: 'Paperless billing', unit: 'percent', retained: pctOf(retained, (c) => c.paperlessBilling), churned: pctOf(churned, (c) => c.paperlessBilling) },
    { metric: 'Senior citizens', unit: 'percent', retained: pctOf(retained, (c) => c.senior), churned: pctOf(churned, (c) => c.senior) },
    { metric: 'Has partner', unit: 'percent', retained: pctOf(retained, (c) => c.partner), churned: pctOf(churned, (c) => c.partner) },
    { metric: 'Has dependents', unit: 'percent', retained: pctOf(retained, (c) => c.dependents), churned: pctOf(churned, (c) => c.dependents) },
  ]

  const tenureEdges = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72]
  const chargeEdges = [15, 25, 35, 45, 55, 65, 75, 85, 95, 105, 120]
  const coarseTenure = (c: Customer) => (c.tenure <= 12 ? 'Tenure ≤ 12 mo' : c.tenure <= 36 ? 'Tenure 13–36 mo' : 'Tenure > 36 mo')
  const comboDims: { name: string; get: (c: Customer) => string }[] = [
    { name: 'contract', get: (c) => c.contract },
    { name: 'internet', get: (c) => `${c.internetService} internet` },
    { name: 'payment', get: (c) => c.paymentMethod },
    { name: 'support', get: (c) => (c.techSupport === 'Yes' ? 'With tech support' : c.techSupport === 'No' ? 'No tech support' : 'No internet (support n/a)') },
    { name: 'tenure', get: coarseTenure },
    { name: 'senior', get: (c) => (c.senior ? 'Senior citizen' : 'Non-senior') },
  ]
  const minSize = Math.max(30, Math.round(list.length * 0.02))
  const combos: { group: string; customers: number; churnRate: number; lift: number }[] = []
  for (let i = 0; i < comboDims.length; i++)
    for (let j = i + 1; j < comboDims.length; j++) {
      const rows = breakdown(list, (c) => `${comboDims[i].get(c)} · ${comboDims[j].get(c)}`)
      for (const r of rows)
        if (r.customers >= minSize)
          combos.push({ group: r.label, customers: r.customers, churnRate: r.churnRate, lift: rate(r.churnRate, kpis.churnRate) })
    }
  combos.sort((a, b) => b.churnRate - a.churnRate)

  const behaviour = {
    profile,
    tenureHistogram: histogram(list, (c) => c.tenure, tenureEdges, (lo, hi) => `${lo}–${hi}`),
    chargeHistogram: histogram(list, (c) => c.monthlyCharges, chargeEdges, (lo, hi) => `$${lo}–${hi}`),
    contractMix: mix(list, (c) => c.contract),
    paymentMix: mix(list, (c) => c.paymentMethod),
    internetMix: mix(list, (c) => c.internetService),
    serviceAdoption: services.map((s) => {
      const def = serviceDefs.find((d) => d.service === s.service)!
      return {
        service: s.service,
        retained: pctOf(def.base.filter((c) => !c.churn), def.has),
        churned: pctOf(def.base.filter((c) => c.churn), def.has),
      }
    }),
    highChurnGroups: combos.slice(0, 8),
    lowChurnGroups: [...combos].sort((a, b) => a.churnRate - b.churnRate).slice(0, 4),
  }

  // Segments (computed within the filtered population)
  const segments = SEGMENTS.map((s) => {
    const g = list.filter((c) => s.test(c, t))
    const ch = g.filter((c) => c.churn).length
    const act = g.filter((c) => !c.churn)
    return {
      key: s.key,
      name: s.name,
      rule: s.rule(t),
      customers: g.length,
      share: rate(g.length, list.length),
      avgTenure: mean(g.map((c) => c.tenure)),
      avgMonthly: mean(g.map((c) => c.monthlyCharges)),
      churnRate: rate(ch, g.length),
      retentionRate: rate(g.length - ch, g.length),
      activeMRR: sum(act.map((c) => c.monthlyCharges)),
      lostMRR: sum(g.filter((c) => c.churn).map((c) => c.monthlyCharges)),
      highRiskMRR: sum(act.filter((c) => riskById.get(c.id)?.category === 'High').map((c) => c.monthlyCharges)),
      expectedLossMRR: sum(act.map((c) => (riskById.get(c.id)?.score ?? 0) * c.monthlyCharges)),
    }
  })

  // Correlation matrix
  const corrVars: { key: string; label: string; get: (c: Customer) => number }[] = [
    { key: 'churn', label: 'Churn', get: (c) => +c.churn },
    { key: 'tenure', label: 'Tenure', get: (c) => c.tenure },
    { key: 'monthly', label: 'Monthly charges', get: (c) => c.monthlyCharges },
    { key: 'total', label: 'Total charges', get: (c) => c.totalCharges },
    { key: 'm2m', label: 'Month-to-month', get: (c) => +(c.contract === 'Month-to-month') },
    { key: 'twoyear', label: 'Two-year contract', get: (c) => +(c.contract === 'Two year') },
    { key: 'fiber', label: 'Fiber optic', get: (c) => +(c.internetService === 'Fiber optic') },
    { key: 'echeck', label: 'Electronic check', get: (c) => +(c.paymentMethod === 'Electronic check') },
    { key: 'paperless', label: 'Paperless billing', get: (c) => +c.paperlessBilling },
    { key: 'support', label: 'Tech support', get: (c) => +(c.techSupport === 'Yes') },
    { key: 'security', label: 'Online security', get: (c) => +(c.onlineSecurity === 'Yes') },
    { key: 'addons', label: 'Protective add-ons', get: (c) => c.protectiveAddons },
    { key: 'senior', label: 'Senior citizen', get: (c) => +c.senior },
    { key: 'partner', label: 'Partner', get: (c) => +c.partner },
    { key: 'dependents', label: 'Dependents', get: (c) => +c.dependents },
  ]
  const cols = corrVars.map((v) => list.map(v.get))
  const correlation = {
    variables: corrVars.map((v) => v.label),
    matrix: cols.map((a) => cols.map((b) => pearson(a, b))),
  }

  // Statistical tests
  const numericTests = (
    [
      ['Tenure (months)', (c: Customer) => c.tenure],
      ['Monthly charges', (c: Customer) => c.monthlyCharges],
      ['Total charges', (c: Customer) => c.totalCharges],
      ['Protective add-ons', (c: Customer) => c.protectiveAddons],
      ['Subscribed services', (c: Customer) => c.serviceCount],
    ] as const
  ).map(([variable, f]) => {
    const a = churned.map(f)
    const b = retained.map(f)
    const test = churned.length > 1 && retained.length > 1 ? welchTTest(a, b) : { t: 0, df: 0, p: 1, cohensD: 0 }
    return { variable, churnedMean: mean(a), retainedMean: mean(b), ...test }
  })
  const categoricalTests = DIMENSIONS.filter((d) => !['tenureGroup', 'chargeBand', 'totalBand'].includes(d.key))
    .map((d) => {
      const rows = breakdown(list, d.get)
      const test = chiSquare(rows)
      return {
        variable: d.label,
        ...test,
        highest: rows[0] ? { label: rows[0].label, churnRate: rows[0].churnRate } : null,
        lowest: rows.length ? { label: rows[rows.length - 1].label, churnRate: rows[rows.length - 1].churnRate } : null,
      }
    })
    .sort((a, b) => b.cramersV - a.cramersV)

  // Risk (active customers only)
  const activeRisk = retained.map((c) => ({ c, r: riskById.get(c.id)! }))
  const byCat = (cat: string) => activeRisk.filter((x) => x.r.category === cat)
  const riskCounts = (['High', 'Medium', 'Low'] as const).map((category) => {
    const g = byCat(category)
    return { category, customers: g.length, mrr: sum(g.map((x) => x.c.monthlyCharges)), share: rate(g.length, activeRisk.length) }
  })
  const riskHistogram = Array.from({ length: 10 }, (_, i) => {
    const lo = i / 10
    const hi = (i + 1) / 10
    const n = activeRisk.filter((x) => x.r.score >= lo && (i === 9 ? x.r.score <= hi : x.r.score < hi)).length
    return { bin: `${Math.round(lo * 100)}–${Math.round(hi * 100)}%`, customers: n, lo }
  })
  const factorCounts = new Map<string, number>()
  for (const x of activeRisk)
    if (x.r.category !== 'Low')
      for (const f of x.r.factors) {
        const generic = f.label.replace(/\s*\(.*\)$/, '')
        factorCounts.set(generic, (factorCounts.get(generic) ?? 0) + 1)
      }
  const atRiskCount = activeRisk.filter((x) => x.r.category !== 'Low').length
  const riskFactors = [...factorCounts.entries()]
    .map(([factor, customers]) => ({ factor, customers, share: rate(customers, atRiskCount) }))
    .sort((a, b) => b.customers - a.customers)
    .slice(0, 8)
  const riskByContract = breakdown(retained, (c) => c.contract, ['Month-to-month', 'One year', 'Two year']).map((row) => {
    const g = activeRisk.filter((x) => x.c.contract === row.label)
    return {
      label: row.label,
      High: g.filter((x) => x.r.category === 'High').length,
      Medium: g.filter((x) => x.r.category === 'Medium').length,
      Low: g.filter((x) => x.r.category === 'Low').length,
    }
  })

  // Revenue
  const activeMRR = sum(retained.map((c) => c.monthlyCharges))
  const lostMRR = sum(churned.map((c) => c.monthlyCharges))
  const arpu = mean(retained.map((c) => c.monthlyCharges))
  const kmAll = km
  const revenue = {
    definitions: [
      { metric: 'Active monthly revenue (MRR)', formula: 'Σ MonthlyCharges of customers with Churn = No', kind: 'actual' },
      { metric: 'Monthly revenue lost to churn', formula: 'Σ MonthlyCharges of customers with Churn = Yes — revenue already lost in the observation month', kind: 'actual' },
      { metric: 'Revenue at risk', formula: 'Σ MonthlyCharges of active customers in the High risk category (score ≥ 70%) — potential future exposure, not a loss yet', kind: 'estimate' },
      { metric: 'Expected monthly loss', formula: 'Σ (risk score × MonthlyCharges) over active customers — probability-weighted estimate', kind: 'estimate' },
      { metric: 'ARPU', formula: 'Mean MonthlyCharges of active customers', kind: 'actual' },
      { metric: 'Estimated customer lifetime value', formula: 'ARPU × restricted mean survival time (Kaplan–Meier, months)', kind: 'estimate' },
      { metric: 'Historical billed revenue', formula: 'Σ TotalCharges — cumulative billing to date, not a monthly history', kind: 'actual' },
    ],
    activeMRR,
    lostMRR,
    lostShare: rate(lostMRR, activeMRR + lostMRR),
    highRiskMRR: riskCounts[0].mrr,
    expectedLossMRR: sum(activeRisk.map((x) => x.r.score * x.c.monthlyCharges)),
    arpu,
    avgMonthly: kpis.avgMonthly,
    historicalBilled: sum(list.map((c) => c.totalCharges)),
    churnedLifetimeBilled: sum(churned.map((c) => c.totalCharges)),
    rmstMonths: kmAll.rmst,
    estimatedCLV: arpu * kmAll.rmst,
    byContract: breakdown(list, (c) => c.contract, ['Month-to-month', 'One year', 'Two year']).map((r) => {
      const g = list.filter((c) => c.contract === r.label)
      const act = g.filter((c) => !c.churn)
      return {
        contract: r.label,
        customers: r.customers,
        activeMRR: sum(act.map((c) => c.monthlyCharges)),
        lostMRR: r.lostMRR,
        churnRate: r.churnRate,
        avgMonthlyRetained: mean(act.map((c) => c.monthlyCharges)),
        avgMonthlyChurned: mean(g.filter((c) => c.churn).map((c) => c.monthlyCharges)),
        historicalBilled: sum(g.map((c) => c.totalCharges)),
      }
    }),
    lostByTenure: breakdown(list, (c) => c.tenureGroup, TENURE_GROUPS).map((r) => ({ label: r.label, lostMRR: r.lostMRR, churned: r.churned })),
    lostByCharge: breakdown(list, (c) => c.chargeBand, CHARGE_BANDS).map((r) => ({ label: r.label, lostMRR: r.lostMRR, churnRate: r.churnRate })),
    chargeQuartiles: (['Retained', 'Churned'] as const).map((status) => {
      const s = sortedCopy((status === 'Churned' ? churned : retained).map((c) => c.monthlyCharges))
      return { status, min: s[0] ?? 0, q1: quantile(s, 0.25), median: quantile(s, 0.5), q3: quantile(s, 0.75), max: s[s.length - 1] ?? 0, mean: mean(s) }
    }),
    quadrants: (() => {
      const quads = [
        { name: 'Loyal high-value', desc: `≥ $${t.monthlyMedian.toFixed(0)}/mo · tenure ≥ 24 mo`, test: (c: Customer) => c.monthlyCharges >= t.monthlyMedian && c.tenure >= 24 },
        { name: 'New high-value', desc: `≥ $${t.monthlyMedian.toFixed(0)}/mo · tenure < 24 mo`, test: (c: Customer) => c.monthlyCharges >= t.monthlyMedian && c.tenure < 24 },
        { name: 'Loyal low-spend', desc: `< $${t.monthlyMedian.toFixed(0)}/mo · tenure ≥ 24 mo`, test: (c: Customer) => c.monthlyCharges < t.monthlyMedian && c.tenure >= 24 },
        { name: 'New low-spend', desc: `< $${t.monthlyMedian.toFixed(0)}/mo · tenure < 24 mo`, test: (c: Customer) => c.monthlyCharges < t.monthlyMedian && c.tenure < 24 },
      ]
      return quads.map((q) => {
        const g = list.filter(q.test)
        return {
          name: q.name,
          desc: q.desc,
          customers: g.length,
          churnRate: rate(g.filter((c) => c.churn).length, g.length),
          activeMRR: sum(g.filter((c) => !c.churn).map((c) => c.monthlyCharges)),
          lostMRR: sum(g.filter((c) => c.churn).map((c) => c.monthlyCharges)),
        }
      })
    })(),
    scatter: (() => {
      const step = Math.max(1, Math.floor(list.length / 700))
      return list.filter((_, i) => i % step === 0).map((c) => ({ tenure: c.tenure, monthly: c.monthlyCharges, churn: c.churn }))
    })(),
  }

  // Cohorts / survival
  const cohortDims: { key: string; label: string; get: (c: Customer) => string }[] = [
    { key: 'contract', label: 'Contract type', get: (c) => c.contract },
    { key: 'internet', label: 'Internet service', get: (c) => c.internetService },
    { key: 'payment', label: 'Payment method', get: (c) => c.paymentMethod },
    { key: 'support', label: 'Tech support', get: (c) => (c.techSupport === 'Yes' ? 'Has tech support' : c.techSupport === 'No' ? 'No tech support' : 'No internet service') },
    { key: 'senior', label: 'Senior citizen', get: (c) => (c.senior ? 'Senior' : 'Non-senior') },
  ]
  const cohorts = {
    methodology:
      'Groups are built from tenure (months since sign-up at the snapshot date) and survival is estimated with Kaplan–Meier, treating churn as the event and active customers as censored.',
    limitation:
      'The IBM Telco dataset is a single snapshot: it has no acquisition dates, churn dates or monthly status history. These are tenure bands, not true time-based acquisition cohorts, and no month-by-month retention history is shown. True cohorts would need each customer’s sign-up date, churn date and monthly active/churned snapshots.',
    milestones: MILESTONES.filter((m) => m <= maxT),
    overall: km.curve.map((x) => x.survival),
    rmst: km.rmst,
    dimensions: cohortDims.map((d) => ({
      key: d.key,
      label: d.label,
      groups: [...new Set(list.map(d.get))]
        .map((name) => {
          const g = list.filter((c) => d.get(c) === name)
          const k = kaplanMeier(g, maxT)
          return { name, customers: g.length, survival: k.curve.map((x) => x.survival), rmst: k.rmst }
        })
        .filter((g) => g.customers >= 20)
        .sort((a, b) => b.rmst - a.rmst),
    })),
    acquisition: Array.from({ length: Math.ceil((maxT + 1) / 6) }, (_, i) => {
      const lo = i * 6
      const hi = Math.min(maxT, lo + 5)
      const g = list.filter((c) => c.tenure >= lo && c.tenure <= hi)
      return {
        label: `Tenure ${lo}–${hi} mo`,
        customers: g.length,
        active: g.filter((c) => !c.churn).length,
        churned: g.filter((c) => c.churn).length,
        churnRate: rate(g.filter((c) => c.churn).length, g.length),
        avgMonthly: mean(g.map((c) => c.monthlyCharges)),
      }
    }).filter((r) => r.customers > 0),
  }

  const segmentCheck = SEGMENTS.every((s) => {
    const seg = segments.find((x) => x.key === s.key)!
    return seg.customers === list.filter((c) => s.test(c, t)).length
  })
  const validation = [
    { check: 'Active + churned = total customers', passed: kpis.activeCustomers + kpis.churnedCustomers === kpis.totalCustomers, detail: `${kpis.activeCustomers} + ${kpis.churnedCustomers} = ${kpis.totalCustomers}` },
    { check: 'Churn rate = churned ÷ total', passed: Math.abs(kpis.churnRate - rate(kpis.churnedCustomers, kpis.totalCustomers)) < 1e-12, detail: `${kpis.churnedCustomers} ÷ ${kpis.totalCustomers}` },
    { check: 'Retention rate = 1 − churn rate', passed: list.length === 0 || Math.abs(kpis.retentionRate + kpis.churnRate - 1) < 1e-12, detail: 'Both rates share the same denominator' },
    { check: 'Segment sizes match their rules', passed: segmentCheck, detail: 'Each segment re-counted directly from its rule' },
    { check: 'Lost revenue uses churned customers only', passed: Math.abs(lostMRR - sum(churned.map((c) => c.monthlyCharges))) < 1e-6, detail: `${churned.length} churned records` },
    { check: 'Revenue at risk uses active High-risk customers only', passed: Math.abs(riskCounts[0].mrr - sum(retained.filter((c) => c.riskCategory === 'High').map((c) => c.monthlyCharges))) < 1e-6 && Math.abs(kpis.revenueAtRisk - riskCounts[0].mrr) < 1e-6, detail: `${riskCounts[0].customers} active High-risk customers` },
    { check: 'Risk categories follow the score thresholds', passed: activeRisk.every((x) => x.r.category === (x.r.score >= RISK_THRESHOLDS.high ? 'High' : x.r.score >= RISK_THRESHOLDS.medium ? 'Medium' : 'Low')), detail: `High ≥ ${RISK_THRESHOLDS.high * 100}%, Medium ≥ ${RISK_THRESHOLDS.medium * 100}%` },
  ]

  const base = {
    validation,
    filters,
    empty,
    population: list.length,
    portfolioSize: all.length,
    churnedCount: churned.length,
    kpis,
    comparison,
    lifecycle,
    lifecycleQuarterly,
    breakdowns,
    services,
    behaviour,
    segments,
    correlation,
    numericTests,
    categoricalTests,
    risk: {
      method: p.model.evaluation.method,
      thresholds: RISK_THRESHOLDS,
      counts: riskCounts,
      histogram: riskHistogram,
      factors: riskFactors,
      byContract: riskByContract,
    },
    revenue,
    cohorts,
    model: p.model.evaluation,
  }
  return { base, list }
}

export type AnalysisBase = ReturnType<typeof computeBase>['base']

export function buildAnalysis(p: Prepared, filters: Filters) {
  const { base, list } = computeBase(p, filters)
  const t = p.thresholds
  const all = p.customers
  const maxT = t.maxTenure
  return {
    ...base,
    insights: buildInsights(base),
    recommendations: buildRecommendations(base, list, t),
    report: p.report,
    thresholds: t,
    segmentDefs: SEGMENTS.map((s) => ({ key: s.key, name: s.name, rule: s.rule(t) })),
    options: {
      contracts: [...new Set(all.map((c) => c.contract))].sort(),
      internet: [...new Set(all.map((c) => c.internetService))].sort(),
      payments: [...new Set(all.map((c) => c.paymentMethod))].sort(),
      addons: ADDON_FILTERS.map((a) => ({ key: a.key, label: a.label })),
      risks: RISK_FILTERS,
      maxTenure: maxT,
    },
    datasetHash: p.hash,
  }
}

export type Analysis = ReturnType<typeof buildAnalysis>
