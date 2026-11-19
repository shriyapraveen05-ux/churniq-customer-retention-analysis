export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`
export const num = (v: number, digits = 0) =>
  v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
export const usd = (v: number, digits = 0) =>
  `$${v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
export const usdCompact = (v: number) =>
  Math.abs(v) >= 1_000_000
    ? `$${(v / 1_000_000).toFixed(2)}M`
    : Math.abs(v) >= 10_000
      ? `$${(v / 1000).toFixed(1)}k`
      : usd(v)
export const pvalue = (p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3))
