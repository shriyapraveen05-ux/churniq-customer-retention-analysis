"""Statistical associations; association is not causation."""

import math
import numpy as np
import pandas as pd
from scipy.stats import chi2_contingency, ttest_ind
from .churn_analysis import DIMENSIONS, breakdown, mean
from .preprocessing import feature_matrix


def factors(d: pd.DataFrame) -> dict:
    x = feature_matrix(d)
    cols = [
        d.churn,
        d.tenure,
        d.monthlyCharges,
        d.totalCharges,
        x.contract_m2m,
        x.contract_2y,
        x.inet_fiber,
        x.pay_echeck,
        d.paperlessBilling,
        x.techsupport,
        x.security,
        d.protectiveAddons,
        d.senior,
        d.partner,
        d.dependents,
    ]
    labels = [
        "Churn",
        "Tenure",
        "Monthly charges",
        "Total charges",
        "Month-to-month",
        "Two-year contract",
        "Fiber optic",
        "Electronic check",
        "Paperless billing",
        "Tech support",
        "Online security",
        "Protective add-ons",
        "Senior citizen",
        "Partner",
        "Dependents",
    ]
    corr = pd.concat(cols, axis=1).astype(float).corr().fillna(0).to_numpy().tolist()
    numeric = []
    for key, label in [
        ("tenure", "Tenure (months)"),
        ("monthlyCharges", "Monthly charges"),
        ("totalCharges", "Total charges"),
        ("protectiveAddons", "Protective add-ons"),
        ("serviceCount", "Subscribed services"),
    ]:
        a, b = d.loc[d.churn, key], d.loc[~d.churn, key]
        t, df, p, effect = 0.0, 0.0, 1.0, 0.0
        if len(a) > 1 and len(b) > 1:
            va, vb = float(a.var()), float(b.var())
            if va / len(a) + vb / len(b) > 0:
                test = ttest_ind(a, b, equal_var=False)
                t, p, df = float(test.statistic), float(test.pvalue), float(test.df)
            pooled = math.sqrt(((len(a) - 1) * va + (len(b) - 1) * vb) / (len(a) + len(b) - 2))
            effect = (mean(a) - mean(b)) / pooled if pooled else 0.0
        numeric.append(
            dict(variable=label, churnedMean=mean(a), retainedMean=mean(b), t=t, df=df, p=p, cohensD=effect)
        )
    categorical = []
    for key, label in DIMENSIONS:
        if key in ["tenureGroup", "chargeBand", "totalBand"]:
            continue
        table = pd.crosstab(d[key], d.churn)
        chi, p, df = 0.0, 1.0, 0
        if table.shape[0] > 1 and table.shape[1] > 1:
            chi, p, df, _ = chi2_contingency(table, correction=False)
        rows = breakdown(d, key)
        categorical.append(
            dict(
                key=key,
                variable=label,
                chi2=float(chi),
                p=float(p),
                df=int(df),
                cramersV=math.sqrt(chi / len(d)) if len(d) else 0,
                highest=rows[0] if rows else None,
                lowest=rows[-1] if rows else None,
            )
        )
    return dict(
        correlation=dict(variables=labels, matrix=corr),
        numericTests=numeric,
        categoricalTests=sorted(categorical, key=lambda r: -r["cramersV"]),
    )
