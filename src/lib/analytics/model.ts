import { mulberry32, rocAuc, shuffle } from './stats'
import type { Customer, RiskCategory, RiskInfo, Thresholds } from './types'

interface FeatureDef {
  key: string
  label: string
  kind: 'numeric' | 'binary'
  get: (c: Customer) => number
  /** Explanation shown when this feature pushes a customer's risk up. */
  present?: (c: Customer) => string
  absent?: (c: Customer) => string | null
  explain?: boolean
}

const hasInternet = (c: Customer) => c.internetService !== 'No' && c.internetService !== 'Unknown'

const FEATURES: FeatureDef[] = [
  { key: 'tenure', label: 'Tenure (months)', kind: 'numeric', get: (c) => c.tenure, present: (c) => `Short tenure (${c.tenure} mo)` },
  {
    key: 'monthly',
    label: 'Monthly charges',
    kind: 'numeric',
    get: (c) => c.monthlyCharges,
    present: (c) => `High monthly charges ($${c.monthlyCharges.toFixed(0)})`,
  },
  { key: 'total_log', label: 'Total charges (log)', kind: 'numeric', get: (c) => Math.log1p(c.totalCharges), explain: false },
  { key: 'senior', label: 'Senior citizen', kind: 'binary', get: (c) => +c.senior, present: () => 'Senior citizen' },
  { key: 'partner', label: 'Has partner', kind: 'binary', get: (c) => +c.partner, absent: () => 'No partner on account' },
  { key: 'dependents', label: 'Has dependents', kind: 'binary', get: (c) => +c.dependents, absent: () => 'No dependents' },
  { key: 'male', label: 'Gender: male', kind: 'binary', get: (c) => +(c.gender === 'Male'), explain: false },
  { key: 'phone', label: 'Phone service', kind: 'binary', get: (c) => +c.phoneService, explain: false },
  { key: 'multi_lines', label: 'Multiple lines', kind: 'binary', get: (c) => +(c.multipleLines === 'Yes'), present: () => 'Multiple phone lines' },
  { key: 'paperless', label: 'Paperless billing', kind: 'binary', get: (c) => +c.paperlessBilling, present: () => 'Paperless billing' },
  { key: 'inet_dsl', label: 'Internet: DSL', kind: 'binary', get: (c) => +(c.internetService === 'DSL'), explain: false },
  { key: 'inet_fiber', label: 'Internet: Fiber optic', kind: 'binary', get: (c) => +(c.internetService === 'Fiber optic'), present: () => 'Fiber optic internet' },
  { key: 'inet_none', label: 'No internet service', kind: 'binary', get: (c) => +(c.internetService === 'No'), explain: false },
  {
    key: 'security',
    label: 'Online security',
    kind: 'binary',
    get: (c) => +(c.onlineSecurity === 'Yes'),
    absent: (c) => (hasInternet(c) ? 'No online security' : null),
  },
  {
    key: 'backup',
    label: 'Online backup',
    kind: 'binary',
    get: (c) => +(c.onlineBackup === 'Yes'),
    absent: (c) => (hasInternet(c) ? 'No online backup' : null),
  },
  {
    key: 'protection',
    label: 'Device protection',
    kind: 'binary',
    get: (c) => +(c.deviceProtection === 'Yes'),
    absent: (c) => (hasInternet(c) ? 'No device protection' : null),
  },
  {
    key: 'techsupport',
    label: 'Tech support',
    kind: 'binary',
    get: (c) => +(c.techSupport === 'Yes'),
    absent: (c) => (hasInternet(c) ? 'No tech support' : null),
  },
  { key: 'stream_tv', label: 'Streaming TV', kind: 'binary', get: (c) => +(c.streamingTV === 'Yes'), present: () => 'Streaming TV subscriber' },
  { key: 'stream_movies', label: 'Streaming movies', kind: 'binary', get: (c) => +(c.streamingMovies === 'Yes'), present: () => 'Streaming movies subscriber' },
  { key: 'contract_m2m', label: 'Contract: Month-to-month', kind: 'binary', get: (c) => +(c.contract === 'Month-to-month'), present: () => 'Month-to-month contract' },
  { key: 'contract_1y', label: 'Contract: One year', kind: 'binary', get: (c) => +(c.contract === 'One year'), explain: false },
  { key: 'contract_2y', label: 'Contract: Two year', kind: 'binary', get: (c) => +(c.contract === 'Two year'), explain: false },
  { key: 'pay_echeck', label: 'Payment: Electronic check', kind: 'binary', get: (c) => +(c.paymentMethod === 'Electronic check'), present: () => 'Pays by electronic check' },
  { key: 'pay_mail', label: 'Payment: Mailed check', kind: 'binary', get: (c) => +(c.paymentMethod === 'Mailed check'), present: () => 'Pays by mailed check' },
  { key: 'pay_bank', label: 'Payment: Bank transfer (auto)', kind: 'binary', get: (c) => +(c.paymentMethod === 'Bank transfer (automatic)'), explain: false },
  { key: 'pay_card', label: 'Payment: Credit card (auto)', kind: 'binary', get: (c) => +(c.paymentMethod === 'Credit card (automatic)'), explain: false },
]

