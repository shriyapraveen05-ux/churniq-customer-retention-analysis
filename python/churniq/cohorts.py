"""Tenure-band comparisons, not true acquisition cohorts."""

import pandas as pd
from .churn_analysis import mean, kaplan_meier


def cohorts(d: pd.DataFrame, max_t: int) -> dict:
    rows = []
    for lo in range(0, max_t + 1, 6):
        hi = min(max_t, lo + 5)
        g = d.loc[d.tenure.between(lo, hi)]
        if len(g):
            rows.append(
                dict(
                    label=f"{lo}–{hi} mo ago",
                    customers=len(g),
                    active=int((~g.churn).sum()),
                    churned=int(g.churn.sum()),
                    churnRate=mean(g.churn),
                    avgMonthly=mean(g.monthlyCharges),
                )
            )
    return dict(
        acquisition=rows,
        survival=kaplan_meier(d, max_t),
        limitation="No acquisition dates or monthly history: these are tenure bands, not acquisition cohorts. Tenure-based survival is descriptive and subject to censoring and sampling limitations.",
        needed_data=["signup date", "monthly status snapshots", "churn date"],
    )
