
import { Bar, BarChart, CartesianGrid, PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Badge, Card, ChartCard, COLORS, Note, PageHeader } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend, tooltipCursor } from '@/components/churniq/chart-kit'
import { num, pct, usd } from '@/lib/format'

export function BehaviourPage() {
  return <AnalysisGate>{(a) => <Behaviour a={a} />}</AnalysisGate>
}

const legend = <Legend items={[{ label: 'Retained', color: COLORS.blue }, { label: 'Churned', color: COLORS.coral }]} />

function fmtMetric(v: number, unit: string) {
  if (unit === 'currency') return usd(v, 2)
  if (unit === 'percent') return pct(v)
  if (unit === 'months') return `${v.toFixed(1)} mo`
  return v.toFixed(2)
}

function MixChart({ data, height = 220 }: { data: { label: string; retained: number; churned: number }[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" {...axisProps} tickFormatter={(v) => pct(v, 0)} />
          <YAxis type="category" dataKey="label" {...axisProps} width={150} />
          <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => pct(v)} />} />
          <Bar dataKey="retained" name="Retained" fill={COLORS.blue} radius={[0, 3, 3, 0]} barSize={10} />
          <Bar dataKey="churned" name="Churned" fill={COLORS.coral} radius={[0, 3, 3, 0]} barSize={10} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Behaviour({ a }: { a: Analysis }) {
  const bh = a.behaviour
  const tenure = bh.profile.find((p) => p.metric === 'Average tenure')
  const charges = bh.profile.find((p) => p.metric === 'Average monthly charges')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Customer behaviour"
        title="How churned customers differ from those who stay"
        description="Side-by-side profile of retained and churned customers. Mix charts show the share of each group with a given attribute, so groups of different size are comparable."
        actions={<FilterSummary a={a} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {bh.profile.slice(0, 8).map((p) => {
          const diff = p.retained ? (p.churned - p.retained) / Math.abs(p.retained) : 0
          return (
            <Card key={p.metric} className="p-4">
              <p className="text-xs text-muted-foreground">{p.metric}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-primary">Retained</p>
                  <p className="mt-0.5 text-lg font-semibold tabular">{fmtMetric(p.retained, p.unit)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-negative">Churned</p>
                  <p className="mt-0.5 text-lg font-semibold tabular">{fmtMetric(p.churned, p.unit)}</p>
                </div>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">
                Churned is{' '}
                <span className={diff > 0 ? 'text-negative' : 'text-positive'}>
                  {diff > 0 ? '+' : ''}
                  {(diff * 100).toFixed(0)}%
                </span>{' '}
                vs retained
              </p>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tenure distribution"
          description="Share of each group falling in each tenure band."
          action={legend}
          footer={tenure ? `Churned customers averaged ${tenure.churned.toFixed(1)} months of tenure versus ${tenure.retained.toFixed(1)} for retained customers.` : undefined}
        >
          <Histogram data={bh.tenureHistogram} />
        </ChartCard>
        <ChartCard
          title="Monthly charge distribution"
          description="Share of each group per monthly charge band."
          action={legend}
          footer={charges ? `Churned customers paid ${usd(charges.churned, 2)}/mo on average versus ${usd(charges.retained, 2)} for retained.` : undefined}
        >
          <Histogram data={bh.chargeHistogram} />
        </ChartCard>
        <ChartCard title="Contract preferences" action={legend}>
          <MixChart data={bh.contractMix} height={180} />
        </ChartCard>
        <ChartCard title="Payment method preferences" action={legend}>
          <MixChart data={bh.paymentMix} height={200} />
        </ChartCard>
        <ChartCard title="Service subscriptions" description="Adoption rate of each service among retained vs churned customers." action={legend}>
          <div className="h-72">
            <ResponsiveContainer>
              <RadarChart data={bh.serviceAdoption} outerRadius="72%">
                <PolarGrid stroke={COLORS.grid} />
                <PolarAngleAxis dataKey="service" tick={{ fill: COLORS.muted, fontSize: 10 }} />
                <Radar name="Retained" dataKey="retained" stroke={COLORS.blue} fill={COLORS.blue} fillOpacity={0.25} />
                <Radar name="Churned" dataKey="churned" stroke={COLORS.coral} fill={COLORS.coral} fillOpacity={0.2} />
                <Tooltip content={<ChartTooltip format={(v) => pct(v)} />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Internet service mix" action={legend}>
          <MixChart data={bh.internetMix} height={180} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GroupList title="Groups with highest churn tendency" rows={bh.highChurnGroups} tone="coral" overall={a.kpis.churnRate} />
        <GroupList title="Groups with lowest churn tendency" rows={bh.lowChurnGroups} tone="teal" overall={a.kpis.churnRate} />
      </div>

      <Note>
        Lift = group churn rate ÷ overall churn rate ({pct(a.kpis.churnRate)}). Groups need at least 50 customers to be listed. Lift identifies where to
        look, not why customers leave.
      </Note>
    </div>
  )
}

function Histogram({ data }: { data: { bin: string; retained: number; churned: number }[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="bin" {...axisProps} />
          <YAxis {...axisProps} tickFormatter={(v) => pct(v, 0)} />
          <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => pct(v)} />} />
          <Bar dataKey="retained" name="Retained" fill={COLORS.blue} radius={[3, 3, 0, 0]} />
          <Bar dataKey="churned" name="Churned" fill={COLORS.coral} radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function GroupList({
  title,
  rows,
  tone,
  overall,
}: {
  title: string
  rows: { group: string; customers: number; churnRate: number; lift: number }[]
  tone: 'coral' | 'teal'
  overall: number
}) {
  return (
    <ChartCard title={title}>
      <ul className="flex flex-col divide-y divide-border/60">
        {rows.map((r) => (
          <li key={r.group} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{r.group}</p>
              <p className="text-[11px] text-muted-foreground">{num(r.customers)} customers</p>
            </div>
            <div className="w-28">
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.min(100, r.churnRate * 100 * 1.6)}%`, backgroundColor: tone === 'coral' ? COLORS.coral : COLORS.teal }}
                />
              </div>
            </div>
            <span className="w-14 text-right text-sm font-medium tabular">{pct(r.churnRate)}</span>
            <Badge tone={r.churnRate > overall ? 'coral' : 'teal'}>{r.lift.toFixed(2)}×</Badge>
          </li>
        ))}
      </ul>
    </ChartCard>
  )
}
