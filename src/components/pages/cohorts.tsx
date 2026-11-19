
import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Card, ChartCard, COLORS, Note, PageHeader } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, Legend } from '@/components/churniq/chart-kit'
import { Select } from '@/components/churniq/topbar'
import { num, pct, usd } from '@/lib/format'

export function CohortsPage() {
  return <AnalysisGate>{(a) => <Cohorts a={a} />}</AnalysisGate>
}

const LINE_COLORS = [COLORS.blue, COLORS.violet, COLORS.teal, COLORS.amber, COLORS.coral]

function cellColor(v: number | null) {
  if (v === null) return 'transparent'
  const t = Math.max(0, Math.min(1, (v - 0.3) / 0.7))
  const r = Math.round(146 + (71 - 146) * t)
  const g = Math.round(112 + (125 - 112) * t)
  const b = 255
  return `rgba(${r},${g},${b},${0.12 + t * 0.78})`
}

function Cohorts({ a }: { a: Analysis }) {
  const c = a.cohorts
  const [dimKey, setDimKey] = useState(c.dimensions[0]?.key ?? 'contract')
  const [hover, setHover] = useState<{ g: string; m: number; v: number; n: number } | null>(null)
  const dim = c.dimensions.find((d) => d.key === dimKey) ?? c.dimensions[0]
  const ms = c.milestones.filter((m) => m <= c.overall.length - 1 || m === 1)

  const rows = useMemo(
    () => [
      { name: 'All customers', customers: a.population, survival: c.overall, rmst: c.rmst },
      ...(dim?.groups ?? []),
    ],
    [a.population, c.overall, c.rmst, dim],
  )

  const curve = useMemo(() => {
    const len = Math.max(...rows.map((r) => r.survival.length))
    return Array.from({ length: len }, (_, m) => {
      const pt: Record<string, number> = { month: m }
      rows.forEach((r) => {
        if (r.survival[m] !== undefined) pt[r.name] = r.survival[m]
      })
      return pt
    })
  }, [rows])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Cohort analysis"
        title="Retention over the customer lifecycle"
        description="Survival-style cohort retention: for each cohort, the estimated share of customers still active after m months. Compare cohorts defined by contract, internet, payment, support or demographics."
        actions={<FilterSummary a={a} />}
      />

      <Note tone="amber">
        <strong>Dataset limitation:</strong> the IBM Telco file has no sign-up or cancellation dates — only tenure (months as a customer) and whether they
        churned in the last month. True calendar acquisition cohorts cannot be built. Instead, CHURNIQ uses the <strong>Kaplan–Meier estimator</strong>{' '}
        on tenure to estimate month-by-month retention for each attribute cohort, treating active customers as right-censored. This assumes churn
        behaviour has been stable over time.
      </Note>

      <Card className="p-5">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Estimated survival at tenure milestones (Kaplan–Meier)</h3>
            <p className="mt-1 text-xs text-muted-foreground">Model-based estimate of the share of each group still active after m months of tenure — not an observed monthly history. Hover a cell for details.</p>
          </div>
          <Select
            label="Cohort dimension"
            value={dimKey}
            onChange={setDimKey}
            options={c.dimensions.map((d) => ({ value: d.key, label: d.label }))}
          />
        </div>
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] border-separate border-spacing-1 text-xs" aria-label="Cohort retention heatmap">
            <thead>
              <tr className="text-muted-foreground">
                <th scope="col" className="px-2 py-1 text-left font-medium">
                  Cohort
                </th>
                <th scope="col" className="px-2 py-1 text-right font-medium">
                  Customers
                </th>
                {ms.map((m) => (
                  <th key={m} scope="col" className="px-1 py-1 text-center font-medium tabular">
                    M{m}
                  </th>
                ))}
                <th scope="col" className="px-2 py-1 text-right font-medium" title="Restricted mean survival time">
                  Avg life
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name}>
                  <th scope="row" className={`whitespace-nowrap px-2 py-1 text-left font-medium ${i === 0 ? 'text-primary' : ''}`}>
                    {r.name}
                  </th>
                  <td className="px-2 py-1 text-right tabular text-muted-foreground">{num(r.customers)}</td>
                  {ms.map((m) => {
                    const v = r.survival[m] ?? null
                    return (
                      <td
                        key={m}
                        onMouseEnter={() => v !== null && setHover({ g: r.name, m, v, n: r.customers })}
                        onMouseLeave={() => setHover(null)}
                        className="h-9 min-w-14 rounded-md text-center font-medium tabular transition-transform hover:scale-105"
                        style={{ backgroundColor: cellColor(v), color: v !== null && v > 0.6 ? '#fff' : '#F4F6FC' }}
                      >
                        {v === null ? '—' : pct(v, 0)}
                      </td>
                    )
                  })}
                  <td className="px-2 py-1 text-right tabular">{r.rmst ? `${r.rmst.toFixed(1)} mo` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <span aria-live="polite">
            {hover
              ? `${hover.g}: an estimated ${pct(hover.v, 1)} of ${num(hover.n)} customers remain after ${hover.m} month${hover.m === 1 ? '' : 's'}.`
              : 'Avg life = restricted mean survival time (expected months active within the observed window).'}
          </span>
          <span className="flex items-center gap-2">
            Lower
            <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${cellColor(0.3)}, ${cellColor(1)})` }} />
            Higher
          </span>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Cohort retention curves"
          description={`Kaplan–Meier survival by ${dim?.label.toLowerCase() ?? 'cohort'}.`}
          action={<Legend items={rows.map((r, i) => ({ label: r.name, color: i === 0 ? '#F4F6FC' : LINE_COLORS[(i - 1) % LINE_COLORS.length] }))} />}
        >
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={curve} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" {...axisProps} interval={11} tickFormatter={(v) => `M${v}`} />
                <YAxis {...axisProps} domain={[0, 1]} tickFormatter={(v) => pct(v, 0)} />
                <Tooltip cursor={{ stroke: COLORS.grid }} content={<ChartTooltip format={(v) => pct(v, 1)} labelFormat={(l) => `After ${l} months`} />} />
                {rows.map((r, i) => (
                  <Line
                    key={r.name}
                    dataKey={r.name}
                    type="stepAfter"
                    dot={false}
                    strokeWidth={i === 0 ? 1.5 : 2}
                    strokeDasharray={i === 0 ? '4 3' : undefined}
                    stroke={i === 0 ? '#F4F6FC' : LINE_COLORS[(i - 1) % LINE_COLORS.length]}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Why cohort analysis matters">
          <ul className="flex flex-col gap-3 text-xs leading-relaxed text-muted-foreground">
            <li>
              <strong className="text-foreground">Separates when from who.</strong> A cohort curve shows how fast a group decays, not just its final
              churn rate.
            </li>
            <li>
              <strong className="text-foreground">Finds critical windows.</strong> Steep early drops point to onboarding or first-bill issues; later
              drops point to renewals or price changes.
            </li>
            <li>
              <strong className="text-foreground">Quantifies lifetime.</strong> Average life feeds directly into customer lifetime value on the
              Revenue Impact page.
            </li>
          </ul>
        </ChartCard>
      </div>

      <ChartCard
        title="Tenure bands (snapshot, not acquisition cohorts)"
        description="Customers grouped by tenure in 6-month bands at the snapshot date. Without sign-up dates these are not true acquisition cohorts. Churn rate is the share that left in the observation month."
        footer="Because only survivors of older cohorts remain in the file, older cohorts look healthier partly due to survivorship — compare with the Kaplan–Meier curves above."
      >
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[560px] text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Cohort</th>
                <th className="py-2 text-right font-medium">Customers</th>
                <th className="py-2 text-right font-medium">Active</th>
                <th className="py-2 text-right font-medium">Churned</th>
                <th className="py-2 text-right font-medium">Churn rate</th>
                <th className="py-2 text-right font-medium">Avg monthly</th>
              </tr>
            </thead>
            <tbody>
              {c.acquisition.map((r) => (
                <tr key={r.label} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5">{r.label}</td>
                  <td className="py-2.5 text-right tabular">{num(r.customers)}</td>
                  <td className="py-2.5 text-right tabular">{num(r.active)}</td>
                  <td className="py-2.5 text-right tabular">{num(r.churned)}</td>
                  <td className="py-2.5 text-right">
                    <span className="inline-block rounded px-1.5 py-0.5 tabular" style={{ backgroundColor: cellColor(1 - r.churnRate) }}>
                      {pct(r.churnRate)}
                    </span>
                  </td>
                  <td className="py-2.5 text-right tabular">{usd(r.avgMonthly, 2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  )
}
