export interface Customer {
  id: string
  gender: string
  senior: boolean
  partner: boolean
  dependents: boolean
  tenure: number
  phoneService: boolean
  multipleLines: string
  internetService: string
  onlineSecurity: string
  onlineBackup: string
  deviceProtection: string
  techSupport: string
  streamingTV: string
  streamingMovies: string
  contract: string
  paperlessBilling: boolean
  paymentMethod: string
  monthlyCharges: number
  totalCharges: number
  churn: boolean
  // derived features
  tenureGroup: string
  chargeBand: string
  totalBand: string
  protectiveAddons: number
  serviceCount: number
  // assigned after scoring (model probability or rule-based score)
  riskScore?: number
  riskCategory?: RiskCategory
}

export type SegmentKey =
  | 'new'
  | 'long_term'
  | 'high_value'
  | 'month_to_month'
  | 'price_sensitive'
  | 'high_risk'
  | 'recently_churned'

export interface Filters {
  tenureMin: number
  tenureMax: number
  contract: string
  internet: string
  payment: string
  addon: AddonKey | 'all'
  risk: RiskCategory | 'all'
  segment: SegmentKey | 'all'
}

export type AddonKey =
  | 'online_security'
  | 'tech_support'
  | 'online_backup'
  | 'device_protection'
  | 'streaming'
  | 'phone_only'
  | 'no_addons'

export const DEFAULT_FILTERS: Filters = {
  tenureMin: 0,
  tenureMax: 72,
  contract: 'all',
  internet: 'all',
  payment: 'all',
  addon: 'all',
  risk: 'all',
  segment: 'all',
}

export interface Thresholds {
  monthlyMedian: number
  monthlyP75: number
  maxTenure: number
}

export type RiskCategory = 'High' | 'Medium' | 'Low'

export interface RiskInfo {
  score: number
  category: RiskCategory
  factors: { key: string; label: string; weight: number }[]
  action: string
}

export interface ColumnProfile {
  name: string
  rawType: string
  cleanedType: string
  missing: number
  unique: number
  example: string
}

export interface PipelineStep {
  title: string
  detail: string
  affected: number
}

export interface NumericSummary {
  column: string
  count: number
  mean: number
  std: number
  min: number
  q1: number
  median: number
  q3: number
  max: number
}

export interface CategoricalSummary {
  column: string
  unique: number
  top: string
  freq: number
  values: { value: string; count: number }[]
}

export interface DataReport {
  sourceName: string
  sourceKind: 'bundled' | 'upload'
  processedAt: string
  rawRecords: number
  rawAttributes: number
  finalRecords: number
  missingTotal: number
  missingByColumn: { column: string; count: number; treatment: string }[]
  duplicateRows: number
  duplicateIds: number
  invalidRecords: number
  columns: ColumnProfile[]
  steps: PipelineStep[]
  warnings: string[]
  numericSummary: NumericSummary[]
  categoricalSummary: CategoricalSummary[]
  preview: Record<string, string>[]
  churnDistribution: { label: string; count: number; share: number }[]
}
