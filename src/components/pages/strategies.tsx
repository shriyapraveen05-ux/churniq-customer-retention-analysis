import { Lightbulb, Target, TrendingDown, Users } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Badge, Card, KpiCard, Note, PageHeader } from '@/components/churniq/primitives'
import { num, usd } from '@/lib/format'

export function StrategiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Retention strategies"
        title="Data-driven retention recommendations"
        description="Every recommendation below is generated only when the current data supports it. Change the filters to re-run the checks for a narrower population."
      />
      <AnalysisGate>{(a) => <Strategies a={a} />}</AnalysisGate>
    </div>
  )
}

const priorityTone = { High: 'coral', Medium: 'amber', Low: 'teal' } as const

function Strategies({ a }: { a: Analysis }) {
  const recs = a.recommendations
  const high = recs.filter((r) => r.priority === 'High').length
  const targetMRR = recs.reduce((s, r) => s + r.targetMRR, 0)
  return (
    <div className="flex flex-col gap-6">
      <FilterSummary a={a} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Recommendations" value={num(recs.length)} icon={Lightbulb} sub="Passed the data checks" />
        <KpiCard label="High priority" value={num(high)} icon={Target} tone="coral" sub="Large lift and revenue share" />
        <KpiCard label="Overall churn rate" value={`${(a.kpis.churnRate * 100).toFixed(1)}%`} icon={TrendingDown} tone="violet" sub="Comparison baseline" />
        <KpiCard
          label="Active MRR in targeted groups"
          value={usd(targetMRR)}
          icon={Users}
          tone="amber"
          sub="Groups can overlap"
        />
      </div>

      <Note>
        A recommendation appears only if its target group has at least 30 customers and churns at least 1.2× more than its comparison group.
        Priority: <strong>High</strong> = lift ≥ 2.5× and ≥ 30% of active MRR; <strong>Medium</strong> = lift ≥ 1.5×; otherwise <strong>Low</strong>.
        These are associations in a single snapshot — test each action (for example with a control group) before rolling it out.
      </Note>

      {recs.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No group in the current selection meets the evidence threshold for a recommendation. Widen the filters to include more customers.
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {recs.map((r, i) => (
            <Card key={r.id} className="flex flex-col gap-4 p-5">
              <header className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-xs font-semibold text-primary tabular">
                    {i + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-balance">{r.title}</h3>
                </div>
                <Badge tone={priorityTone[r.priority]}>{r.priority} priority</Badge>
              </header>
              <dl className="grid gap-3 text-xs leading-relaxed">
                <Field label="Finding">{r.finding}</Field>
                <Field label="Supporting data">
                  <div className="mt-1 flex flex-wrap gap-2">
                    {r.evidence.map((e) => (
                      <span key={e.label} className="rounded-md border border-border bg-surface px-2 py-1">
                        <span className="text-muted-foreground">{e.label}: </span>
                        <span className="font-medium tabular text-foreground">{e.value}</span>
                      </span>
                    ))}
                    <span className="rounded-md border border-border bg-surface px-2 py-1">
                      <span className="text-muted-foreground">Lift vs comparison: </span>
                      <span className="font-medium tabular text-foreground">{r.lift.toFixed(2)}×</span>
                    </span>
                  </div>
                </Field>
                <Field label="Affected segment">{r.segment}</Field>
                <Field label="Business implication">
                  {r.problem} The targeted group holds {usd(r.targetMRR)} of active monthly revenue across {num(r.targetCustomers)} active customers.
                </Field>
                <Field label="Recommended action">{r.action}</Field>
              </dl>
              <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted-foreground">{r.impact}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-foreground/90 text-pretty">{children}</dd>
    </div>
  )
}
