"""Out-of-fold risk estimates, never in-sample fitted probabilities."""

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from .preprocessing import feature_matrix


def logistic():
    return make_pipeline(
        StandardScaler(), LogisticRegression(class_weight="balanced", max_iter=2000, random_state=42)
    )


def category(scores):
    return np.where(scores >= 0.70, "High", np.where(scores >= 0.40, "Medium", "Low"))


def score_risk(d: pd.DataFrame, thresholds: dict) -> tuple[pd.DataFrame, str]:
    y = d.churn.astype(int)
    fallback = len(d) < 200 or min(int(y.sum()), int((1 - y).sum())) < 30
    if fallback:
        inet = ~d.internetService.isin(["No", "Unknown"])
        scores = (
            30 * d.contract.eq("Month-to-month")
            + np.where(d.tenure <= 6, 25, np.where(d.tenure <= 12, 15, 0))
            + 15 * d.paymentMethod.eq("Electronic check")
            + 10 * d.internetService.eq("Fiber optic")
            + 10 * (inet & d.techSupport.ne("Yes"))
            + 10 * (inet & d.onlineSecurity.ne("Yes"))
            + 10 * d.monthlyCharges.ge(thresholds["monthlyP75"])
            + 5 * d.senior
        ).clip(upper=100).to_numpy() / 100
    else:
        scores = cross_val_predict(
            logistic(),
            feature_matrix(d),
            y,
            cv=StratifiedKFold(5, shuffle=True, random_state=7),
            method="predict_proba",
        )[:, 1]
    result = d.copy()
    result["riskScore"], result["riskCategory"] = scores, category(scores)
    return result, "rule_based" if fallback else "out_of_fold_logistic_regression"
