
import { Link } from '@tanstack/react-router'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowRight,
  CalendarClock,
  CircleDollarSign,
  Clock,
  Percent,
  ShieldCheck,
  TrendingDown,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Badge, Card, ChartCard, COLORS, KpiCard, Note, PageHeader, RISK_COLORS } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend, tooltipCursor } from '@/components/churniq/chart-kit'
import { num, pct, usd, usdCompact } from '@/lib/format'

export function OverviewPage() {
  return <AnalysisGate>{(a) => <Overview a={a} />}</AnalysisGate>
}

const toneColor = { negative: COLORS.coral, warning: COLORS.amber, positive: COLORS.teal, info: COLORS.blue, neutral: COLORS.muted } as const

function Overview({ a }: { a: Analysis }) {
  const k = a.kpis
  const cmp = a.comparison
  const delta = (cur: number, prev: number | undefined) =>
    cmp && prev !== undefined && prev !== 0 ? { value: (cur - prev) / prev, label: cmp.label } : null
  const snapshot = 'Snapshot · no prior period'

  const hazard = a.lifecycle.slice(0, Math.min(a.lifecycle.length, 72)).map((p) => ({
    month: p.month,
    'Churn rate': p.hazard,
    Retention: p.survival,
  }))
  const tenureRows = a.breakdowns.tenureGroup.rows
  const contractRows = a.breakdowns.contract.rows
  const riskTotal = a.risk.counts.reduce((s, r) => s + r.customers, 0)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Executive overview"
        title="Welcome back — here is your retention picture"
        description="Every figure below is computed live from the active customer dataset by the CHURNIQ analytics pipeline. Use the filters above to focus on a reporting window, segment, contract or service type."
        actions={<FilterSummary a={a} />}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard label="Total customers" value={num(k.totalCustomers)} icon={Users} delta={delta(k.totalCustomers, cmp?.kpis.totalCustomers)} sub={snapshot} />
        <KpiCard label="Overall churn rate" value={pct(k.churnRate)} icon={TrendingDown} tone="coral" deltaGoodWhen="down" delta={delta(k.churnRate, cmp?.kpis.churnRate)} sub={`${num(k.churnedCustomers)} customers left`} />
        <KpiCard label="Retention rate" value={pct(k.retentionRate)} icon={ShieldCheck} tone="teal" delta={delta(k.retentionRate, cmp?.kpis.retentionRate)} sub="Share still active at snapshot" />
        <KpiCard label="Active customers" value={num(k.activeCustomers)} icon={UserCheck} tone="teal" delta={delta(k.activeCustomers, cmp?.kpis.activeCustomers)} sub={snapshot} />
        <KpiCard label="Churned customers" value={num(k.churnedCustomers)} icon={UserMinus} tone="coral" deltaGoodWhen="down" delta={delta(k.churnedCustomers, cmp?.kpis.churnedCustomers)} sub="Left in the observation month" />
        <KpiCard label="Average tenure" value={`${k.avgTenure.toFixed(1)} mo`} icon={Clock} tone="violet" delta={delta(k.avgTenure, cmp?.kpis.avgTenure)} sub="Across all customers" />
        <KpiCard label="Avg monthly charges" value={usd(k.avgMonthly, 2)} icon={CircleDollarSign} tone="blue" delta={delta(k.avgMonthly, cmp?.kpis.avgMonthly)} sub="Per customer, all statuses" />
        <KpiCard label="Revenue at risk" value={usdCompact(k.revenueAtRisk)} icon={Percent} tone="amber" deltaGoodWhen="down" delta={delta(k.revenueAtRisk, cmp?.kpis.revenueAtRisk)} sub="Monthly MRR · high-risk active" />
      </div>

      {!cmp && (
        <Note>
          The IBM Telco dataset is a single-month snapshot, so period-over-period comparisons are not available and are shown as
          “Snapshot”. Time-based charts use <strong>customer lifecycle month</strong> (tenure) rather than calendar month.
        </Note>
      )}

      <ExecutiveSummary a={a} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Monthly churn trend by lifecycle month"
          description="Kaplan–Meier hazard: share of customers still active at the start of month m who churned in month m."
          footer={`Month 1 hazard is ${pct(a.lifecycle[0]?.hazard ?? 0)}; risk falls steeply over the first year, which is why onboarding matters most.`}
        >
          <div className="h-64">
            <ResponsiveContainer>
              <AreaChart data={hazard} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="hz" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLORS.coral} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLORS.coral} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" {...axisProps} interval={11} tickFormatter={(v) => `M${v}`} />
                <YAxis {...axisProps} tickFormatter={(v) => pct(v, 0)} />
                <Tooltip cursor={{ stroke: COLORS.grid }} content={<ChartTooltip format={(v) => pct(v, 2)} labelFormat={(l) => `Lifecycle month ${l}`} />} />
                <Area type="monotone" dataKey="Churn rate" stroke={COLORS.coral} strokeWidth={2} fill="url(#hz)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Customer retention trend"
          description="Kaplan–Meier survival: estimated share of an acquired cohort still active after m months."
          footer={`Estimated ${pct(a.lifecycle[11]?.survival ?? 0)} of customers survive 12 months and ${pct(a.lifecycle[Math.min(a.lifecycle.length - 1, 71)]?.survival ?? 0)} reach month ${Math.min(a.lifecycle.length, 72)}.`}
        >
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={hazard} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" {...axisProps} interval={11} tickFormatter={(v) => `M${v}`} />
                <YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v) => pct(v, 0)} />
                <Tooltip cursor={{ stroke: COLORS.grid }} content={<ChartTooltip format={(v) => pct(v, 1)} labelFormat={(l) => `After ${l} months`} />} />
                <Line type="monotone" dataKey="Retention" stroke={COLORS.teal} strokeWidth={2.25} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Active versus churned customers by tenure"
          description="Customer counts per tenure group at the snapshot."
          action={<Legend items={[{ label: 'Active', color: COLORS.blue }, { label: 'Churned', color: COLORS.coral }]} />}
        >
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={tenureRows} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => num(v)} />} />
                <Bar dataKey="retained" name="Active" stackId="a" fill={COLORS.blue} />
                <Bar dataKey="churned" name="Churned" stackId="a" fill={COLORS.coral} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Customer risk distribution"
          description={a.risk.method === 'logistic_regression' ? 'Active customers scored by the trained logistic regression model.' : 'Active customers scored by the transparent rule-based model.'}
        >
          <div className="relative h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={a.risk.counts} dataKey="customers" nameKey="category" innerRadius="64%" outerRadius="92%" paddingAngle={2} stroke="none">
                  {a.risk.counts.map((r) => (
                    <Cell key={r.category} fill={RISK_COLORS[r.category]} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => `${num(v)} customers`} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-semibold tabular">{num(riskTotal)}</span>
              <span className="text-[11px] text-muted-foreground">active scored</span>
            </div>
          </div>
          <ul className="mt-3 flex flex-col gap-2">
            {a.risk.counts.map((r) => (
              <li key={r.category} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <span className="size-2 rounded-full" style={{ backgroundColor: RISK_COLORS[r.category] }} />
                  {r.category} risk
                </span>
                <span className="tabular">
                  {num(r.customers)} · {usdCompact(r.mrr)}/mo
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Churn by contract type" description="Churn rate and customer count per contract.">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={contractRows} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => pct(v, 0)} />
                <YAxis type="category" dataKey="label" {...axisProps} width={110} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => pct(v)} />} />
                <Bar dataKey="churnRate" name="Churn rate" radius={[0, 4, 4, 0]} barSize={22}>
                  {contractRows.map((r) => (
                    <Cell key={r.label} fill={r.churnRate > k.churnRate ? COLORS.coral : COLORS.blue} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Churn by customer tenure" description="Churn rate per tenure group; coral bars exceed the overall rate.">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={tenureRows} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => pct(v, 0)} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => pct(v)} />} />
                <Bar dataKey="churnRate" name="Churn rate" radius={[4, 4, 0, 0]} barSize={28}>
                  {tenureRows.map((r) => (
                    <Cell key={r.label} fill={r.churnRate > k.churnRate ? COLORS.coral : COLORS.violet} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <section aria-labelledby="insights-h">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="insights-h" className="text-sm font-semibold">
            Key business insights
          </h2>
          <Link to="/strategies" className="flex items-center gap-1 text-xs text-primary hover:underline">
            View retention strategies <ArrowRight className="size-3" />
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {a.insights.map((i) => (
            <Card key={i.title} className="p-4 transition-colors hover:border-primary/30">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-medium text-balance">{i.title}</h3>
                <span className="shrink-0 text-lg font-semibold tabular" style={{ color: toneColor[i.tone] }}>
                  {i.metric}
                </span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty">{i.detail}</p>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}

function ExecutiveSummary({ a }: { a: Analysis }) {
  const c = a.breakdowns.contract.rows
  const m2m = c.find((r) => r.label === 'Month-to-month')
  const twoYear = c.find((r) => r.label === 'Two year')
  const firstYear = a.breakdowns.tenureGroup.rows.filter((r) => r.label.startsWith('0') || r.label.startsWith('7'))
  const fyChurned = firstYear.reduce((s, r) => s + r.churned, 0)
  const top = a.recommendations[0]
  return (
    <Card className="relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <div className="mb-2 flex items-center gap-2">
            <CalendarClock className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">Executive summary</h2>
            <Badge tone="blue">Auto-generated from data</Badge>
          </div>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-foreground/90">
            <li>
              <strong className="text-foreground">What is happening:</strong> {pct(a.kpis.churnRate)} of {num(a.population)} customers churned,
              taking {usdCompact(a.revenue.lostMRR)} of monthly recurring revenue ({pct(a.revenue.lostShare)} of the pre-churn base).
            </li>
            {m2m && (
              <li>
                <strong className="text-foreground">Why it may be happening:</strong> churn is concentrated among month-to-month customers ({pct(m2m.churnRate)}
                {twoYear ? ` vs ${pct(twoYear.churnRate)} on two-year plans` : ''}) and in the first year of tenure
                {fyChurned ? ` (${num(fyChurned)} of ${num(a.churnedCount)} churners)` : ''}. These are statistical associations, not proven causes.
              </li>
            )}
            {top && (
              <li>
                <strong className="text-foreground">What to do:</strong> {top.action}
              </li>
            )}
          </ul>
        </div>
        <div className="grid shrink-0 grid-cols-2 gap-3 lg:w-72">
          <Mini label="MRR lost to churn" value={usdCompact(a.revenue.lostMRR)} color={COLORS.coral} />
          <Mini label="High-risk MRR" value={usdCompact(a.revenue.highRiskMRR)} color={COLORS.amber} />
          <Mini label="Median lifetime" value={a.revenue.rmstMonths ? `${a.revenue.rmstMonths.toFixed(0)} mo` : '—'} color={COLORS.violet} />
          <Mini label="Model ROC-AUC" value={a.model ? a.model.metrics.rocAuc.toFixed(3) : 'n/a'} color={COLORS.blue} />
        </div>
      </div>
    </Card>
  )
}

function Mini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 text-base font-semibold tabular" style={{ color }}>
        {value}
      </p>
    </div>
  )
}
