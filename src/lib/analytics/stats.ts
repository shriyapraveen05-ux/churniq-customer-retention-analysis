export function sum(values: number[]): number {
  let s = 0
  for (const v of values) s += v
  return s
}

export function mean(values: number[]): number {
  return values.length ? sum(values) / values.length : 0
}

export function variance(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  let s = 0
  for (const v of values) s += (v - m) ** 2
  return s / (values.length - 1)
}

export function std(values: number[]): number {
  return Math.sqrt(variance(values))
}

export function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function sortedCopy(values: number[]): number[] {
  return [...values].sort((a, b) => a - b)
}

export function pearson(x: number[], y: number[]): number {
  const n = x.length
  if (n < 3) return 0
  const mx = mean(x)
  const my = mean(y)
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const a = x[i] - mx
    const b = y[i] - my
    num += a * b
    dx += a * a
    dy += b * b
  }
  if (dx === 0 || dy === 0) return 0
  return num / Math.sqrt(dx * dy)
}

/** Abramowitz–Stegun approximation of the error function. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax)
  return sign * y
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/** Welch's two-sample t-test. p-value uses a normal approximation (valid for large samples). */
export function welchTTest(a: number[], b: number[]) {
  const ma = mean(a)
  const mb = mean(b)
  const va = variance(a)
  const vb = variance(b)
  const se = Math.sqrt(va / a.length + vb / b.length)
  const t = se === 0 ? 0 : (ma - mb) / se
  const df =
    se === 0
      ? 0
      : (va / a.length + vb / b.length) ** 2 /
        ((va / a.length) ** 2 / (a.length - 1) + (vb / b.length) ** 2 / (b.length - 1))
  const p = 2 * (1 - normalCdf(Math.abs(t)))
  const pooled = Math.sqrt(((a.length - 1) * va + (b.length - 1) * vb) / (a.length + b.length - 2))
  const d = pooled === 0 ? 0 : (ma - mb) / pooled
  return { t, df, p, cohensD: d }
}

/** Chi-square test of independence for a k x 2 table (category x churn). */
export function chiSquare(table: { churned: number; retained: number }[]) {
  const rows = table.filter((r) => r.churned + r.retained > 0)
  const n = sum(rows.map((r) => r.churned + r.retained))
  const colC = sum(rows.map((r) => r.churned))
  const colR = n - colC
  let chi = 0
  for (const r of rows) {
    const rowTotal = r.churned + r.retained
    const eC = (rowTotal * colC) / n
    const eR = (rowTotal * colR) / n
    if (eC > 0) chi += (r.churned - eC) ** 2 / eC
    if (eR > 0) chi += (r.retained - eR) ** 2 / eR
  }
  const df = Math.max(1, rows.length - 1)
  // Wilson–Hilferty transformation of chi-square to an approximate standard normal
  const z = (Math.cbrt(chi / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df))
  const p = rows.length < 2 ? 1 : 1 - normalCdf(z)
  const cramersV = n > 0 && rows.length > 1 ? Math.sqrt(chi / n) : 0
  return { chi, df, p, cramersV }
}

/** Area under ROC curve via the rank-sum (Mann–Whitney U) formulation, handling ties. */
export function rocAuc(scores: number[], labels: number[]): number {
  const idx = scores.map((s, i) => [s, labels[i]] as const).sort((a, b) => a[0] - b[0])
  let rankSumPos = 0
  let nPos = 0
  let i = 0
  while (i < idx.length) {
    let j = i
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++
    const avgRank = (i + j + 2) / 2
    for (let k = i; k <= j; k++) {
      if (idx[k][1] === 1) {
        rankSumPos += avgRank
        nPos++
      }
    }
    i = j + 1
  }
  const nNeg = idx.length - nPos
  if (nPos === 0 || nNeg === 0) return 0.5
  return (rankSumPos - (nPos * (nPos + 1)) / 2) / (nPos * nNeg)
}

/** Deterministic PRNG so analysis results are reproducible. */
export function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
