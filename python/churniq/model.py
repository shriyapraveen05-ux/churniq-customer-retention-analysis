"""Leakage-safe hold-out evaluation and train-only model selection."""

import numpy as np
import pandas as pd
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
)
from .preprocessing import feature_matrix
from .risk import logistic


def compare_models(d: pd.DataFrame) -> dict:
    y = d.churn.astype(int)
    if len(d) < 200 or min(int(y.sum()), int((1 - y).sum())) < 30:
        return dict(
            models=[],
            selected_model=None,
            selection_reason="Insufficient records or class support; rule-based risk used.",
        )
    x = feature_matrix(d)
    xt, xv, yt, yv = train_test_split(x, y, test_size=0.25, stratify=y, random_state=42)
    estimators = [
        ("LogisticRegression", logistic()),
        (
            "DecisionTree",
            DecisionTreeClassifier(
                max_depth=6, min_samples_leaf=20, class_weight="balanced", random_state=42
            ),
        ),
        (
            "RandomForest",
            RandomForestClassifier(
                n_estimators=300, min_samples_leaf=5, random_state=42, class_weight="balanced", n_jobs=-1
            ),
        ),
    ]
    rows, coefficients, importances = [], [], []
    for name, est in estimators:
        cv = cross_val_score(
            est, xt, yt, cv=StratifiedKFold(5, shuffle=True, random_state=42), scoring="roc_auc"
        )
        est.fit(xt, yt)
        pred, prob = est.predict(xv), est.predict_proba(xv)[:, 1]
        rows.append(
            dict(
                name=name,
                accuracy=accuracy_score(yv, pred),
                precision=precision_score(yv, pred, zero_division=0),
                recall=recall_score(yv, pred, zero_division=0),
                f1=f1_score(yv, pred, zero_division=0),
                roc_auc=roc_auc_score(yv, prob),
                confusion_matrix=confusion_matrix(yv, pred, labels=[0, 1]).tolist(),
                cv_auc=float(cv.mean()),
                cv_auc_std=float(cv.std()),
                cv_folds=cv.tolist(),
            )
        )
        if name == "LogisticRegression":
            coefficients = [
                dict(feature=f, coefficient=float(c), odds_ratio=float(np.exp(c)))
                for f, c in zip(x.columns, est[-1].coef_[0])
            ]
        if name == "RandomForest":
            importances = [
                dict(feature=f, importance=float(v)) for f, v in zip(x.columns, est.feature_importances_)
            ]
    best = max(rows, key=lambda r: r["cv_auc"])
    return dict(
        models=rows,
        selected_model=best["name"],
        selection_reason=f"{best['name']} has the highest mean five-fold train CV ROC-AUC ({best['cv_auc']:.6f}); exact ties favor LogisticRegression, then DecisionTree, then RandomForest. Hold-out scores were not used for selection.",
        lr_coefficients=coefficients,
        coefficient_units="Per standard deviation of encoded feature; fitted on training split only.",
        rf_importances=importances,
        split=dict(train=len(yt), test=len(yv), random_state=42),
    )