const ACTIONS: Record<string, string> = {
  contract_m2m: 'Offer a discounted 12-month contract upgrade',
  tenure: 'Enrol in early-life onboarding and 30/60/90-day check-ins',
  pay_echeck: 'Incentivise a switch to automatic payment',
  pay_mail: 'Incentivise a switch to automatic payment',
  inet_fiber: 'Proactive fiber service-quality review',
  monthly: 'Review plan fit and offer a right-sized bundle',
  techsupport: 'Offer a complimentary tech support trial',
  security: 'Bundle the online security add-on',
  backup: 'Bundle online backup into the current plan',
  protection: 'Offer device protection at an introductory rate',
  senior: 'Assign an assisted-support specialist',
  paperless: 'Send a monthly billing transparency summary',
  partner: 'Promote household / family plan benefits',
  dependents: 'Promote household / family plan benefits',
  stream_tv: 'Review streaming bundle value',
  stream_movies: 'Review streaming bundle value',
  multi_lines: 'Review multi-line pricing',
  rule_m2m: 'Offer a discounted 12-month contract upgrade',
  rule_tenure: 'Enrol in early-life onboarding and 30/60/90-day check-ins',
  rule_echeck: 'Incentivise a switch to automatic payment',
  rule_fiber: 'Proactive fiber service-quality review',
  rule_support: 'Offer a complimentary tech support trial',
  rule_security: 'Bundle the online security add-on',
  rule_charges: 'Review plan fit and offer a right-sized bundle',
  rule_senior: 'Assign an assisted-support specialist',
}

export const RISK_THRESHOLDS = { high: 0.7, medium: 0.4 }

export function riskCategory(score: number): RiskCategory {
  if (score >= RISK_THRESHOLDS.high) return 'High'
  if (score >= RISK_THRESHOLDS.medium) return 'Medium'
  return 'Low'
}

interface Scaler {
  mean: Float64Array
  std: Float64Array
}

interface LogRegModel {
  w: Float64Array
  b: number
  scaler: Scaler
}

function encode(customers: Customer[]): Float64Array[] {
  return customers.map((c) => Float64Array.from(FEATURES.map((f) => f.get(c))))
}

function fitScaler(X: Float64Array[]): Scaler {
  const d = FEATURES.length
  const m = new Float64Array(d)
  const s = new Float64Array(d)
  for (const x of X) for (let j = 0; j < d; j++) m[j] += x[j]
  for (let j = 0; j < d; j++) m[j] /= X.length
  for (const x of X) for (let j = 0; j < d; j++) s[j] += (x[j] - m[j]) ** 2
  for (let j = 0; j < d; j++) {
    s[j] = Math.sqrt(s[j] / Math.max(1, X.length - 1))
    if (s[j] < 1e-9) s[j] = 1
  }
  return { mean: m, std: s }
}

