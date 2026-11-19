import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BrainCircuit, Crosshair, Gauge, Scale, Target } from 'lucide-react'
import type { Analysis } from '@/lib/analytics/analysis'
import { AnalysisGate } from '@/components/churniq/analysis-gate'
import { Badge, Card, ChartCard, COLORS, KpiCard, Note, PageHeader, StatRow } from '@/components/churniq/primitives'
import { axisProps, ChartTooltip } from '@/components/churniq/chart-kit'
import { num, pct } from '@/lib/format'

export function ModelPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Churn model"
        title="Model performance & validation"
        description="How the churn probabilities behind the risk scores were produced and how well they hold up on customers the model never saw. The model is trained on the whole loaded dataset and is not affected by dashboard filters."
      />
      <AnalysisGate>{(a) => <Model a={a} />}</AnalysisGate>
    </div>
  )
}

function Model({ a }: { a: Analysis }) {
  const m = a.model
  if (m.method === 'rule_based')
    return (
      <div className="flex flex-col gap-4">
        <Note tone="amber">
          <strong>No machine-learning model was trained for this dataset.</strong> {m.reason} Risk scores on the Risk Assessment page use the
          transparent rule-based method instead, and no performance metrics are shown because none were measured.
        </Note>
      </div>
    )

  const { tp, fp, tn, fn } = m.confusion
  const total = tp + fp + tn + fn
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard label="ROC-AUC (hold-out)" value={m.metrics.rocAuc.toFixed(3)} icon={Gauge} sub={`CV ${m.cv.mean.toFixed(3)} ± ${m.cv.std.toFixed(3)}`} />
        <KpiCard label="Accuracy" value={pct(m.metrics.accuracy)} icon={Target} tone="violet" sub={`Baseline ${pct(m.metrics.baselineAccuracy)}`} />
        <KpiCard label="Precision" value={pct(m.metrics.precision)} icon={Crosshair} tone="amber" sub="Flagged who churned" />
        <KpiCard label="Recall" value={pct(m.metrics.recall)} icon={Scale} tone="coral" sub="Churners caught" />
        <KpiCard label="F1-score" value={m.metrics.f1.toFixed(3)} icon={BrainCircuit} tone="teal" sub={`Threshold ${m.threshold}`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Confusion matrix" description={`Hold-out test set of ${num(m.testSize)} customers at a ${m.threshold} probability threshold.`}>
          <div className="grid grid-cols-[auto_1fr_1fr] gap-1.5 text-xs">
            <span />
            <span className="text-center text-muted-foreground">Predicted churn</span>
            <span className="text-center text-muted-foreground">Predicted stay</span>
            <span className="self-center pr-2 text-muted-foreground">Actually churned</span>
            <Cell label="True positive" v={tp} total={total} tone="good" />
            <Cell label="False negative" v={fn} total={total} tone="bad" />
            <span className="self-center pr-2 text-muted-foreground">Actually stayed</span>
            <Cell label="False positive" v={fp} total={total} tone="bad" />
            <Cell label="True negative" v={tn} total={total} tone="good" />
          </div>
        </ChartCard>

        <ChartCard className="xl:col-span-2" title="ROC curve" description="True-positive rate against false-positive rate across thresholds on the hold-out set. The dashed line is a random classifier.">
          <div className="h-64">
            <ResponsiveContainer>
              <LineChart data={m.roc} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid />
                <XAxis type="number" dataKey="fpr" domain={[0, 1]} {...axisProps} tickFormatter={(v) => pct(v, 0)} />
                <YAxis type="number" domain={[0, 1]} {...axisProps} tickFormatter={(v) => pct(v, 0)} />
                <ReferenceLine segment={[{ x: 0, y: 0 }, { x: 1, y: 1 }]} stroke={COLORS.muted} strokeDasharray="4 4" />
                <Tooltip content={<ChartTooltip format={(v) => pct(v)} labelFormat={(l) => `FPR ${pct(Number(l))}`} />} />
                <Line dataKey="tpr" name="True-positive rate" stroke={COLORS.blue} strokeWidth={2} dot={false} type="stepAfter" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-2 text-sm font-semibold">Method</h3>
          <div className="divide-y divide-border">
            <StatRow label="Algorithm" value="Logistic regression (L2, λ = 0.01)" />
            <StatRow label="Class imbalance" value="Balanced class weights" />
            <StatRow label="Features" value={`${m.featureCount} (one-hot encoded, standardised)`} />
            <StatRow label="Excluded from features" value="customerID, Churn" />
            <StatRow label="Train / test split" value={`${num(m.trainSize)} / ${num(m.testSize)} (stratified 75/25, seed 42)`} />
            <StatRow label="Churn share in training data" value={pct(m.positiveRateTrain)} />
            <StatRow label="Cross-validation" value={`${m.cv.folds}-fold stratified, AUC ${m.cv.mean.toFixed(3)} ± ${m.cv.std.toFixed(3)}`} />
          </div>
        </Card>
        <Card className="flex flex-col gap-3 p-5 text-xs leading-relaxed text-foreground/85">
          <h3 className="text-sm font-semibold text-foreground">Why this model</h3>
          <p>
            Logistic regression was chosen because it is well-calibrated for probabilities, its coefficients can be explained to business users, and in
            the offline Python comparison (logistic regression, decision tree, random forest) it achieved the best cross-validated ROC-AUC on this
            dataset.
          </p>
          <p>
            <strong className="text-foreground">How risk scores avoid leakage:</strong> every customer is scored by a model from the cross-validation fold
            that did <em>not</em> contain that customer, so nobody is scored by a model that saw their outcome.
          </p>
          <p>
            <strong className="text-foreground">Reading the metrics:</strong> balanced class weights favour recall — the model catches{' '}
            {pct(m.metrics.recall)} of churners at the cost of more false alarms (precision {pct(m.metrics.precision)}). Accuracy alone is misleading
            here because always predicting “stay” already scores {pct(m.metrics.baselineAccuracy)}.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge tone="blue">Computed live from the dataset</Badge>
            <Badge tone="neutral">Fold AUCs: {m.cv.aucs.map((v) => v.toFixed(3)).join(' · ')}</Badge>
          </div>
        </Card>
      </div>
    </div>
  )
}

function Cell({ label, v, total, tone }: { label: string; v: number; total: number; tone: 'good' | 'bad' }) {
  return (
    <div
      className={
        tone === 'good'
          ? 'rounded-lg border border-positive/25 bg-positive/10 p-3 text-center'
          : 'rounded-lg border border-negative/25 bg-negative/10 p-3 text-center'
      }
    >
      <p className="text-lg font-semibold tabular">{num(v)}</p>
      <p className="text-[11px] text-muted-foreground">
        {label} · {pct(total ? v / total : 0)}
      </p>
    </div>
  )
}
