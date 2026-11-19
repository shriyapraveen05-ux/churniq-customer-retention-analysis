"""Historical monthly revenue and explicitly labelled risk estimates."""

import pandas as pd
from .churn_analysis import mean


def revenue(d: pd.DataFrame, by_contract: bool = True) -> dict:
    active = d.loc[~d.churn]
    result = dict(
        activeMRR=float(active.monthlyCharges.sum()),
        lostMRR=float(d.loc[d.churn, "monthlyCharges"].sum()),
        highRiskMRR=float(active.loc[active.riskCategory.eq("High"), "monthlyCharges"].sum()),
        expectedLossMRR=float((active.riskScore * active.monthlyCharges).sum()),
        arpu=mean(active.monthlyCharges),
        definitions=dict(
            activeMRR="MonthlyCharges of retained customers.",
            lostMRR="Already lost: MonthlyCharges of churned customers, not a future forecast.",
            highRiskMRR="Estimate: MonthlyCharges of non-churned High-risk customers.",
            expectedLossMRR="Estimate: sum(score × MonthlyCharges) for non-churned customers; balanced-model scores are not calibrated forecasts.",
            arpu="Mean MonthlyCharges of active customers.",
        ),
    )
    result["revenueAtRisk"] = result["highRiskMRR"]
    if by_contract:
        result["byContract"] = [
            dict(contract=str(k), **revenue(g, False)) for k, g in d.groupby("contract", sort=False)
        ]
    return result