function standardize(x: Float64Array, sc: Scaler): Float64Array {
  const z = new Float64Array(x.length)
  for (let j = 0; j < x.length; j++) z[j] = (x[j] - sc.mean[j]) / sc.std[j]
  return z
}

const sigmoid = (v: number) => 1 / (1 + Math.exp(-v))

/** L2-regularised logistic regression with balanced class weights, optimised with full-batch Adam. */
function trainLogReg(X: Float64Array[], y: number[], iterations = 500, lambda = 0.01): LogRegModel {
  const scaler = fitScaler(X)
  const Z = X.map((x) => standardize(x, scaler))
  const n = Z.length
  const d = FEATURES.length
  const pos = y.reduce((s, v) => s + v, 0)
  const wPos = n / (2 * Math.max(1, pos))
  const wNeg = n / (2 * Math.max(1, n - pos))
  const sw = y.map((v) => (v ? wPos : wNeg))
  const swSum = sw.reduce((s, v) => s + v, 0)

  const w = new Float64Array(d)
  let b = 0
  const mW = new Float64Array(d)
  const vW = new Float64Array(d)
  let mB = 0
  let vB = 0
  const lr = 0.05
  const b1 = 0.9
  const b2 = 0.999
  const eps = 1e-8
  const grad = new Float64Array(d)

  for (let it = 1; it <= iterations; it++) {
    grad.fill(0)
    let gB = 0
    for (let i = 0; i < n; i++) {
      const z = Z[i]
      let dot = b
      for (let j = 0; j < d; j++) dot += w[j] * z[j]
      const err = (sigmoid(dot) - y[i]) * sw[i]
      gB += err
      for (let j = 0; j < d; j++) grad[j] += err * z[j]
    }
    gB /= swSum
    mB = b1 * mB + (1 - b1) * gB
    vB = b2 * vB + (1 - b2) * gB * gB
    b -= (lr * (mB / (1 - b1 ** it))) / (Math.sqrt(vB / (1 - b2 ** it)) + eps)
    for (let j = 0; j < d; j++) {
      const g = grad[j] / swSum + lambda * w[j]
      mW[j] = b1 * mW[j] + (1 - b1) * g
      vW[j] = b2 * vW[j] + (1 - b2) * g * g
      w[j] -= (lr * (mW[j] / (1 - b1 ** it))) / (Math.sqrt(vW[j] / (1 - b2 ** it)) + eps)
    }
  }
  return { w, b, scaler }
}

function predict(model: LogRegModel, x: Float64Array): number {
  const z = standardize(x, model.scaler)
  let dot = model.b
  for (let j = 0; j < z.length; j++) dot += model.w[j] * z[j]
  return sigmoid(dot)
}

function stratifiedFolds(y: number[], k: number, seed: number): number[] {
  const rand = mulberry32(seed)
  const fold = new Array<number>(y.length)
  for (const cls of [0, 1]) {
    const idx = shuffle(
      y.map((v, i) => (v === cls ? i : -1)).filter((i) => i >= 0),
      rand,
    )
    idx.forEach((i, pos) => (fold[i] = pos % k))
  }
  return fold
}

function confusion(scores: number[], y: number[], threshold: number) {
  let tp = 0
  let fp = 0
  let tn = 0
  let fn = 0
  for (let i = 0; i < y.length; i++) {
    const pred = scores[i] >= threshold ? 1 : 0
    if (pred && y[i]) tp++
    else if (pred && !y[i]) fp++
    else if (!pred && y[i]) fn++
    else tn++
  }
  const precision = tp + fp ? tp / (tp + fp) : 0
  const recall = tp + fn ? tp / (tp + fn) : 0
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  return { tp, fp, tn, fn, precision, recall, f1, accuracy: (tp + tn) / y.length }
}

