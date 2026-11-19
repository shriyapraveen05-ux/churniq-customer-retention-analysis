
import { useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Clock, Crown, History, Repeat, Sparkles, Tag } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Card, ChartCard, COLORS, MiniBar, Note, PageHeader } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend, tooltipCursor } from '@/components/churniq/chart-kit'
import { CustomerTable, commonColumns } from '@/components/churniq/customer-table'
import { Select } from '@/components/churniq/topbar'
import { cn } from '@/lib/utils'
import { num, pct, usd } from '@/lib/format'

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  new: Sparkles,
  long_term: History,
  high_value: Crown,
  month_to_month: Repeat,
  price_sensitive: Tag,
  recently_churned: Clock,
}

export function SegmentsPage() {
  return <AnalysisGate>{(a) => <Segments a={a} />}</AnalysisGate>
}

function Segments({ a }: { a: Analysis }) {
  const [selected, setSelected] = useState<string>('all')
  const chart = a.segments.map((s) => ({ name: s.name.replace(' Customers', ''), Customers: s.customers, 'Churn rate': s.churnRate }))
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Customer segmentation"
        title="Behavioural segments and how they retain"
        description="Six rule-based segments built only from attributes in the dataset. Segments overlap — one customer can be both New and Month-to-Month. Click a segment to filter the customer table."
        actions={<FilterSummary a={a} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {a.segments.map((s) => {
          const Icon = ICONS[s.key] ?? Sparkles
          const active = selected === s.key
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(active ? 'all' : s.key)}
              className={cn(
                'card-surface rounded-xl border p-4 text-left transition-colors',
                active ? 'border-primary/60 ring-1 ring-primary/40' : 'border-border hover:border-primary/30',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-violet/12">
                    <Icon className="size-4 text-violet" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-[11px] text-muted-foreground">{s.rule}</p>
                  </div>
                </div>
                <span className="text-lg font-semibold tabular">{num(s.customers)}</span>
              </div>
              <dl className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
                <div>
                  <dt className="text-muted-foreground">Avg tenure</dt>
                  <dd className="mt-0.5 font-medium tabular">{s.avgTenure.toFixed(1)} mo</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Avg monthly</dt>
                  <dd className="mt-0.5 font-medium tabular">{usd(s.avgMonthly, 0)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Churn</dt>
                  <dd className={cn('mt-0.5 font-medium tabular', s.churnRate > a.kpis.churnRate ? 'text-negative' : 'text-positive')}>
                    {pct(s.churnRate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Retention</dt>
                  <dd className="mt-0.5 font-medium tabular">{pct(s.retentionRate)}</dd>
                </div>
              </dl>
              <div className="mt-3">
                <MiniBar value={s.churnRate} color={s.churnRate > a.kpis.churnRate ? COLORS.coral : COLORS.teal} />
              </div>
            </button>
          )
        })}
      </div>

      <ChartCard
        title="Segment comparison"
        description="Customer count (bars) and churn rate (line) per segment."
        action={<Legend items={[{ label: 'Customers', color: COLORS.violet }, { label: 'Churn rate', color: COLORS.coral }]} />}
      >
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={chart} margin={{ top: 5, right: 0, left: -10, bottom: 0 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="name" {...axisProps} interval={0} />
              <YAxis yAxisId="c" {...axisProps} />
              <YAxis yAxisId="r" orientation="right" {...axisProps} tickFormatter={(v) => pct(v, 0)} />
              <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v, n) => (n === 'Churn rate' ? pct(v) : num(v))} />} />
              <Bar yAxisId="c" dataKey="Customers" fill={COLORS.violet} fillOpacity={0.6} radius={[4, 4, 0, 0]} maxBarSize={48} />
              <Line yAxisId="r" dataKey="Churn rate" stroke={COLORS.coral} strokeWidth={2.25} dot={{ r: 3.5, fill: COLORS.coral }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <Card className="p-5">
        <h3 className="mb-3 text-sm font-semibold">Segmentation rules</h3>
        <ul className="grid gap-2 text-xs md:grid-cols-2">
          {a.segmentDefs.map((s) => (
            <li key={s.key} className="flex gap-2">
              <span className="font-medium">{s.name}:</span>
              <span className="text-muted-foreground">{s.rule}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Thresholds derive from the active dataset: median monthly charge {usd(a.thresholds.monthlyMedian, 2)}, 75th percentile{' '}
          {usd(a.thresholds.monthlyP75, 2)}. “Recently churned” uses the dataset&apos;s Churn label, which records departures in the last month.
        </p>
      </Card>

      <CustomerTable
        key={selected}
        title="Customer directory"
        description={selected === 'all' ? 'All customers in the current filter selection.' : `Customers in: ${a.segmentDefs.find((s) => s.key === selected)?.name}`}
        listSegment={selected}
        defaultSort="monthlyCharges"
        toolbar={
          <Select
            label="Segment"
            value={selected}
            onChange={setSelected}
            options={[{ value: 'all', label: 'All segments' }, ...a.segmentDefs.map((s) => ({ value: s.key, label: s.name }))]}
          />
        }
        columns={[commonColumns.id, commonColumns.segments, commonColumns.contract, commonColumns.tenure, commonColumns.monthly, commonColumns.total, commonColumns.status]}
      />

      <Note>Segment metrics respect the global filters in the header; the table can additionally be narrowed to one segment.</Note>
    </div>
  )
}
