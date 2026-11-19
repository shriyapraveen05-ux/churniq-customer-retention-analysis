
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { BreakdownRow } from '@/lib/analytics/analysis'
import { axisProps, ChartTooltip, tooltipCursor } from './chart-kit'
import { COLORS } from './primitives'
import { num, pct } from '@/lib/format'

export function ChurnRateBars({
  rows,
  overall,
  layout = 'horizontal',
  height = 224,
}: {
  rows: BreakdownRow[]
  overall: number
  layout?: 'horizontal' | 'vertical'
  height?: number
}) {
  const vertical = layout === 'vertical'
  return (
    <div style={{ height }}>
      <ResponsiveContainer>
        <BarChart data={rows} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 8, right: vertical ? 24 : 5, left: vertical ? 10 : -15, bottom: 0 }}>
          <CartesianGrid vertical={vertical} horizontal={!vertical} />
          {vertical ? (
            <>
              <XAxis type="number" {...axisProps} tickFormatter={(v) => pct(v, 0)} />
              <YAxis type="category" dataKey="label" {...axisProps} width={150} />
              <ReferenceLine x={overall} stroke={COLORS.muted} strokeDasharray="3 3" />
            </>
          ) : (
            <>
              <XAxis dataKey="label" {...axisProps} interval={0} />
              <YAxis {...axisProps} tickFormatter={(v) => pct(v, 0)} />
              <ReferenceLine y={overall} stroke={COLORS.muted} strokeDasharray="3 3" />
            </>
          )}
          <Tooltip
            cursor={tooltipCursor}
            content={({ active, payload, label }) => {
              const row = payload?.[0]?.payload as BreakdownRow | undefined
              if (!active || !row) return null
              return (
                <ChartTooltip
                  active
                  label={String(label ?? row.label)}
                  payload={[
                    { name: 'Churn rate', value: row.churnRate, color: COLORS.coral } as never,
                    { name: 'Customers', value: row.customers, color: COLORS.blue } as never,
                    { name: 'Churned', value: row.churned, color: COLORS.amber } as never,
                  ]}
                  format={(v, n) => (n === 'Churn rate' ? pct(v) : num(v))}
                />
              )
            }}
          />
          <Bar dataKey="churnRate" name="Churn rate" radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36}>
            {rows.map((r) => (
              <Cell key={r.label} fill={r.churnRate > overall * 1.1 ? COLORS.coral : r.churnRate < overall * 0.9 ? COLORS.teal : COLORS.amber} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function explainBreakdown(rows: BreakdownRow[], overall: number, noun: string) {
  if (rows.length < 2) return null
  const sorted = [...rows].filter((r) => r.customers >= 30).sort((a, b) => b.churnRate - a.churnRate)
  if (sorted.length < 2) return null
  const hi = sorted[0]
  const lo = sorted[sorted.length - 1]
  const ratio = lo.churnRate > 0 ? hi.churnRate / lo.churnRate : null
  return `${hi.label} has the highest churn by ${noun} (${pct(hi.churnRate)}, ${num(hi.churned)} customers) versus ${pct(lo.churnRate)} for ${lo.label}${
    ratio ? ` — ${ratio.toFixed(1)}× higher` : ''
  }. Overall rate: ${pct(overall)}.`
}