export interface ModelEvaluation {
  method: 'logistic_regression' | 'rule_based'
  reason?: string
  trainSize: number
  testSize: number
  featureCount: number
  positiveRateTrain: number
  threshold: number
  metrics: { accuracy: number; precision: number; recall: number; f1: number; rocAuc: number; baselineAccuracy: number }
  confusion: { tp: number; fp: number; tn: number; fn: number }
  roc: { fpr: number; tpr: number }[]
  cv: { folds: number; aucs: number[]; mean: number; std: number }
  importance: { key: string; label: string; coefficient: number; oddsRatio: number }[]
}

export interface ModelOutput {
  evaluation: ModelEvaluation
  risk: RiskInfo[] // aligned with customers array
}

function explainModel(model: LogRegModel, x: Float64Array, c: Customer) {
  const z = standardize(x, model.scaler)
  const factors: { key: string; label: string; weight: number }[] = []
  FEATURES.forEach((f, j) => {
    if (f.explain === false) return
    const contribution = model.w[j] * z[j]
    if (contribution <= 0.08) return
    let label: string | null | undefined
    if (f.kind === 'numeric') label = f.present?.(c)
    else label = x[j] === 1 ? f.present?.(c) : f.absent?.(c)
    if (label) factors.push({ key: f.key, label, weight: contribution })
  })
  return factors.sort((a, b) => b.weight - a.weight).slice(0, 4)
}

function toRisk(score: number, factors: { key: string; label: string; weight: number }[]): RiskInfo {
  const category = riskCategory(score)
  const action =
    category === 'Low'
      ? 'No intervention needed — monitor in standard cadence'
      : (factors[0] && ACTIONS[factors[0].key]) || 'Schedule a customer success check-in'
  return { score, category, factors, action }
}

/** Transparent, rule-based fallback used when a model cannot be trained reliably. */
export function ruleBasedRisk(c: Customer, t: Thresholds): RiskInfo {
  const rules: { key: string; label: string; weight: number; hit: boolean }[] = [
    { key: 'rule_m2m', label: 'Month-to-month contract', weight: 30, hit: c.contract === 'Month-to-month' },
    { key: 'rule_tenure', label: `Short tenure (${c.tenure} mo)`, weight: c.tenure <= 6 ? 25 : 15, hit: c.tenure <= 12 },
    { key: 'rule_echeck', label: 'Pays by electronic check', weight: 15, hit: c.paymentMethod === 'Electronic check' },
    { key: 'rule_fiber', label: 'Fiber optic internet', weight: 10, hit: c.internetService === 'Fiber optic' },
    { key: 'rule_support', label: 'No tech support', weight: 10, hit: hasInternet(c) && c.techSupport !== 'Yes' },
    { key: 'rule_security', label: 'No online security', weight: 10, hit: hasInternet(c) && c.onlineSecurity !== 'Yes' },
    {
      key: 'rule_charges',
      label: `High monthly charges ($${c.monthlyCharges.toFixed(0)})`,
      weight: 10,
      hit: c.monthlyCharges >= t.monthlyP75,
    },
    { key: 'rule_senior', label: 'Senior citizen', weight: 5, hit: c.senior },
  ]
  const hits = rules.filter((r) => r.hit)
  const score = Math.min(100, hits.reduce((s, r) => s + r.weight, 0)) / 100
  return toRisk(
    score,
    hits.sort((a, b) => b.weight - a.weight).map(({ key, label, weight }) => ({ key, label, weight: weight / 100 })),
  )
}

