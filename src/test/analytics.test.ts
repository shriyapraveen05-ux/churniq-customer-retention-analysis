import { beforeAll, describe, expect, it } from 'vitest'
import bundledCsv from '@/data/telco-customer-churn.csv?raw'
import { buildAnalysis, type Analysis, type Prepared } from '@/lib/analytics/analysis'
import { RISK_THRESHOLDS, riskCategory } from '@/lib/analytics/model'
import { SEGMENTS, applyFilters } from '@/lib/analytics/segments'
import { getDefaultDataset, prepare } from '@/lib/analytics/store.server'
import { handleSection, handleUpload } from '@/lib/analytics/http.server'
import { DEFAULT_FILTERS } from '@/lib/analytics/types'

const ALL = { ...DEFAULT_FILTERS, tenureMax: 1000 }
let p: Prepared
let a: Analysis

beforeAll(async () => {
  p = await getDefaultDataset()
  a = buildAnalysis(p, ALL)
}, 60_000)

const sum = (xs: number[]) => xs.reduce((s, v) => s + v, 0)

describe('dataset cleaning', () => {
  it('loads every IBM Telco record and column', () => {
    expect(p.report.rawRecords).toBe(7043)
    expect(p.report.rawAttributes).toBe(21)
    expect(p.report.finalRecords).toBe(7043)
  })

  it('converts the 11 blank TotalCharges (tenure 0) to 0', () => {
    const tc = p.report.missingByColumn.find((m) => m.column === 'TotalCharges')
    expect(tc?.count).toBe(11)
    const zeroTenure = p.customers.filter((c) => c.tenure === 0)
    expect(zeroTenure).toHaveLength(11)
    expect(zeroTenure.every((c) => c.totalCharges === 0)).toBe(true)
  })
})

describe('KPIs', () => {
  it('active + churned customers equal total customers', () => {
    expect(a.kpis.totalCustomers).toBe(7043)
    expect(a.kpis.churnedCustomers).toBe(1869)
    expect(a.kpis.activeCustomers + a.kpis.churnedCustomers).toBe(a.kpis.totalCustomers)
  })

  it('churn rate is churned ÷ total and retention is its complement', () => {
    expect(a.kpis.churnRate).toBeCloseTo(1869 / 7043, 12)
    expect(a.kpis.retentionRate).toBeCloseTo(5174 / 7043, 12)
  })

  it('every built-in consistency check passes', () => {
    expect(a.validation.filter((v) => !v.passed)).toEqual([])
  })
})

describe('segments', () => {
  it('segment sizes match their rules', () => {
    for (const s of SEGMENTS) {
      const seg = a.segments.find((x) => x.key === s.key)!
      expect(seg.customers).toBe(p.customers.filter((c) => s.test(c, p.thresholds)).length)
    }
    const byKey = Object.fromEntries(a.segments.map((s) => [s.key, s.customers]))
    expect(byKey.new).toBe(2186)
    expect(byKey.long_term).toBe(2303)
    expect(byKey.month_to_month).toBe(3875)
    expect(byKey.recently_churned).toBe(1869)
  })

  it('high-churn-risk customers are active and scored High', () => {
    const hr = p.customers.filter((c) => SEGMENTS.find((s) => s.key === 'high_risk')!.test(c, p.thresholds))
    expect(hr.length).toBeGreaterThan(0)
    expect(hr.every((c) => !c.churn && (c.riskScore ?? 0) >= RISK_THRESHOLDS.high)).toBe(true)
  })
})

describe('revenue', () => {
  it('lost monthly revenue sums churned customers only', () => {
    expect(a.revenue.lostMRR).toBeCloseTo(139130.85, 2)
    expect(a.revenue.activeMRR).toBeCloseTo(316985.75, 2)
  })

  it('revenue at risk sums active High-risk customers only', () => {
    const expected = sum(p.customers.filter((c) => !c.churn && c.riskCategory === 'High').map((c) => c.monthlyCharges))
    expect(a.revenue.highRiskMRR).toBeCloseTo(expected, 6)
    expect(a.kpis.revenueAtRisk).toBeCloseTo(expected, 6)
  })
})

describe('risk categories', () => {
  it('High ≥ 70%, Medium ≥ 40%, otherwise Low', () => {
    expect(riskCategory(0.7)).toBe('High')
    expect(riskCategory(0.6999)).toBe('Medium')
    expect(riskCategory(0.4)).toBe('Medium')
    expect(riskCategory(0.3999)).toBe('Low')
  })
})

describe('filters', () => {
  it('contract and payment filters recalculate the population', () => {
    expect(buildAnalysis(p, { ...ALL, contract: 'Month-to-month' }).population).toBe(3875)
    const echeck = buildAnalysis(p, { ...ALL, payment: 'Electronic check' })
    expect(echeck.population).toBe(p.customers.filter((c) => c.paymentMethod === 'Electronic check').length)
    expect(echeck.kpis.activeCustomers + echeck.kpis.churnedCustomers).toBe(echeck.population)
  })

  it('risk filter keeps only that risk category', () => {
    const list = applyFilters(p.customers, { ...ALL, risk: 'High' }, p.thresholds)
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((c) => c.riskCategory === 'High')).toBe(true)
  })
})

describe('small datasets', () => {
  it('fall back to rule-based risk scores when too small to train a model', () => {
    const small = bundledCsv.split('\n').slice(0, 151).join('\n')
    const sp = prepare(small, 'small.csv', 'upload', 'small')
    expect(sp.model.evaluation.method).toBe('rule_based')
  })
})

describe('API endpoints', () => {
  it('GET /api/overview returns the ok envelope with backend KPIs', async () => {
    const res = await handleSection(new Request('http://x/api/overview?contract=Two%20year'), 'overview')
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.ok).toBe(true)
    expect(json.data.population).toBe(p.customers.filter((c) => c.contract === 'Two year').length)
    expect(json.meta.records).toBe(7043)
  })

  it('POST /api/upload-dataset rejects a CSV without required columns', async () => {
    const res = await handleUpload(
      new Request('http://x/api/upload-dataset', { method: 'POST', headers: { 'content-type': 'text/csv' }, body: 'a,b\n1,2\n' }),
    )
    const json = await res.json()
    expect(res.status).toBe(400)
    expect(json.ok).toBe(false)
    expect(json.error).toMatch(/customerID/)
  })

  it('GET /api/customer-risk searches customers by ID', async () => {
    const id = p.customers[0].id
    const res = await handleSection(new Request(`http://x/api/customer-risk?q=${id}`), 'customer-risk')
    const json = await res.json()
    expect(json.data.customers.rows[0].id).toBe(id)
  })
})
