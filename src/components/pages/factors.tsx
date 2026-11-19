
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate, FilterSummary } from '@/components/churniq/analysis-gate'
import { Badge, ChartCard, COLORS, Note, PageHeader } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip, tooltipCursor } from '@/components/churniq/chart-kit'
import { ChurnRateBars, explainBreakdown } from '@/components/churniq/breakdown-chart'
import { num, pct, pvalue } from '@/lib/format'

export function FactorsPage() {
  return <AnalysisGate>{(a) => <Factors a={a} />}</AnalysisGate>
}

function heat(v: number) {
  const t = Math.min(1, Math.abs(v))
  return v >= 0 ? `rgba(71,125,255,${0.08 + t * 0.85})` : `rgba(240,108,121,${0.08 + t * 0.85})`
}

function effectLabel(v: number, kind: 'd' | 'v') {
  const x = Math.abs(v)
  const [s, m, l] = kind === 'd' ? [0.2, 0.5, 0.8] : [0.1, 0.3, 0.5]
  return x >= l ? 'Large' : x >= m ? 'Medium' : x >= s ? 'Small' : 'Negligible'
}

function Factors({ a }: { a: Analysis }) {
  const { variables, matrix } = a.correlation
  const churnIdx = variables.indexOf('Churn')
  const churnCorr = variables
    .map((v, i) => ({ v, r: matrix[churnIdx]?.[i] ?? 0 }))
    .filter((x) => x.v !== 'Churn')
    .sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
  const importance = a.model?.importance.slice(0, 12).map((f) => ({ ...f, abs: Math.abs(f.coefficient) })) ?? []
  const overall = a.kpis.churnRate
  const b = a.breakdowns

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Retention factors"
        title="Which factors are associated with churn"
        description="Correlation, hypothesis tests and a multivariable model help separate strong signals from noise. All results describe association in observational data — none of them prove causation."
        actions={<FilterSummary a={a} />}
      />

      <Note tone="amber">
        <strong>Association ≠ causation.</strong> For example, month-to-month customers churn more, but they also tend to be newer and pay more. A
        retention experiment (e.g. A/B-testing a contract incentive) is needed to establish whether changing a factor actually changes churn.
      </Note>

      <div className="grid gap-4 xl:grid-cols-5">
        <ChartCard
          className="xl:col-span-3"
          title="Correlation heatmap"
          description="Pearson correlation between numeric and binary-encoded features (Churn = 1). Blue = positive, coral = negative."
        >
          <div className="scrollbar-thin overflow-x-auto">
            <table className="border-separate border-spacing-0.5 text-[10px]" role="grid" aria-label="Correlation matrix">
              <thead>
                <tr>
                  <th />
                  {variables.map((v) => (
                    <th key={v} scope="col" className="h-24 w-9 align-bottom font-normal text-muted-foreground">
                      <span className="inline-block origin-bottom-left translate-x-4 -rotate-50 whitespace-nowrap">{v}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {variables.map((row, i) => (
                  <tr key={row}>
                    <th scope="row" className="whitespace-nowrap pr-2 text-right font-normal text-muted-foreground">
                      {row}
                    </th>
                    {variables.map((col, j) => {
                      const v = matrix[i][j]
                      return (
                        <td
                          key={col}
                          title={`${row} × ${col}: r = ${v.toFixed(3)}`}
                          className="size-9 rounded-[3px] text-center tabular text-foreground/90"
                          style={{ backgroundColor: heat(v), outline: row === 'Churn' || col === 'Churn' ? '1px solid rgba(146,112,255,0.35)' : undefined }}
                        >
                          {i === j ? '' : v.toFixed(2).replace('0.', '.')}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="Correlation with churn" description="Ranked by absolute strength (|r|).">
          <div className="h-[420px]">
            <ResponsiveContainer>
              <BarChart data={churnCorr} layout="vertical" margin={{ top: 0, right: 16, left: 10, bottom: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" {...axisProps} domain={[-0.5, 0.5]} />
                <YAxis type="category" dataKey="v" {...axisProps} width={120} />
                <ReferenceLine x={0} stroke={COLORS.muted} />
                <Tooltip cursor={tooltipCursor} content={<ChartTooltip format={(v) => `r = ${v.toFixed(3)}`} />} />
                <Bar dataKey="r" name="Correlation" barSize={12} radius={3}>
                  {churnCorr.map((c) => (
                    <Cell key={c.v} fill={c.r > 0 ? COLORS.coral : COLORS.teal} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {a.model && (
        <ChartCard
          title="Feature importance — logistic regression"
          description={`Standardised coefficients from the model trained on ${num(a.model.trainSize)} customers (test ROC-AUC ${a.model.metrics.rocAuc.toFixed(3)}). Coral = higher churn odds holding other features constant; teal = lower.`}
          footer="Coefficients are conditional associations: each one reflects a feature's relationship with churn after adjusting for the other features in the model. Correlated features (e.g. tenure and total charges) share explanatory power, so individual magnitudes should be read with care."
        >
          <div className="h-80">
            <ResponsiveContainer>
              <BarChart data={importance} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                <CartesianGrid horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis type="category" dataKey="label" {...axisProps} width={190} />
                <ReferenceLine x={0} stroke={COLORS.muted} />
                <Tooltip
                  cursor={tooltipCursor}
                  content={({ active, payload }) => {
                    const p = payload?.[0]?.payload as (typeof importance)[number] | undefined
                    if (!active || !p) return null
                    return (
                      <ChartTooltip
                        active
                        label={p.label}
                        payload={[
                          { name: 'Coefficient (β)', value: p.coefficient, color: COLORS.blue } as never,
                          { name: 'Odds ratio per 1 SD', value: p.oddsRatio, color: COLORS.violet } as never,
                        ]}
                        format={(v) => v.toFixed(3)}
                      />
                    )
                  }}
                />
                <Bar dataKey="coefficient" name="β" barSize={14} radius={3}>
                  {importance.map((f) => (
                    <Cell key={f.key} fill={f.coefficient > 0 ? COLORS.coral : COLORS.teal} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Numeric features — Welch t-tests" description="Churned vs retained means; Cohen's d measures effect size.">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 font-medium">Variable</th>
                <th className="py-2 text-right font-medium">Churned</th>
                <th className="py-2 text-right font-medium">Retained</th>
                <th className="py-2 text-right font-medium">p-value</th>
                <th className="py-2 text-right font-medium">Effect (d)</th>
              </tr>
            </thead>
            <tbody>
              {a.numericTests.map((t) => (
                <tr key={t.variable} className="border-b border-border/50 last:border-0">
                  <td className="py-2.5">{t.variable}</td>
                  <td className="py-2.5 text-right tabular">{t.churnedMean.toFixed(1)}</td>
                  <td className="py-2.5 text-right tabular">{t.retainedMean.toFixed(1)}</td>
                  <td className="py-2.5 text-right tabular">{pvalue(t.p)}</td>
                  <td className="py-2.5 text-right">
                    <Badge tone={Math.abs(t.cohensD) >= 0.5 ? 'violet' : 'neutral'}>
                      {t.cohensD.toFixed(2)} · {effectLabel(t.cohensD, 'd')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ChartCard>
        <ChartCard title="Categorical features — chi-square tests" description="Independence test vs churn; Cramér's V measures strength.">
          <div className="scrollbar-thin max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 font-medium">Variable</th>
                  <th className="py-2 font-medium">Highest churn</th>
                  <th className="py-2 text-right font-medium">p-value</th>
                  <th className="py-2 text-right font-medium">Cramér&apos;s V</th>
                </tr>
              </thead>
              <tbody>
                {a.categoricalTests.map((t) => (
                  <tr key={t.variable} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5">{t.variable}</td>
                    <td className="py-2.5 text-muted-foreground">
                      {t.highest?.label ?? "—"} <span className="text-negative tabular">{pct(t.highest?.churnRate ?? 0, 0)}</span>
                    </td>
                    <td className="py-2.5 text-right tabular">{pvalue(t.p)}</td>
                    <td className="py-2.5 text-right">
                      <Badge tone={t.cramersV >= 0.3 ? 'violet' : t.cramersV >= 0.1 ? 'blue' : 'neutral'}>
                        {t.cramersV.toFixed(2)} · {effectLabel(t.cramersV, 'v')}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard title="Contract duration" footer={explainBreakdown(b.contract.rows, overall, 'contract')}>
          <ChurnRateBars rows={b.contract.rows} overall={overall} height={180} />
        </ChartCard>
        <ChartCard title="Technical support" footer={explainBreakdown(b.techSupport.rows, overall, 'tech support')}>
          <ChurnRateBars rows={b.techSupport.rows} overall={overall} height={180} />
        </ChartCard>
        <ChartCard title="Online security" footer={explainBreakdown(b.onlineSecurity.rows, overall, 'online security')}>
          <ChurnRateBars rows={b.onlineSecurity.rows} overall={overall} height={180} />
        </ChartCard>
      </div>

      <Note>
        With ~7,000 customers, even small differences become statistically significant (p &lt; 0.05). Use the effect-size columns to judge
        business relevance: a significant but negligible effect is unlikely to justify investment.
      </Note>
    </div>
  )
}
