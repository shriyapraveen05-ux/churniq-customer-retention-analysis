import { CheckCircle2, RefreshCw, XCircle } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate } from '@/components/churniq/analysis-gate'
import { Badge, Card, ChartCard, Note, PageHeader, StatRow } from '@/components/churniq/primitives'
import { useAnalysis, useAnalyticsContext } from '@/components/providers/analytics-provider'
import { num } from '@/lib/format'

const ENDPOINTS: { method: 'GET' | 'POST'; path: string; returns: string }[] = [
  { method: 'GET', path: '/api/overview', returns: 'KPIs, comparison, insights, risk counts, revenue headline, validation checks' },
  { method: 'GET', path: '/api/dataset-info', returns: 'Records, columns, missing values, duplicates, cleaning steps, descriptive statistics' },
  { method: 'GET', path: '/api/churn-analysis', returns: 'Churn rate per category, service adoption, tenure-month hazard' },
  { method: 'GET', path: '/api/customer-behaviour', returns: 'Churned vs retained profile, distributions, high/low churn groups' },
  { method: 'GET', path: '/api/segments', returns: 'Segment rules plus size, churn, retention, tenure and charges per segment' },
  { method: 'GET', path: '/api/retention-factors', returns: 'Correlation matrix, chi-square and Welch t-tests, model coefficients' },
  { method: 'GET', path: '/api/customer-risk', returns: 'Risk method & thresholds, risk summary, paged customer list (q, sort, dir, page, pageSize)' },
  { method: 'GET', path: '/api/cohort-analysis', returns: 'Tenure-band survival (Kaplan–Meier) with methodology and limitations' },
  { method: 'GET', path: '/api/revenue-impact', returns: 'Revenue metrics with formulas; actuals and estimates labelled' },
  { method: 'GET', path: '/api/recommendations', returns: 'Conditional recommendations and insights' },
  { method: 'GET', path: '/api/model-performance', returns: 'Metrics, confusion matrix, ROC, cross-validation, coefficients' },
  { method: 'GET', path: '/api/analysis', returns: 'Everything above in one response (used by the dashboard)' },
  { method: 'POST', path: '/api/upload-dataset', returns: 'Validates and processes a CSV (multipart “file”, text/csv or JSON { csv, name })' },
]

export function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Settings & API"
        title="Dataset, validation and API"
        description="Which data the dashboard is using, whether its numbers reconcile, and the endpoints that serve every chart and table."
      />
      <AnalysisGate>{(a) => <Settings a={a} />}</AnalysisGate>
    </div>
  )
}

function Settings({ a }: { a: Analysis }) {
  const { upload, setUpload, resetFilters } = useAnalyticsContext()
  const { refetch, isValidating } = useAnalysis()
  const passed = a.validation.filter((v) => v.passed).length
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Active dataset</h3>
            <Badge tone={a.report.sourceKind === 'upload' ? 'violet' : 'blue'}>{a.report.sourceKind === 'upload' ? 'Uploaded' : 'Bundled'}</Badge>
          </div>
          <div className="divide-y divide-border">
            <StatRow label="Source" value={<span className="block max-w-64 truncate">{a.report.sourceName}</span>} />
            <StatRow label="Valid customer records" value={num(a.portfolioSize)} />
            <StatRow label="Processed" value={new Date(a.report.processedAt).toLocaleString('en-US')} />
            <StatRow label="Risk scoring" value={a.risk.method === 'logistic_regression' ? 'Logistic regression probabilities' : 'Rule-based score'} />
            <StatRow label="Dataset fingerprint" value={<code className="font-mono text-[11px]">{a.datasetHash}</code>} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              className="flex h-8 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-muted"
            >
              <RefreshCw className={isValidating ? 'size-3.5 animate-spin' : 'size-3.5'} /> Refresh results
            </button>
            <button type="button" onClick={resetFilters} className="h-8 rounded-lg border border-border px-3 text-xs hover:bg-muted">
              Reset all filters
            </button>
            {upload && (
              <button
                type="button"
                onClick={() => setUpload(null)}
                className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Switch back to bundled IBM Telco data
              </button>
            )}
          </div>
        </Card>

        <ChartCard
          title="Consistency checks"
          description={`${passed} of ${a.validation.length} checks pass for the current filters. They are recalculated with every request.`}
        >
          <ul className="flex flex-col gap-2">
            {a.validation.map((v) => (
              <li key={v.check} className="flex items-start gap-2 text-xs">
                {v.passed ? <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-positive" /> : <XCircle className="mt-0.5 size-3.5 shrink-0 text-negative" />}
                <span>
                  <span className="font-medium">{v.check}</span>
                  <span className="text-muted-foreground"> · {v.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </ChartCard>
      </div>

      <ChartCard
        title="Analytics API"
        description="Every endpoint returns { ok, data, meta }. GET uses the bundled dataset with filters as query parameters; POST accepts JSON { csv, name, filters, query } to analyse an uploaded file."
        footer="Filter parameters: tenureMin, tenureMax, contract, internet, payment, addon, risk, segment. Errors return { ok: false, error } with status 400 for dataset problems."
      >
        <div className="scrollbar-thin -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Method</th>
                <th className="py-2 pr-3 font-medium">Endpoint</th>
                <th className="py-2 font-medium">Returns</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((e) => (
                <tr key={e.path} className="border-b border-border/50 last:border-0">
                  <td className="py-2 pr-3">
                    <Badge tone={e.method === 'GET' ? 'teal' : 'violet'}>{e.method}</Badge>
                  </td>
                  <td className="py-2 pr-3 font-mono text-[11px]">
                    {e.method === 'GET' ? (
                      <a href={e.path} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {e.path}
                      </a>
                    ) : (
                      e.path
                    )}
                  </td>
                  <td className="py-2 text-muted-foreground">{e.returns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <Note>
        A matching Python version of this pipeline (Pandas, NumPy, SciPy, scikit-learn) lives in the project’s <code>python/</code> folder. It
        reproduces these numbers offline, compares logistic regression, decision tree and random forest models, and can serve the same endpoints
        locally. See the README for setup.
      </Note>
    </div>
  )
}