export function buildModel(customers: Customer[], thresholds: Thresholds): ModelOutput {
  const y: number[] = customers.map((c) => (c.churn ? 1 : 0))
  const positives = y.reduce((s, v) => s + v, 0)
  const negatives = y.length - positives

  if (customers.length < 200 || positives < 30 || negatives < 30) {
    return {
      evaluation: {
        method: 'rule_based',
        reason: `A reliable model needs at least 200 records and 30 examples of each class (found ${customers.length} records, ${positives} churned, ${negatives} retained).`,
        trainSize: 0,
        testSize: 0,
        featureCount: 0,
        positiveRateTrain: positives / customers.length,
        threshold: 0.5,
        metrics: { accuracy: 0, precision: 0, recall: 0, f1: 0, rocAuc: 0, baselineAccuracy: 0 },
        confusion: { tp: 0, fp: 0, tn: 0, fn: 0 },
        roc: [],
        cv: { folds: 0, aucs: [], mean: 0, std: 0 },
        importance: [],
      },
      risk: customers.map((c) => ruleBasedRisk(c, thresholds)),
    }
  }

  const X = encode(customers)

  // 1) Hold-out evaluation: stratified 75/25 split (seed 42)
  const splitFold = stratifiedFolds(y, 4, 42)
  const trainIdx: number[] = []
  const testIdx: number[] = []
  splitFold.forEach((f, i) => (f === 0 ? testIdx : trainIdx).push(i))
  const model = trainLogReg(
    trainIdx.map((i) => X[i]),
    trainIdx.map((i) => y[i]),
  )
  const testScores = testIdx.map((i) => predict(model, X[i]))
  const testY = testIdx.map((i) => y[i])
  const threshold = 0.5
  const cm = confusion(testScores, testY, threshold)
  const auc = rocAuc(testScores, testY)
  const testPos = testY.reduce<number>((s, v) => s + v, 0)
  const roc: { fpr: number; tpr: number }[] = []
  for (let k = 0; k <= 50; k++) {
    const t = 1 - k / 50
    const c = confusion(testScores, testY, t)
    roc.push({ fpr: c.fp / Math.max(1, c.fp + c.tn), tpr: c.tp / Math.max(1, c.tp + c.fn) })
  }
  roc.push({ fpr: 1, tpr: 1 })

  // 2) 5-fold stratified cross-validation -> out-of-fold risk scores (no customer scored by a model trained on it)
  const k = 5
  const folds = stratifiedFolds(y, k, 7)
  const oof = new Array<number>(customers.length).fill(0)
  const foldModels: LogRegModel[] = []
  const aucs: number[] = []
  for (let f = 0; f < k; f++) {
    const tr: number[] = []
    const te: number[] = []
    folds.forEach((ff, i) => (ff === f ? te : tr).push(i))
    const m = trainLogReg(
      tr.map((i) => X[i]),
      tr.map((i) => y[i]),
      350,
    )
    foldModels.push(m)
    const s = te.map((i) => predict(m, X[i]))
    te.forEach((i, p) => (oof[i] = s[p]))
    aucs.push(rocAuc(s, te.map((i) => y[i])))
  }
  const cvMean = aucs.reduce((s, v) => s + v, 0) / k
  const cvStd = Math.sqrt(aucs.reduce((s, v) => s + (v - cvMean) ** 2, 0) / (k - 1))

  const risk = customers.map((c, i) => toRisk(oof[i], explainModel(foldModels[folds[i]], X[i], c)))

  const importance = FEATURES.map((f, j) => ({
    key: f.key,
    label: f.label,
    coefficient: model.w[j],
    oddsRatio: Math.exp(model.w[j]),
  })).sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient))

  return {
    evaluation: {
      method: 'logistic_regression',
      trainSize: trainIdx.length,
      testSize: testIdx.length,
      featureCount: FEATURES.length,
      positiveRateTrain: trainIdx.reduce((s, i) => s + y[i], 0) / trainIdx.length,
      threshold,
      metrics: {
        accuracy: cm.accuracy,
        precision: cm.precision,
        recall: cm.recall,
        f1: cm.f1,
        rocAuc: auc,
        baselineAccuracy: Math.max(testPos, testY.length - testPos) / testY.length,
      },
      confusion: { tp: cm.tp, fp: cm.fp, tn: cm.tn, fn: cm.fn },
      roc,
      cv: { folds: k, aucs, mean: cvMean, std: cvStd },
      importance,
    },
    risk,
  }
}
