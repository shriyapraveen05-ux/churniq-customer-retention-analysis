import type { AnalysisBase } from './analysis'
import type { Customer, Thresholds } from './types'

const pct = (v: number) => `${(v * 100).toFixed(1)}%`
const usd = (v: number) => `$${Math.round(v).toLocaleString('en-US')}`

export interface Insight {
  title: string
  detail: string
  tone: 'negative' | 'positive' | 'warning' | 'neutral'
  metric?: string
}

export interface Recommendation {
  id: string
  title: string
  problem: string
  finding: string
  segment: string
  action: string
  priority: 'High' | 'Medium' | 'Low'
  impact: string
  evidence: { label: string; value: string }[]
  targetCustomers: number
  targetMRR: number
  lift: number
}

function groupStats(list: Customer[], test: (c: Customer) => boolean) {
  const g = list.filter(test)
  const churned = g.filter((c) => c.churn).length
  const active = g.filter((c) => !c.churn)
  return {
    n: g.length,
    churnRate: g.length ? churned / g.length : 0,
    active: active.length,
    activeMRR: active.reduce((s, c) => s + c.monthlyCharges, 0),
  }
}

export function buildInsights(a: AnalysisBase): Insight[] {
  if (a.empty) return []
  const insights: Insight[] = []
  const contract = a.breakdowns.contract.rows
  const m2m = contract.find((r) => r.label === 'Month-to-month')
  const twoYear = contract.find((r) => r.label === 'Two year')
  if (m2m && twoYear && twoYear.churnRate > 0)
    insights.push({
      title: 'Contract length is the strongest churn signal',
      detail: `Month-to-month customers churn at ${pct(m2m.churnRate)} versus ${pct(twoYear.churnRate)} on two-year contracts — ${(m2m.churnRate / twoYear.churnRate).toFixed(1)}× higher. They represent ${pct(m2m.share)} of customers.`,
      tone: 'negative',
      metric: pct(m2m.churnRate),
    })
  const tg = a.breakdowns.tenureGroup.rows
  if (tg.length > 1) {
    const first = tg[0]
    const last = tg[tg.length - 1]
    insights.push({
      title: 'Churn is concentrated early in the lifecycle',
      detail: `Customers in their first 6 months churn at ${pct(first.churnRate)}, falling to ${pct(last.churnRate)} for customers with ${last.label} of tenure. Average tenure of churned customers is ${a.behaviour.profile[0].churned.toFixed(1)} months versus ${a.behaviour.profile[0].retained.toFixed(1)} for retained.`,
      tone: 'warning',
      metric: pct(first.churnRate),
    })
  }
  const pay = a.breakdowns.paymentMethod.rows
  if (pay.length > 1)
    insights.push({
      title: `${pay[0].label} customers churn most`,
      detail: `${pay[0].label} has a ${pct(pay[0].churnRate)} churn rate, compared with ${pct(pay[pay.length - 1].churnRate)} for ${pay[pay.length - 1].label}.`,
      tone: 'warning',
      metric: pct(pay[0].churnRate),
    })
  const sup = a.services.find((s) => s.service === 'Tech support')
  if (sup && sup.withCount > 20 && sup.withoutCount > 20)
    insights.push({
      title: 'Protective add-ons are associated with retention',
      detail: `Internet customers without tech support churn at ${pct(sup.withoutRate)} versus ${pct(sup.withRate)} with it. This is an association — customers who buy add-ons may differ in other ways.`,
      tone: 'positive',
      metric: pct(sup.withRate),
    })
  insights.push({
    title: 'Revenue exposure',
    detail: `Churned customers represented ${usd(a.revenue.lostMRR)} in monthly recurring revenue (${pct(a.revenue.lostShare)} of total MRR). A further ${usd(a.revenue.highRiskMRR)} MRR sits with active customers classified as high risk.`,
    tone: 'negative',
    metric: usd(a.revenue.lostMRR),
  })
  const top = a.categoricalTests[0]
  if (top && top.p < 0.05)
    insights.push({
      title: `Strongest categorical association: ${top.variable}`,
      detail: `Chi-square test shows a statistically significant association with churn (Cramér’s V = ${top.cramersV.toFixed(2)}). Highest churn: ${top.highest?.label} (${pct(top.highest?.churnRate ?? 0)}).`,
      tone: 'neutral',
      metric: `V=${top.cramersV.toFixed(2)}`,
    })
  return insights
}

