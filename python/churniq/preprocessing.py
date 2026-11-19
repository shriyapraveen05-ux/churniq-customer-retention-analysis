"""Derived categories and the reference model feature matrix."""

import numpy as np
import pandas as pd

TENURE_GROUPS = ["0–6 mo", "7–12 mo", "13–24 mo", "25–36 mo", "37–48 mo", "49–60 mo", "61–72 mo"]
CHARGE_BANDS = ["< $35", "$35–55", "$55–75", "$75–95", "≥ $95"]
TOTAL_BANDS = ["< $500", "$500–2k", "$2k–4k", "$4k–6k", "≥ $6k"]


def derive(frame: pd.DataFrame) -> tuple[pd.DataFrame, dict]:
    d = frame.copy()
    d["tenureGroup"] = np.array(TENURE_GROUPS)[
        np.searchsorted([6, 12, 24, 36, 48, 60], d.tenure, side="left")
    ]
    d["chargeBand"] = np.array(CHARGE_BANDS)[
        np.searchsorted([35, 55, 75, 95], d.monthlyCharges, side="right")
    ]
    d["totalBand"] = np.array(TOTAL_BANDS)[
        np.searchsorted([500, 2000, 4000, 6000], d.totalCharges, side="right")
    ]
    d["protectiveAddons"] = (
        d[["onlineSecurity", "onlineBackup", "deviceProtection", "techSupport"]].eq("Yes").sum(axis=1)
    )
    d["serviceCount"] = (
        d.phoneService.astype(int)
        + (~d.internetService.isin(["No", "Unknown"])).astype(int)
        + d.protectiveAddons
        + d[["streamingTV", "streamingMovies", "multipleLines"]].eq("Yes").sum(axis=1)
    )
    return d, dict(
        monthlyMedian=float(d.monthlyCharges.quantile(0.5)),
        monthlyP75=float(d.monthlyCharges.quantile(0.75)),
        maxTenure=int(d.tenure.max()),
    )


def feature_matrix(d: pd.DataFrame) -> pd.DataFrame:
    """Encode the 26 actual FEATURES entries in model.ts (not 27)."""
    x = dict(
        tenure=d.tenure,
        monthly=d.monthlyCharges,
        total_log=np.log1p(d.totalCharges.clip(lower=-0.999999)),
        senior=d.senior,
        partner=d.partner,
        dependents=d.dependents,
        male=d.gender.eq("Male"),
        phone=d.phoneService,
        multi_lines=d.multipleLines.eq("Yes"),
        paperless=d.paperlessBilling,
    )
    for key, col, val in [
        ("inet_dsl", "internetService", "DSL"),
        ("inet_fiber", "internetService", "Fiber optic"),
        ("inet_none", "internetService", "No"),
        ("security", "onlineSecurity", "Yes"),
        ("backup", "onlineBackup", "Yes"),
        ("protection", "deviceProtection", "Yes"),
        ("techsupport", "techSupport", "Yes"),
        ("stream_tv", "streamingTV", "Yes"),
        ("stream_movies", "streamingMovies", "Yes"),
        ("contract_m2m", "contract", "Month-to-month"),
        ("contract_1y", "contract", "One year"),
        ("contract_2y", "contract", "Two year"),
        ("pay_echeck", "paymentMethod", "Electronic check"),
        ("pay_mail", "paymentMethod", "Mailed check"),
        ("pay_bank", "paymentMethod", "Bank transfer (automatic)"),
        ("pay_card", "paymentMethod", "Credit card (automatic)"),
    ]:
        x[key] = d[col].eq(val)
    return pd.DataFrame(x, index=d.index).astype(float)
