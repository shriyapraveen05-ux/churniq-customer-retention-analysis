"""Evidence-gated actions; observational evidence is not causal."""

import pandas as pd
from scipy.stats import chi2_contingency
from .churn_analysis import mean


def recommend(d: pd.DataFrame, t: dict) -> list[dict]:
    overall = mean(d.churn)
    definitions = [
        (
            "contract",
            d.contract.eq("Month-to-month"),
            d.contract.ne("Month-to-month"),
            "Offer tiered discounts or bundled add-ons for a 12-month contract upgrade.",
        ),
        (
            "onboarding",
            d.tenure <= 12,
            d.tenure > 12,
            "Launch welcome calls, 30/60/90-day check-ins and proactive usage tips.",
        ),
        (
            "autopay",
            d.paymentMethod.eq("Electronic check"),
            d.paymentMethod.str.contains("automatic"),
            "Offer a small monthly credit and simplify the autopay switch.",
        ),
        (
            "support",
            d.techSupport.eq("No"),
            d.techSupport.eq("Yes"),
            "Pilot a free three-month tech support trial with a randomised control group.",
        ),
        (
            "security",
            d.onlineSecurity.eq("No"),
            d.onlineSecurity.eq("Yes"),
            "Bundle online security and highlight its value at onboarding.",
        ),
        (
            "fiber",
            d.internetService.eq("Fiber optic"),
            d.internetService.eq("DSL"),
            "Investigate network quality and exit surveys; test right-sized pricing.",
        ),
        (
            "pricing",
            (d.monthlyCharges >= t["monthlyP75"]) & d.contract.eq("Month-to-month"),
            ~((d.monthlyCharges >= t["monthlyP75"]) & d.contract.eq("Month-to-month")),
            "Review plan fit and offer loyalty pricing for a contract commitment.",
        ),
        ("senior", d.senior, ~d.senior, "Provide assisted support and simplified plan options."),
        (
            "loyalty",
            d.monthlyCharges >= t["monthlyP75"],
            d.monthlyCharges < t["monthlyP75"],
            "Test tiered loyalty rewards and priority support for high-value accounts.",
        ),
    ]
    rows = []
    for key, mask, comparison, action in definitions:
        a, b = d.loc[mask], d.loc[comparison]
        if len(a) < 30 or not len(b):
            continue
        ra, rb = mean(a.churn), mean(b.churn)
        table = [[int(a.churn.sum()), int((~a.churn).sum())], [int(b.churn.sum()), int((~b.churn).sum())]]
        if any(sum(row[i] for row in table) == 0 for i in range(2)):
            continue
        p = float(chi2_contingency(table, correction=False)[1])
        lift = ra / rb if rb else 9
        if p >= 0.05 or ra <= overall or lift < 1.2:
            continue
        mrr = float(a.loc[~a.churn, "monthlyCharges"].sum())
        share = mrr / d.loc[~d.churn, "monthlyCharges"].sum() if (~d.churn).any() else 0
        rows.append(
            dict(
                id=key,
                finding=f"{key}: churn rate {ra:.2%} vs {rb:.2%} for comparison; overall {overall:.2%}.",
                supporting_data=dict(
                    customers=len(a),
                    churnRate=ra,
                    comparisonRate=rb,
                    overallRate=overall,
                    p=p,
                    lift=lift,
                    activeMRR=mrr,
                ),
                segment=key,
                business_implication="Elevated observed churn exposes active recurring revenue; association is not causation.",
                action=action,
                priority="High" if lift >= 2.5 and share >= 0.3 else "Medium" if lift >= 1.5 else "Low",
            )
        )
    return sorted(
        rows,
        key=lambda r: (
            {"High": 0, "Medium": 1, "Low": 2}[r["priority"]],
            -r["supporting_data"]["activeMRR"] * r["supporting_data"]["lift"],
        ),
    )
