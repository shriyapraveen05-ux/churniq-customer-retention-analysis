"""Descriptive statistics on cleaned observations."""

import pandas as pd
from .churn_analysis import mean


def describe(d: pd.DataFrame) -> dict:
    numeric = []
    for key, label in [
        ("tenure", "tenure"),
        ("monthlyCharges", "MonthlyCharges"),
        ("totalCharges", "TotalCharges"),
    ]:
        s = d[key]
        numeric.append(
            dict(
                column=label,
                count=len(s),
                mean=mean(s),
                median=float(s.median()) if len(s) else 0,
                std=float(s.std()) if len(s) > 1 else 0,
                min=float(s.min()) if len(s) else 0,
                q1=float(s.quantile(0.25)) if len(s) else 0,
                q3=float(s.quantile(0.75)) if len(s) else 0,
                max=float(s.max()) if len(s) else 0,
            )
        )
    categorical = []
    for key in d.select_dtypes(include=["object", "bool"]).columns:
        if key in ["id", "riskCategory"]:
            continue
        counts = d[key].value_counts(sort=True)
        categorical.append(
            dict(
                column=key,
                unique=len(counts),
                values=[
                    dict(value=("Yes" if v else "No") if isinstance(v, bool) else str(v), count=int(n))
                    for v, n in counts.items()
                ],
            )
        )
    churned = int(d.churn.sum())
    return dict(
        numericSummary=numeric,
        categoricalSummary=categorical,
        churnDistribution=[
            dict(
                label="Retained", count=len(d) - churned, share=(len(d) - churned) / len(d) if len(d) else 0
            ),
            dict(label="Churned", count=churned, share=churned / len(d) if len(d) else 0),
        ],
        comparison=[
            dict(variable=k, churned=mean(d.loc[d.churn, k]), retained=mean(d.loc[~d.churn, k]))
            for k in ["tenure", "monthlyCharges", "totalCharges", "protectiveAddons", "serviceCount"]
        ],
    )
