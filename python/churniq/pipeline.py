"""Public end-to-end report construction."""

from pathlib import Path
import pandas as pd
from .loading import load
from .cleaning import clean
from .preprocessing import derive
from .risk import score_risk
from .model import compare_models
from .eda import describe
from .churn_analysis import analyze, mean
from .segmentation import segments
from .retention_factors import factors
from .revenue import revenue
from .cohorts import cohorts
from .recommendations import recommend


def prepare(source=None) -> tuple[pd.DataFrame, dict, dict, str]:
    raw, name = load(source)
    d, report = clean(raw, name)
    d, t = derive(d)
    d, method = score_risk(d, t)
    return d, report, t, method


def build_analysis(d: pd.DataFrame, report: dict, t: dict, method: str, models: dict) -> dict:
    rev = revenue(d)
    churned = int(d.churn.sum())
    eda = describe(d)
    return dict(
        report={
            **report,
            **{k: eda[k] for k in ["numericSummary", "categoricalSummary", "churnDistribution"]},
        },
        thresholds=t,
        kpis=dict(
            totalCustomers=len(d),
            churnedCustomers=churned,
            activeCustomers=len(d) - churned,
            churnRate=mean(d.churn),
            retentionRate=mean(~d.churn),
            avgTenure=mean(d.tenure),
            avgMonthly=mean(d.monthlyCharges),
            revenueAtRisk=rev["highRiskMRR"],
        ),
        breakdowns=analyze(d),
        segments=segments(d, t),
        revenue=rev,
        cohorts=cohorts(d, t["maxTenure"]),
        behaviour=eda,
        recommendations=recommend(d, t),
        modelPerformance=models,
        risk=dict(method=method, thresholds=dict(high=0.7, medium=0.4)),
        customers=d.to_dict(orient="records"),
        **factors(d)
    )


def run_pipeline(source: str | bytes | Path | None = None) -> dict:
    """Produce a JSON-serialisable report from CSV bytes, text or path."""
    d, report, t, method = prepare(source)
    return build_analysis(d, report, t, method, compare_models(d))
