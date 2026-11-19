"""Overlapping customer segments, with fixed portfolio thresholds."""

import pandas as pd
from .churn_analysis import mean


def masks(d: pd.DataFrame, t: dict) -> dict:
    return dict(
        new=d.tenure <= 12,
        long_term=d.tenure >= 48,
        high_value=d.monthlyCharges >= t["monthlyP75"],
        month_to_month=d.contract.eq("Month-to-month"),
        price_sensitive=(d.monthlyCharges > t["monthlyMedian"])
        & d.contract.eq("Month-to-month")
        & (d.protectiveAddons <= 1),
        high_risk=(~d.churn) & d.riskCategory.eq("High"),
        recently_churned=d.churn,
    )


def segments(d: pd.DataFrame, t: dict) -> list[dict]:
    rows = []
    for key, mask in masks(d, t).items():
        g = d.loc[mask]
        rate = mean(g.churn)
        rows.append(
            dict(
                key=key,
                customers=len(g),
                share=len(g) / len(d) if len(d) else 0,
                churnRate=rate,
                retentionRate=1 - rate if len(g) else 0,
                avgTenure=mean(g.tenure),
                avgMonthly=mean(g.monthlyCharges),
            )
        )
    return rows