export function buildRecommendations(a: AnalysisBase, list: Customer[], t: Thresholds): Recommendation[] {
  if (a.empty || a.churnedCount < 5) return []
  const overall = a.kpis.churnRate
  const recs: Recommendation[] = []
  const scenario = (g: { churnRate: number; activeMRR: number }) =>
    `Scenario: a 10% relative reduction in this group's churn rate would protect ≈ ${usd(
      0.1 * g.churnRate * g.activeMRR,
    )} MRR per month (illustrative assumption, not a forecast).`

  const add = (
    r: Omit<Recommendation, 'priority' | 'impact' | 'targetCustomers' | 'targetMRR' | 'lift'>,
    target: ReturnType<typeof groupStats>,
    comparisonRate: number,
  ) => {
    const lift = comparisonRate > 0 ? target.churnRate / comparisonRate : target.churnRate > 0 ? 9 : 1
    if (target.n < 30 || lift < 1.2) return
    const mrrShare = a.revenue.activeMRR ? target.activeMRR / a.revenue.activeMRR : 0
    const priority: Recommendation['priority'] =
      lift >= 2.5 && mrrShare >= 0.3 ? 'High' : lift >= 1.5 ? 'Medium' : 'Low'
    recs.push({ ...r, priority, impact: scenario(target), targetCustomers: target.active, targetMRR: target.activeMRR, lift })
  }

  const m2m = groupStats(list, (c) => c.contract === 'Month-to-month')
  const longC = groupStats(list, (c) => c.contract !== 'Month-to-month')
  add(
    {
      id: 'contract',
      title: 'Convert month-to-month customers to longer contracts',
      problem: 'Customers without a contract commitment leave at a far higher rate.',
      finding: `Month-to-month churn is ${pct(m2m.churnRate)} vs ${pct(longC.churnRate)} for one- and two-year contracts.`,
      segment: `Month-to-month customers (${m2m.active.toLocaleString()} active)`,
      action: 'Offer tiered discounts or bundled add-ons for upgrading to a 12-month contract, timed before the 3rd and 6th billing cycles.',
      evidence: [
        { label: 'M2M churn', value: pct(m2m.churnRate) },
        { label: 'Contracted churn', value: pct(longC.churnRate) },
        { label: 'Active MRR', value: usd(m2m.activeMRR) },
      ],
    },
    m2m,
    longC.churnRate,
  )

  const early = groupStats(list, (c) => c.tenure <= 12)
  const mature = groupStats(list, (c) => c.tenure > 12)
  add(
    {
      id: 'onboarding',
      title: 'Strengthen the first-year customer experience',
      problem: 'A disproportionate share of churn happens in the first 12 months.',
      finding: `Customers with ≤ 12 months tenure churn at ${pct(early.churnRate)} vs ${pct(mature.churnRate)} after their first year.`,
      segment: `New customers, tenure ≤ 12 months (${early.active.toLocaleString()} active)`,
      action: 'Launch a structured onboarding journey: welcome call, 30/60/90-day check-ins, proactive usage tips and an early-tenure loyalty credit.',
      evidence: [
        { label: '≤ 12 mo churn', value: pct(early.churnRate) },
        { label: '> 12 mo churn', value: pct(mature.churnRate) },
        { label: 'Active MRR', value: usd(early.activeMRR) },
      ],
    },
    early,
    mature.churnRate,
  )

  const echeck = groupStats(list, (c) => c.paymentMethod === 'Electronic check')
  const auto = groupStats(list, (c) => c.paymentMethod.includes('automatic'))
  add(
    {
      id: 'autopay',
      title: 'Move electronic-check payers to automatic payment',
      problem: 'Manual payment methods are associated with higher churn.',
      finding: `Electronic check payers churn at ${pct(echeck.churnRate)} vs ${pct(auto.churnRate)} for automatic bank transfer / credit card.`,
      segment: `Electronic check payers (${echeck.active.toLocaleString()} active)`,
      action: 'Offer a small monthly credit for enrolling in autopay and simplify the payment-method switch flow.',
      evidence: [
        { label: 'E-check churn', value: pct(echeck.churnRate) },
        { label: 'Autopay churn', value: pct(auto.churnRate) },
        { label: 'Active MRR', value: usd(echeck.activeMRR) },
      ],
    },
    echeck,
    auto.churnRate,
  )

  const noSupport = groupStats(list, (c) => c.techSupport === 'No')
  const support = groupStats(list, (c) => c.techSupport === 'Yes')
  add(
    {
      id: 'support',
      title: 'Improve technical support reach for internet customers',
      problem: 'Internet customers without tech support churn more often.',
      finding: `Churn is ${pct(noSupport.churnRate)} without tech support vs ${pct(support.churnRate)} with it (association, not proven causation).`,
      segment: `Internet customers without tech support (${noSupport.active.toLocaleString()} active)`,
      action: 'Pilot a free 3-month tech support trial with a randomised control group to measure the true retention effect.',
      evidence: [
        { label: 'No support churn', value: pct(noSupport.churnRate) },
        { label: 'With support churn', value: pct(support.churnRate) },
        { label: 'Active MRR', value: usd(noSupport.activeMRR) },
      ],
    },
    noSupport,
    support.churnRate,
  )

  const noSec = groupStats(list, (c) => c.onlineSecurity === 'No')
  const sec = groupStats(list, (c) => c.onlineSecurity === 'Yes')
  add(
    {
      id: 'security',
      title: 'Bundle online security into internet plans',
      problem: 'Customers without online security show elevated churn.',
      finding: `Churn is ${pct(noSec.churnRate)} without online security vs ${pct(sec.churnRate)} with it.`,
      segment: `Internet customers without online security (${noSec.active.toLocaleString()} active)`,
      action: 'Include online security in mid-tier bundles and highlight its value at onboarding and renewal.',
      evidence: [
        { label: 'No security churn', value: pct(noSec.churnRate) },
        { label: 'With security churn', value: pct(sec.churnRate) },
        { label: 'Active MRR', value: usd(noSec.activeMRR) },
      ],
    },
    noSec,
    sec.churnRate,
  )

  const fiber = groupStats(list, (c) => c.internetService === 'Fiber optic')
  const dsl = groupStats(list, (c) => c.internetService === 'DSL')
  add(
    {
      id: 'fiber',
      title: 'Investigate the fiber optic experience and price point',
      problem: 'The premium internet product has the highest churn.',
      finding: `Fiber optic customers churn at ${pct(fiber.churnRate)} vs ${pct(dsl.churnRate)} for DSL, despite paying more per month.`,
      segment: `Fiber optic customers (${fiber.active.toLocaleString()} active)`,
      action: 'Run exit-survey and network-quality analysis for fiber users; test price-match or speed-tier right-sizing offers.',
      evidence: [
        { label: 'Fiber churn', value: pct(fiber.churnRate) },
        { label: 'DSL churn', value: pct(dsl.churnRate) },
        { label: 'Active MRR', value: usd(fiber.activeMRR) },
      ],
    },
    fiber,
    dsl.churnRate,
  )

  const highCharge = groupStats(list, (c) => c.monthlyCharges >= t.monthlyP75 && c.contract === 'Month-to-month')
  const rest = groupStats(list, (c) => !(c.monthlyCharges >= t.monthlyP75 && c.contract === 'Month-to-month'))
  add(
    {
      id: 'pricing',
      title: 'Address pricing concerns for high-bill, uncommitted customers',
      problem: 'High monthly bills without a contract are associated with elevated churn.',
      finding: `Month-to-month customers paying ≥ $${t.monthlyP75.toFixed(0)}/month churn at ${pct(highCharge.churnRate)} vs ${pct(rest.churnRate)} for all other customers.`,
      segment: `High-bill month-to-month customers (${highCharge.active.toLocaleString()} active)`,
      action: 'Proactively review plan fit, offer loyalty pricing for committing to a contract, and surface the value of included services on each bill.',
      evidence: [
        { label: 'Group churn', value: pct(highCharge.churnRate) },
        { label: 'Others churn', value: pct(rest.churnRate) },
        { label: 'Active MRR', value: usd(highCharge.activeMRR) },
      ],
    },
    highCharge,
    rest.churnRate,
  )

  const senior = groupStats(list, (c) => c.senior)
  const nonSenior = groupStats(list, (c) => !c.senior)
  add(
    {
      id: 'senior',
      title: 'Offer assisted service for senior customers',
      problem: 'Senior citizens churn at a higher rate.',
      finding: `Senior customers churn at ${pct(senior.churnRate)} vs ${pct(nonSenior.churnRate)} for non-senior customers.`,
      segment: `Senior citizens (${senior.active.toLocaleString()} active)`,
      action: 'Provide a dedicated assisted-support line and simplified plan options; review whether senior customers are over-indexed on manual payment.',
      evidence: [
        { label: 'Senior churn', value: pct(senior.churnRate) },
        { label: 'Non-senior churn', value: pct(nonSenior.churnRate) },
        { label: 'Active MRR', value: usd(senior.activeMRR) },
      ],
    },
    senior,
    nonSenior.churnRate,
  )

  // Loyalty programme for high-value customers is driven by revenue concentration, not by lift.
  const hv = groupStats(list, (c) => c.monthlyCharges >= t.monthlyP75)
  if (hv.n >= 30) {
    const share = a.revenue.activeMRR ? hv.activeMRR / a.revenue.activeMRR : 0
    recs.push({
      id: 'loyalty',
      title: 'Launch a loyalty programme for high-value customers',
      problem: 'A small share of customers generates a large share of recurring revenue.',
      finding: `High-value customers (≥ $${t.monthlyP75.toFixed(0)}/month) generate ${pct(share)} of active MRR and churn at ${pct(hv.churnRate)} (overall ${pct(overall)}).`,
      segment: `High-value customers (${hv.active.toLocaleString()} active)`,
      action: 'Create tiered loyalty rewards, priority support and annual renewal perks; assign customer-success ownership for the top accounts.',
      priority: share >= 0.3 && hv.churnRate >= overall * 1.2 ? 'High' : 'Medium',
      impact: scenario(hv),
      evidence: [
        { label: 'Share of MRR', value: pct(share) },
        { label: 'Segment churn', value: pct(hv.churnRate) },
        { label: 'Active MRR', value: usd(hv.activeMRR) },
      ],
      targetCustomers: hv.active,
      targetMRR: hv.activeMRR,
      lift: overall ? hv.churnRate / overall : 1,
    })
  }

  const order = { High: 0, Medium: 1, Low: 2 }
  return recs.sort((x, y) => order[x.priority] - order[y.priority] || y.targetMRR * y.lift - x.targetMRR * x.lift)
}
