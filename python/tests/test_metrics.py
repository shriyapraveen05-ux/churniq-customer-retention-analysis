import pandas as pd
import pytest
from churniq.risk import category


def test_metrics(result):
    d = pd.DataFrame(result["customers"])
    k = result["kpis"]
    assert k["churnRate"] == pytest.approx(d.churn.sum() / len(d))
    assert k["retentionRate"] == pytest.approx(1 - k["churnRate"])
    rules = {
        "new": d.tenure <= 12,
        "long_term": d.tenure >= 48,
        "high_value": d.monthlyCharges >= 89.85,
        "month_to_month": d.contract.eq("Month-to-month"),
        "price_sensitive": (d.monthlyCharges > 70.35)
        & d.contract.eq("Month-to-month")
        & (d.protectiveAddons <= 1),
        "high_risk": (~d.churn) & d.riskCategory.eq("High"),
        "recently_churned": d.churn,
    }
    for s in result["segments"]:
        assert s["customers"] == int(rules[s["key"]].sum())
    rev = result["revenue"]
    assert rev["highRiskMRR"] == pytest.approx(d.loc[rules["high_risk"], "monthlyCharges"].sum())
    assert rev["lostMRR"] == pytest.approx(d.loc[d.churn, "monthlyCharges"].sum())
    assert rev["activeMRR"] == pytest.approx(316985.75)
    assert rev["lostMRR"] == pytest.approx(139130.85)
    assert category(pd.Series([0, 0.3999, 0.4, 0.6999, 0.7, 1])).tolist() == [
        "Low",
        "Low",
        "Medium",
        "Medium",
        "High",
        "High",
    ]
    assert result["thresholds"]["monthlyMedian"] == pytest.approx(70.35)
    assert result["thresholds"]["monthlyP75"] == pytest.approx(89.85)
