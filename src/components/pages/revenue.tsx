
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts'
import { CircleDollarSign, Gem, HandCoins, Receipt, TrendingDown, Wallet } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Badge, Card, ChartCard, COLORS, KpiCard, Note, PageHeader } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend, tooltipCursor } from '@/components/churniq/chart-kit'
import { num, pct, usd, usdCompact } from '@/lib/format'

export function RevenuePage() {
  return <AnalysisGate>{(a) => <Revenue a={a} />}</AnalysisGate>
}

function Tag({ kind }: { kind: 'actual' | 'estimate' }) {
  return kind === 'actual' ? <Badge tone="teal">From data</Badge> : <Badge tone="amber">Estimate</Badge>
}

function Revenue({ a }: { a: Analysis }) {
  const r = a.revenue
  const segRisk = [...a.segments].sort((x, y) => y.highRiskMRR - x.highRiskMRR).map((s) => ({ name: s.name.replace(' Customers', ''), 'High-risk MRR': s.highRiskMRR, 'Lost MRR': s.lostMRR }))
  const active = r.scatter.filter((s) => !s.churn)
  const churned = r.scatter.filter((s) => s.churn)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Revenue impact"
        title="The financial cost of churn"
        description="Monthly charges are the only revenue field in the dataset, so revenue is measured as Monthly Recurring Revenue (MRR). Every metric is labelled as either read directly from data or estimated."
        actions={<FilterSummary a={a} />}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
        <Metric icon={Wallet} tone="blue" label="Monthly recurring revenue" value={usd(r.activeMRR)} kind="actual" sub="Sum of MonthlyCharges, active customers" />
        <Metric icon={TrendingDown} tone="coral" label="Revenue lost through churn" value={usd(r.lostMRR)} kind="actual" sub={`MRR of churned customers · ${pct(r.lostShare)} of prior base`} />
        <Metric icon={HandCoins} tone="amber" label="Revenue at risk" value={usd(r.highRiskMRR)} kind="estimate" sub={`High-risk active MRR · expected ${usdCompact(r.expectedLossMRR)}`} />
        <Metric icon={Receipt} tone="violet" label="Average revenue per user" value={usd(r.arpu, 2)} kind="actual" sub="Active customers, per month" />
        <Metric icon={CircleDollarSign} tone="teal" label="Average monthly charges" value={usd(r.avgMonthly, 2)} kind="actual" sub="All customers incl. churned" />
        <Metric icon={Gem} tone="violet" label="Estimated customer lifetime value" value={usd(r.estimatedCLV)} kind="estimate" sub={`ARPU × ${r.rmstMonths.toFixed(1)} mo avg life (KM)`} />
      </div>

      <Note tone="amber">
        <strong>Estimates explained.</strong> Revenue at risk = current MRR of customers scored High risk; expected loss = Σ(risk score × MRR) across active
        customers. CLV = ARPU × restricted mean lifetime from the Kaplan–Meier curve (capped at the 72-month observation window, undiscounted, no margin
        applied). No monthly revenue history exists in the dataset, so no revenue trend is shown. TotalCharges ({usdCompact(r.historicalBilled)} lifetime billed) is actual historical billing.
      </Note>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Revenue by contract type"
          description="Active MRR retained vs MRR lost to churn."
          action={<Legend items={[{ label: 'Active MRR', color: COLORS.blue }, { label: 'Lost MRR', color: COLORS.coral }]} />}
        >
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={r.byContract} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="contract" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => usdCompact(v)} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => usd(v)} />} />
                <Bar dataKey="activeMRR" name="Active MRR" fill={COLORS.blue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="lostMRR" name="Lost MRR" fill={COLORS.coral} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard
          title="Revenue at risk by customer segment"
          description="High-risk active MRR and MRR already lost per segment (segments overlap)."
          action={<Legend items={[{ label: 'High-risk MRR', color: COLORS.amber }, { label: 'Lost MRR', color: COLORS.coral }]} />}
        >
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={segRisk} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" {...axisProps} tickFormatter={(v) => usdCompact(v)} />
                <YAxis type="category" dataKey="name" {...axisProps} width={110} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => usd(v)} />} />
                <Bar dataKey="High-risk MRR" fill={COLORS.amber} barSize={10} radius={[0, 3, 3, 0]} />
                <Bar dataKey="Lost MRR" fill={COLORS.coral} barSize={10} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Revenue loss by tenure" description="Lost MRR by tenure group of the churned customer.">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={r.lostByTenure} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis {...axisProps} tickFormatter={(v) => usdCompact(v)} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v, n) => (n === 'Lost MRR' ? usd(v) : num(v))} />} />
                <Bar dataKey="lostMRR" name="Lost MRR" radius={[4, 4, 0, 0]}>
                  {r.lostByTenure.map((x, i) => (
                    <Cell key={x.label} fill={i < 2 ? COLORS.coral : COLORS.violet} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Monthly charge comparison" description="Distribution of monthly charges by status (box-plot summary).">
          <div className="flex flex-col gap-5 pt-2">
            {r.chargeQuartiles.map((q) => {
              const lo = 15
              const hi = 125
              const x = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
              const color = q.status === 'Churned' ? COLORS.coral : COLORS.blue
              return (
                <div key={q.status}>
                  <div className="mb-2 flex justify-between text-xs">
                    <span className="font-medium">{q.status}</span>
                    <span className="tabular text-muted-foreground">
                      median {usd(q.median, 2)} · mean {usd(q.mean, 2)}
                    </span>
                  </div>
                  <div className="relative h-8" role="img" aria-label={`${q.status}: min ${q.min}, Q1 ${q.q1}, median ${q.median}, Q3 ${q.q3}, max ${q.max}`}>
                    <div className="absolute top-1/2 h-px bg-muted-foreground/50" style={{ left: x(q.min), right: `calc(100% - ${x(q.max)})` }} />
                    <div
                      className="absolute inset-y-1 rounded-md border"
                      style={{ left: x(q.q1), width: `calc(${x(q.q3)} - ${x(q.q1)})`, backgroundColor: `${color}33`, borderColor: color }}
                    />
                    <div className="absolute inset-y-0 w-0.5 rounded" style={{ left: x(q.median), backgroundColor: color }} />
                  </div>
                </div>
              )
            })}
            <div className="flex justify-between text-[10px] text-muted-foreground tabular">
              <span>$15</span>
              <span>$70</span>
              <span>$125</span>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <ChartCard
          className="lg:col-span-3"
          title="Customer value map"
          description="Tenure vs monthly charges (sample of customers). Churners cluster at short tenure and high charges."
          action={<Legend items={[{ label: 'Active', color: COLORS.blue }, { label: 'Churned', color: COLORS.coral }]} />}
        >
          <div className="h-72">
            <ResponsiveContainer>
              <ScatterChart margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="tenure" name="Tenure" {...axisProps} unit=" mo" />
                <YAxis type="number" dataKey="monthly" name="Monthly" {...axisProps} tickFormatter={(v) => `$${v}`} />
                <ZAxis range={[14, 14]} />
                <Tooltip
                  cursor={{ stroke: COLORS.grid }}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as { tenure: number; monthly: number; churn: boolean } | undefined
                    if (!active || !p) return null
                    return (
                      <ChartTooltip
                        active
                        label={p.churn ? 'Churned customer' : 'Active customer'}
                        payload={[
                          { name: 'Tenure', value: p.tenure, color: COLORS.violet } as never,
                          { name: 'Monthly', value: p.monthly, color: COLORS.blue } as never,
                        ]}
                        format={(v, n) => (n === 'Tenure' ? `${v} mo` : usd(v, 2))}
                      />
                    )
                  }}
                />
                <Scatter data={active} fill={COLORS.blue} fillOpacity={0.35} name="Active" />
                <Scatter data={churned} fill={COLORS.coral} fillOpacity={0.6} name="Churned" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard className="lg:col-span-2" title="Customer value quadrants" description="Split at median monthly charge and 24-month tenure.">
          <div className="grid grid-cols-2 gap-2">
            {r.quadrants.map((q) => (
              <Card key={q.name} className="bg-background/40 p-3">
                <p className="text-xs font-medium">{q.name}</p>
                <p className="mt-0.5 text-[10px] text-muted-foreground">{q.desc}</p>
                <p className="mt-2 text-base font-semibold tabular">{num(q.customers)}</p>
                <div className="mt-1 flex flex-col gap-0.5 text-[11px] tabular">
                  <span className={q.churnRate > a.kpis.churnRate ? 'text-negative' : 'text-positive'}>{pct(q.churnRate)} churn</span>
                  <span className="text-muted-foreground">{usdCompact(q.activeMRR)} active MRR</span>
                  <span className="text-muted-foreground">{usdCompact(q.lostMRR)} lost MRR</span>
                </div>
              </Card>
            ))}
          </div>
        </ChartCard>
      </div>
    </div>
  )
}

function Metric({
  icon,
  tone,
  label,
  value,
  kind,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  tone: 'blue' | 'coral' | 'amber' | 'violet' | 'teal'
  label: string
  value: string
  kind: 'actual' | 'estimate'
  sub: string
}) {
  return (
    <div className="relative">
      <KpiCard label={label} value={value} icon={icon} tone={tone} sub={sub} />
      <span className="absolute bottom-4 right-4 hidden sm:block">
        <Tag kind={kind} />
      </span>
    </div>
  )
}
