
import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertOctagon, AlertTriangle, CircleDollarSign, ShieldCheck } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Badge, ChartCard, COLORS, KpiCard, MiniBar, Note, PageHeader, RISK_COLORS, RiskBadge, StatRow } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend, tooltipCursor } from '@/components/churniq/chart-kit'
import { CustomerTable, commonColumns } from '@/components/churniq/customer-table'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/churniq/ui/sheet'
import type { CustomerRow } from '@/components/providers/analytics-provider'
import { cn } from '@/lib/utils'
import { num, pct, usd, usdCompact } from '@/lib/format'

export function RiskPage() {
  return <AnalysisGate>{(a) => <Risk a={a} />}</AnalysisGate>
}

const FILTERS = ['all', 'High', 'Medium', 'Low'] as const

function Risk({ a }: { a: Analysis }) {
  const [cat, setCat] = useState<(typeof FILTERS)[number]>('all')
  const [selected, setSelected] = useState<CustomerRow | null>(null)
  const c = Object.fromEntries(a.risk.counts.map((r) => [r.category, r])) as Record<string, (typeof a.risk.counts)[number]>
  const isModel = a.risk.method === 'logistic_regression'
  const hist = a.risk.histogram.map((h) => ({
    ...h,
    fill: h.lo >= a.risk.thresholds.high ? COLORS.coral : h.lo >= a.risk.thresholds.medium ? COLORS.amber : COLORS.teal,
  }))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Risk assessment"
        title="Active customers most likely to churn next"
        description={
          isModel
            ? `Risk scores are out-of-fold churn probabilities from the logistic regression model (5-fold cross-validated, so no customer is scored by a model trained on them). High ≥ ${pct(a.risk.thresholds.high, 0)}, Medium ≥ ${pct(a.risk.thresholds.medium, 0)}.`
            : 'Risk scores come from a transparent rule-based scorecard (the model could not be trained on this dataset). Scores are relative indicators, not probabilities.'
        }
        actions={<FilterSummary a={a} />}
      />

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard label="High-risk customers" value={num(c.High?.customers ?? 0)} icon={AlertOctagon} tone="coral" sub={`${pct(c.High?.share ?? 0)} of active base`} />
        <KpiCard label="Medium-risk customers" value={num(c.Medium?.customers ?? 0)} icon={AlertTriangle} tone="amber" sub={`${pct(c.Medium?.share ?? 0)} of active base`} />
        <KpiCard label="Low-risk customers" value={num(c.Low?.customers ?? 0)} icon={ShieldCheck} tone="teal" sub={`${pct(c.Low?.share ?? 0)} of active base`} />
        <KpiCard label="Estimated revenue at risk" value={usdCompact(a.revenue.highRiskMRR)} icon={CircleDollarSign} tone="amber" sub={`MRR · expected loss ${usdCompact(a.revenue.expectedLossMRR)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Risk score distribution" description="Active customers per score decile." className="lg:col-span-2">
          <div className="h-60">
            <ResponsiveContainer>
              <BarChart data={hist} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="bin" {...axisProps} />
                <YAxis {...axisProps} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => `${num(v)} customers`} labelFormat={(l) => `Score ${l}`} />} />
                <Bar dataKey="customers" name="Customers" radius={[4, 4, 0, 0]}>
                  {hist.map((h) => (
                    <Cell key={h.bin} fill={h.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Most common risk factors" description="Share of high & medium-risk customers exhibiting each factor.">
          <ul className="flex flex-col gap-3">
            {a.risk.factors.slice(0, 7).map((f) => (
              <li key={f.factor}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{f.factor}</span>
                  <span className="tabular text-muted-foreground">{pct(f.share, 0)}</span>
                </div>
                <MiniBar value={f.share} color={COLORS.violet} />
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <ChartCard
        title="Risk mix by contract type"
        action={<Legend items={(['High', 'Medium', 'Low'] as const).map((k) => ({ label: k, color: RISK_COLORS[k] }))} />}
      >
        <div className="h-44">
          <ResponsiveContainer>
            <BarChart data={a.risk.byContract} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
              <XAxis type="number" {...axisProps} />
              <YAxis type="category" dataKey="label" {...axisProps} width={110} />
              <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => num(v)} />} />
              <Bar dataKey="High" stackId="r" fill={RISK_COLORS.High} barSize={20} />
              <Bar dataKey="Medium" stackId="r" fill={RISK_COLORS.Medium} />
              <Bar dataKey="Low" stackId="r" fill={RISK_COLORS.Low} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <CustomerTable
        key={cat}
        title="Customer risk register"
        description="Active customers only. Select a row to open the customer profile."
        status="active"
        risk={cat}
        onSelect={setSelected}
        toolbar={
          <div role="radiogroup" aria-label="Risk category" className="flex gap-1 rounded-lg border border-border bg-background/50 p-1">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={cat === f}
                onClick={() => setCat(f)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                  cat === f ? 'bg-primary/15 text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        }
        columns={[
          commonColumns.id,
          commonColumns.contract,
          commonColumns.tenure,
          commonColumns.monthly,
          commonColumns.payment,
          commonColumns.score,
          commonColumns.category,
          {
            key: 'factors',
            label: 'Risk factors',
            render: (r) => (
              <div className="flex max-w-60 flex-wrap gap-1">
                {r.risk.factors.slice(0, 2).map((f) => (
                  <Badge key={f.key}>{f.label}</Badge>
                ))}
                {r.risk.factors.length > 2 && <Badge>+{r.risk.factors.length - 2}</Badge>}
              </div>
            ),
          },
          { key: 'action', label: 'Recommended action', render: (r) => <span className="line-clamp-2 max-w-64 text-muted-foreground">{r.risk.action}</span> },
        ]}
      />

      <Note>
        {isModel
          ? 'Scores are model estimates with uncertainty; at the 50% threshold the model catches most churners but also flags many who would stay (see Churn Model for precision/recall). Use them to prioritise outreach, not to make individual-level decisions automatically.'
          : 'Rule-based scores weight known risk indicators (contract, tenure, payment, add-ons, pricing). They are a transparent heuristic, not a trained prediction.'}
      </Note>

      <CustomerSheet row={selected} onClose={() => setSelected(null)} method={a.risk.method} />
    </div>
  )
}

function CustomerSheet({ row, onClose, method }: { row: CustomerRow | null; onClose: () => void; method: string }) {
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full border-border bg-sidebar sm:max-w-md">
        {row && (
          <>
            <SheetHeader className="border-b border-border">
              <SheetTitle className="font-mono text-base">{row.id}</SheetTitle>
              <SheetDescription>
                {row.contract} · {row.tenure} months · {row.internetService === 'No' ? 'No internet' : row.internetService}
              </SheetDescription>
            </SheetHeader>
            <div className="scrollbar-thin flex flex-1 flex-col gap-5 overflow-y-auto p-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{method === 'logistic_regression' ? 'Churn probability (model)' : 'Rule-based risk score'}</span>
                  <RiskBadge category={row.risk.category} />
                </div>
                <p className="mt-2 text-3xl font-semibold tabular" style={{ color: RISK_COLORS[row.risk.category] }}>
                  {pct(row.risk.score, 0)}
                </p>
                <div className="mt-3">
                  <MiniBar value={row.risk.score} color={RISK_COLORS[row.risk.category]} />
                </div>
              </div>

              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Identified risk factors</h3>
                {row.risk.factors.length ? (
                  <ul className="flex flex-col gap-1.5">
                    {row.risk.factors.map((f) => (
                      <li key={f.key} className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-xs">
                        <span>{f.label}</span>
                        <span className="tabular text-negative">+{(f.weight * 100).toFixed(0)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted-foreground">No major risk factors present.</p>
                )}
              </section>

              <section className="rounded-xl border border-primary/25 bg-primary/6 p-4">
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">Recommended action</h3>
                <p className="text-sm leading-relaxed">{row.risk.action}</p>
              </section>

              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account</h3>
                <div className="divide-y divide-border/60">
                  <StatRow label="Monthly charges" value={usd(row.monthlyCharges, 2)} />
                  <StatRow label="Total billed" value={usd(row.totalCharges, 2)} />
                  <StatRow label="Payment method" value={row.paymentMethod} />
                  <StatRow label="Paperless billing" value={row.paperlessBilling ? 'Yes' : 'No'} />
                  <StatRow label="Services subscribed" value={row.serviceCount} />
                  <StatRow label="Protective add-ons" value={`${row.protectiveAddons} of 4`} />
                </div>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Services</h3>
                <div className="divide-y divide-border/60">
                  <StatRow label="Phone" value={row.phoneService ? `Yes · ${row.multipleLines}` : 'No'} />
                  <StatRow label="Online security" value={row.onlineSecurity} />
                  <StatRow label="Tech support" value={row.techSupport} />
                  <StatRow label="Online backup" value={row.onlineBackup} />
                  <StatRow label="Device protection" value={row.deviceProtection} />
                  <StatRow label="Streaming TV / Movies" value={`${row.streamingTV} / ${row.streamingMovies}`} />
                </div>
              </section>
              <section>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Profile</h3>
                <div className="divide-y divide-border/60">
                  <StatRow label="Senior citizen" value={row.senior ? 'Yes' : 'No'} />
                  <StatRow label="Partner / Dependents" value={`${row.partner ? 'Yes' : 'No'} / ${row.dependents ? 'Yes' : 'No'}`} />
                  <StatRow label="Segments" value={row.segments.join(', ') || '—'} />
                </div>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
