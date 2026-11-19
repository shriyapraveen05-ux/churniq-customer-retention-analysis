"""Dataset schema and quality validation."""

import re
import pandas as pd


class DatasetError(ValueError):
    """A user-correctable dataset problem."""


REQUIRED = ["customerID", "tenure", "MonthlyCharges", "Contract", "Churn"]
COLUMNS = "customerID gender SeniorCitizen Partner Dependents tenure PhoneService MultipleLines InternetService OnlineSecurity OnlineBackup DeviceProtection TechSupport StreamingTV StreamingMovies Contract PaperlessBilling PaymentMethod MonthlyCharges TotalCharges Churn".split()
FIELDS = "id gender senior partner dependents tenure phoneService multipleLines internetService onlineSecurity onlineBackup deviceProtection techSupport streamingTV streamingMovies contract paperlessBilling paymentMethod monthlyCharges totalCharges churn".split()
BOOLS = "senior partner dependents phoneService paperlessBilling churn".split()
NUMS = ["tenure", "monthlyCharges", "totalCharges"]
MISSING = {"", "na", "n/a", "nan", "null", "none", "?"}


def normalize(value: str) -> str:
    return re.sub("[^a-z0-9]", "", value.lower())


def validate(frame: pd.DataFrame) -> None:
    """Require the same five normalized headers as the web pipeline."""
    for name in REQUIRED:
        if normalize(name) not in [normalize(str(c)) for c in frame.columns]:
            raise DatasetError(
                f'Required column "{name}" was not found. Required columns: {", ".join(REQUIRED)}.'
            )
