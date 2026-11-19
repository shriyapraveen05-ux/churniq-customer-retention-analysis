
import { useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { CheckCircle2, Columns3, Copy, Database, FileWarning, Loader2, Rows3, Upload, X } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate } from '@/components/churniq/analysis-gate'
import { Badge, Card, ChartCard, COLORS, KpiCard, Note, PageHeader } from '@/components/churniq/primitives'
import { ChartTooltip } from '@/components/churniq/chart-kit'
import { postJSON, useAnalyticsContext } from '@/components/providers/analytics-provider'
import { num, pct } from '@/lib/format'

export function DataOverviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Data overview"
        title="Dataset inspection & preprocessing"
        description="How the raw customer file was loaded, validated, cleaned and prepared for analysis. Upload your own Telco-format CSV to re-run the entire pipeline."
      />
      <UploadPanel />
      <AnalysisGate>{(a) => <DataOverview a={a} />}</AnalysisGate>
    </div>
  )
}

const MAX_BYTES = 8 * 1024 * 1024

function UploadPanel() {
  const { upload, setUpload } = useAnalyticsContext()
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handle(file: File | undefined) {
    setError(null)
    setStatus(null)
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) return setError('Please choose a .csv file.')
    if (file.size > MAX_BYTES) return setError('File exceeds the 8 MB upload limit.')
    const csv = await file.text()
    const header = csv.split(/\r?\n/, 1)[0]?.toLowerCase() ?? ''
    if (!header.includes('churn') || !header.includes('tenure'))
      return setError('The CSV must include at least “tenure” and “Churn” columns (IBM Telco schema).')
    setBusy(true)
    try {
      // Server-side validation + full processing before the dashboard switches to this dataset.
      const res = await postJSON<{ report: Analysis['report']; model: { method: string; reason: string | null } }>(
        '/api/upload-dataset',
        { csv, name: file.name },
      )
      const r = res.report
      setUpload({ name: file.name, csv, size: file.size })
      setStatus(
        `Validated and processed ${num(r.finalRecords)} of ${num(r.rawRecords)} records (${r.rawAttributes} columns, ${num(r.missingTotal)} missing values, ${num(r.duplicateRows + r.duplicateIds)} duplicates). Risk scores: ${res.model.method === 'logistic_regression' ? 'logistic regression model' : 'rule-based method'}.`,
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The file could not be processed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/12">
            <Database className="size-5 text-primary" />
          </span>
          <div>
            <p className="text-sm font-medium">{upload ? upload.name : 'IBM Telco Customer Churn (WA_Fn-UseC_-Telco-Customer-Churn.csv)'}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {upload
                ? `Uploaded CSV · ${(upload.size / 1024).toFixed(0)} KB · processed server-side for this session only (not stored).`
                : 'Public dataset by IBM, distributed via Kaggle (blastchar/telco-customer-churn), bundled with the app. Upload a Telco-format CSV to re-run every calculation.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {upload && (
            <button
              type="button"
              onClick={() => setUpload(null)}
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-xs hover:bg-muted"
            >
              <X className="size-3.5" /> Use bundled dataset
            </button>
          )}
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setDrag(true)
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              handle(e.dataTransfer.files[0])
            }}
            className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-lg px-3.5 text-xs font-medium transition-colors focus-within:ring-2 focus-within:ring-ring/50 ${
              drag ? 'bg-violet text-primary-foreground' : 'bg-primary text-primary-foreground hover:bg-primary/90'
            }`}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {busy ? 'Validating…' : 'Upload CSV'}
            <input
              ref={inputRef}
              type="file"
              disabled={busy}
              accept=".csv,text/csv"
              className="sr-only"
              onChange={(e) => {
                handle(e.target.files?.[0])
                e.target.value = ''
              }}
            />
          </label>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-negative">
          Upload rejected: {error}
        </p>
      )}
      {status && !error && (
        <p role="status" className="mt-3 flex items-center gap-1.5 text-xs text-positive">
          <CheckCircle2 className="size-3.5" /> {status}
        </p>
      )}
    </Card>
  )
}

function DataOverview({ a }: { a: Analysis }) {
  const r = a.report
  const dist = r.churnDistribution.map((d) => ({ ...d, fill: d.label === 'Yes' || d.label === 'Churned' ? COLORS.coral : COLORS.blue }))
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard label="Total records (raw)" value={num(r.rawRecords)} icon={Rows3} sub={`${num(r.finalRecords)} after cleaning`} />
        <KpiCard label="Attributes" value={num(r.rawAttributes)} icon={Columns3} tone="violet" sub="Columns in source file" />
        <KpiCard label="Missing values" value={num(r.missingTotal)} icon={FileWarning} tone="amber" sub={r.missingByColumn.map((m) => m.column).join(', ') || 'None detected'} />
        <KpiCard label="Duplicate records" value={num(r.duplicateRows + r.duplicateIds)} icon={Copy} tone="teal" sub={`${r.duplicateRows} full-row · ${r.duplicateIds} by ID`} />
      </div>

      {r.warnings.length > 0 && (
        <Note tone="amber">
          {(r.warnings as string[]).map((w) => (
            <p key={w}>{w}</p>
          ))}
        </Note>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard className="lg:col-span-2" title="Preprocessing pipeline" description="Steps executed in order by lib/analytics/pipeline.ts (mirrored in backend/data_processing.py).">
          <ol className="flex flex-col">
            {r.steps.map((s, i) => (
              <li key={s.title} className="flex gap-3 border-b border-border/60 py-3 last:border-0">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[11px] font-semibold text-primary tabular">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{s.title}</p>
                    {s.affected > 0 && <Badge tone="amber">{num(s.affected)} affected</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground text-pretty">{s.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </ChartCard>

        <div className="flex flex-col gap-4">
          <ChartCard title="Churn distribution" description="Class balance of the target label.">
            <div className="h-40">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={dist} dataKey="count" nameKey="label" innerRadius="60%" outerRadius="90%" stroke="none" paddingAngle={2}>
                    {dist.map((d) => (
                      <Cell key={d.label} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip format={(v) => num(v)} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="mt-2 flex flex-col gap-1.5 text-xs">
              {dist.map((d) => (
                <li key={d.label} className="flex justify-between">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className="size-2 rounded-full" style={{ backgroundColor: d.fill }} />
                    Churn = {d.label}
                  </span>
                  <span className="tabular">
                    {num(d.count)} · {pct(d.share)}
                  </span>
                </li>
              ))}
            </ul>
          </ChartCard>
          <ChartCard title="Missing-value treatment">
            {r.missingByColumn.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-positive">
                <CheckCircle2 className="size-4" /> No missing values detected.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {r.missingByColumn.map((m) => (
                  <li key={m.column} className="text-xs">
                    <p className="font-medium">
                      {m.column} <span className="text-muted-foreground">· {m.count} missing</span>
                    </p>
                    <p className="mt-0.5 leading-relaxed text-muted-foreground">{m.treatment}</p>
                  </li>
                ))}
              </ul>
            )}
          </ChartCard>
        </div>
      </div>

      <ChartCard title="Schema & data types" description="Raw type as read from CSV versus the cleaned type used in analysis.">
        <div className="scrollbar-thin -mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 font-medium">Column</th>
                <th className="py-2 pr-3 font-medium">Raw type</th>
                <th className="py-2 pr-3 font-medium">Cleaned type</th>
                <th className="py-2 pr-3 text-right font-medium">Missing</th>
                <th className="py-2 pr-3 text-right font-medium">Unique</th>
                <th className="py-2 font-medium">Example</th>
              </tr>
            </thead>
            <tbody>
              {r.columns.map((c) => (
                <tr key={c.name} className="border-b border-border/50 last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-3 font-mono text-[11px]">{c.name}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{c.rawType}</td>
                  <td className="py-2 pr-3">
                    <Badge tone={c.cleanedType.includes('float') || c.cleanedType.includes('int') ? 'blue' : c.cleanedType.includes('bool') ? 'violet' : 'neutral'}>
                      {c.cleanedType}
                    </Badge>
                  </td>
                  <td className={`py-2 pr-3 text-right tabular ${c.missing ? 'text-warning' : 'text-muted-foreground'}`}>{c.missing}</td>
                  <td className="py-2 pr-3 text-right tabular">{num(c.unique)}</td>
                  <td className="max-w-40 truncate py-2 text-muted-foreground">{c.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Descriptive statistics — numeric features" description="Equivalent to pandas DataFrame.describe() on cleaned data.">
          <div className="scrollbar-thin -mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[520px] text-right text-xs tabular">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  {['Feature', 'count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max'].map((h) => (
                    <th key={h} className={`py-2 pr-2 font-medium ${h === 'Feature' ? 'text-left' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.numericSummary.map((s) => (
                  <tr key={s.column} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-2 text-left font-mono text-[11px]">{s.column}</td>
                    {[s.count, s.mean, s.std, s.min, s.q1, s.median, s.q3, s.max].map((v, i) => (
                      <td key={i} className="py-2 pr-2">
                        {i === 0 ? num(v) : v.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ChartCard>
        <ChartCard title="Categorical features" description="Cardinality and most frequent value per column.">
          <div className="scrollbar-thin max-h-80 overflow-y-auto pr-1">
            <ul className="flex flex-col gap-3">
              {r.categoricalSummary.map((c) => (
                <li key={c.column}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-mono text-[11px]">{c.column}</span>
                    <span className="text-muted-foreground">{c.unique} levels</span>
                  </div>
                  <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                    {c.values.map((v, i) => (
                      <div
                        key={v.value}
                        title={`${v.value}: ${num(v.count)}`}
                        style={{
                          width: `${(v.count / r.finalRecords) * 100}%`,
                          backgroundColor: [COLORS.blue, COLORS.violet, COLORS.teal, COLORS.amber][i % 4],
                        }}
                      />
                    ))}
                  </div>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {c.values.map((v) => `${v.value} ${pct(v.count / r.finalRecords, 0)}`).join(' · ')}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Raw data preview" description="First rows of the source file before cleaning.">
        <div className="scrollbar-thin -mx-5 overflow-x-auto px-5">
          <table className="w-full text-left text-[11px]">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                {Object.keys(r.preview[0] ?? {}).map((h) => (
                  <th key={h} className="whitespace-nowrap py-2 pr-3 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {r.preview.map((row, i) => (
                <tr key={i} className="border-b border-border/50 last:border-0">
                  {Object.values(row).map((v, j) => (
                    <td key={j} className="whitespace-nowrap py-1.5 pr-3 text-foreground/85">
                      {String(v) === '' || String(v) === ' ' ? <span className="text-warning">∅</span> : String(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </>
  )
}
