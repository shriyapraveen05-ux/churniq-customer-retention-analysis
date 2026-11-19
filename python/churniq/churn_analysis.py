"""Categorical churn rates and censored tenure survival."""

import pandas as pd
from .preprocessing import TENURE_GROUPS, CHARGE_BANDS, TOTAL_BANDS

DIMENSIONS = [
    ("contract", "Contract type"),
    ("tenureGroup", "Tenure group"),
    ("chargeBand", "Monthly charges"),
    ("totalBand", "Total charges"),
    ("paymentMethod", "Payment method"),
    ("internetService", "Internet service"),
    ("techSupport", "Tech support"),
    ("onlineSecurity", "Online security"),
    ("onlineBackup", "Online backup"),
    ("deviceProtection", "Device protection"),
    ("streamingTV", "Streaming TV"),
    ("streamingMovies", "Streaming movies"),
    ("phoneService", "Phone service"),
    ("multipleLines", "Multiple lines"),
    ("paperlessBilling", "Paperless billing"),
    ("senior", "Senior citizen"),
    ("partner", "Partner"),
    ("dependents", "Dependents"),
    ("gender", "Gender"),
]
ORDERS = dict(
    contract=["Month-to-month", "One year", "Two year"],
    tenureGroup=TENURE_GROUPS,
    chargeBand=CHARGE_BANDS,
    totalBand=TOTAL_BANDS,
)


def mean(s: pd.Series) -> float:
    return float(s.mean()) if len(s) else 0.0


def breakdown(d: pd.DataFrame, key: str) -> list[dict]:
    rows = []
    for label, g in d.groupby(key, sort=False):
        label = ("Yes" if label else "No") if isinstance(label, bool) else str(label)
        ch = int(g.churn.sum())
        rows.append(
            dict(
                label=label,
                customers=len(g),
                churned=ch,
                retained=len(g) - ch,
                churnRate=ch / len(g),
                share=len(g) / len(d),
                avgMonthly=mean(g.monthlyCharges),
                lostMRR=float(g.loc[g.churn, "monthlyCharges"].sum()),
            )
        )
    order = ORDERS.get(key)
    return sorted(
        rows,
        key=lambda r: (order.index(r["label"]) if r["label"] in order else -1) if order else -r["churnRate"],
    )


def analyze(d: pd.DataFrame) -> dict:
    return {key: dict(label=label, rows=breakdown(d, key)) for key, label in DIMENSIONS}


def kaplan_meier(d: pd.DataFrame, max_t: int) -> dict:
    at_risk, survival, curve = len(d), 1.0, []
    duration = d.tenure.clip(upper=max_t)
    for t in range(max_t + 1):
        events = int(((duration == t) & d.churn).sum()) if t else 0
        hazard = events / at_risk if at_risk else 0.0
        survival *= 1 - hazard
        curve.append(dict(month=t, atRisk=at_risk, events=events, hazard=hazard, survival=survival))
        at_risk -= int((duration == t).sum())
    return dict(curve=curve, rmst=sum(p["survival"] for p in curve[:max_t]))
