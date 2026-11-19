
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, ComposedChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { ChartCard, COLORS, Note, PageHeader } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend, tooltipCursor } from '@/components/churniq/chart-kit'
import { ChurnRateBars, explainBreakdown } from '@/components/churniq/breakdown-chart'
import { cn } from '@/lib/utils'
import { num, pct } from '@/lib/format'

export function ChurnAnalysisPage() {
  return <AnalysisGate>{(a) => <ChurnAnalysis a={a} />}</AnalysisGate>
}

const SERVICE_DIMS = ['internetService', 'techSupport', 'onlineSecurity', 'onlineBackup', 'deviceProtection', 'phoneService', 'multipleLines', 'streamingTV', 'streamingMovies'] as const
const DEMO_DIMS = ['senior', 'partner', 'dependents', 'gender', 'paperlessBilling'] as const

function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string }[] }) {
  return (
    <div role="tablist" className="scrollbar-thin flex gap-1 overflow-x-auto rounded-lg border border-border bg-background/50 p-1">
      {items.map((i) => (
        <button
          key={i.key}
          role="tab"
          type="button"
          aria-selected={value === i.key}
          onClick={() => onChange(i.key)}
          className={cn(
            'whitespace-nowrap rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
            value === i.key ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {i.label}
        </button>
      ))}
    </div>
  )
}

function ChurnAnalysis({ a }: { a: Analysis }) {
  const overall = a.kpis.churnRate
  const b = a.breakdowns
  const [svc, setSvc] = useState<(typeof SERVICE_DIMS)[number]>('internetService')
  const [demo, setDemo] = useState<(typeof DEMO_DIMS)[number]>('senior')
  const donut = [
    { label: 'Retained', value: a.kpis.activeCustomers, fill: COLORS.blue },
    { label: 'Churned', value: a.kpis.churnedCustomers, fill: COLORS.coral },
  ]
  const contractStack = b.contract.rows.map((r) => ({ label: r.label, Retained: r.retained / r.customers, Churned: r.churnRate }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Churn analysis"
        title="Where customer attrition is concentrated"
        description="Churn rate across contract, tenure, pricing, payment, service and demographic dimensions. Bars are coloured relative to the overall churn rate (dashed line): coral above, teal below, amber within ±10%."
        actions={<FilterSummary a={a} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Monthly churn trend (by lifecycle quarter)"
          description="Customers grouped by the 3-month tenure window in which they were observed; churn rate is the share of that group that churned."
          action={<Legend items={[{ label: 'Customers', color: COLORS.blue }, { label: 'Churn rate', color: COLORS.coral }]} />}
          footer="The dataset has no calendar dates, so “time” is expressed as lifecycle month (tenure). This shows when in the customer lifecycle churn occurs, not calendar seasonality."
        >
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={a.lifecycleQuarterly} margin={{ top: 5, right: 0, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} interval={3} />
                <YAxis yAxisId="c" {...axisProps} />
                <YAxis yAxisId="r" orientation="right" {...axisProps} tickFormatter={(v) => pct(v, 0)} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v, n) => (n === 'Churn rate' ? pct(v) : num(v))} labelFormat={(l) => `Tenure ${l}`} />} />
                <Bar yAxisId="c" dataKey="customers" name="Customers" fill={COLORS.blue} fillOpacity={0.35} radius={[3, 3, 0, 0]} />
                <Line yAxisId="r" type="monotone" dataKey="churnRate" name="Churn rate" stroke={COLORS.coral} strokeWidth={2.25} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Churn distribution" description="Retained vs churned in the current selection.">
          <div className="relative h-48">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donut} dataKey="value" nameKey="label" innerRadius="65%" outerRadius="92%" stroke="none" paddingAngle={2}>
                  {donut.map((d) => (
                    <Cell key={d.label} fill={d.fill} />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip format={(v) => num(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-semibold tabular text-negative">{pct(overall)}</span>
              <span className="text-[11px] text-muted-foreground">churn rate</span>
            </div>
          </div>
          <Legend items={donut.map((d) => ({ label: `${d.label} · ${num(d.value)}`, color: d.fill }))} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Churn by contract type" description="Stacked share of retained vs churned customers per contract." footer={explainBreakdown(b.contract.rows, overall, 'contract')}>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={contractStack} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <XAxis type="number" {...axisProps} domain={[0, 1]} tickFormatter={(v) => pct(v, 0)} />
                <YAxis type="category" dataKey="label" {...axisProps} width={110} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => pct(v)} />} />
                <Bar dataKey="Churned" stackId="s" fill={COLORS.coral} barSize={24} />
                <Bar dataKey="Retained" stackId="s" fill={COLORS.blue} fillOpacity={0.55} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Churn by payment method" footer={explainBreakdown(b.paymentMethod.rows, overall, 'payment method')}>
          <ChurnRateBars rows={b.paymentMethod.rows} overall={overall} layout="vertical" />
        </ChartCard>
        <ChartCard title="Churn by tenure group" footer={explainBreakdown(b.tenureGroup.rows, overall, 'tenure')}>
          <ChurnRateBars rows={b.tenureGroup.rows} overall={overall} />
        </ChartCard>
        <ChartCard title="Churn by monthly charge range" footer={explainBreakdown(b.chargeBand.rows, overall, 'monthly charge band')}>
          <ChurnRateBars rows={b.chargeBand.rows} overall={overall} />
        </ChartCard>
        <ChartCard title="Churn by total charges" description="Lifetime billed amount — strongly tied to tenure." footer={explainBreakdown(b.totalBand.rows, overall, 'total charges')}>
          <ChurnRateBars rows={b.totalBand.rows} overall={overall} />
        </ChartCard>
        <ChartCard
          title="Churn by service category"
          action={
            <Tabs
              value={svc}
              onChange={setSvc}
              items={SERVICE_DIMS.map((k) => ({ key: k, label: b[k].label.replace(' service', '') }))}
            />
          }
          footer={explainBreakdown(b[svc].rows, overall, b[svc].label.toLowerCase())}
        >
          <ChurnRateBars rows={b[svc].rows} overall={overall} />
        </ChartCard>
      </div>

      <ChartCard
        title="Churn across customer groups (demographics)"
        description="Demographic attributes are shown for understanding, not for targeting decisions that could be discriminatory."
        action={<Tabs value={demo} onChange={setDemo} items={DEMO_DIMS.map((k) => ({ key: k, label: b[k].label }))} />}
        footer={explainBreakdown(b[demo].rows, overall, b[demo].label.toLowerCase())}
      >
        <ChurnRateBars rows={b[demo].rows} overall={overall} height={200} />
      </ChartCard>

      <Note>
        These charts describe <strong>associations</strong> in observational data. For example, month-to-month and fiber-optic customers churn more,
        but those groups also differ in tenure and price; see Retention Factors for statistical tests and the multivariable model.
      </Note>
    </div>
  )
}
