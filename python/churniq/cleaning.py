"""Deterministic TypeScript-compatible cleaning."""

import math
from datetime import datetime, timezone
import pandas as pd
from .validation import BOOLS, COLUMNS, FIELDS, MISSING, NUMS, DatasetError, normalize, validate


def number(value: str) -> float | None:
    try:
        n = float(value.strip().replace("$", "").replace(",", ""))
        return n if math.isfinite(n) else None
    except ValueError:
        return None


def boolean(value: str) -> bool | None:
    v = value.strip().lower()
    return (
        True
        if v in {"yes", "y", "1", "true", "t"}
        else False if v in {"no", "n", "0", "false", "f"} else None
    )


def clean(raw: pd.DataFrame, name: str) -> tuple[pd.DataFrame, dict]:
    """Keep first rows/IDs, reject invalid core values and impute totals."""
    validate(raw)
    mapping = {
        f: next((h for h in raw.columns if normalize(h) == normalize(c)), None)
        for c, f in zip(COLUMNS, FIELDS)
    }
    missing = [{"column": c, "count": int(raw[c].str.strip().str.lower().isin(MISSING).sum())} for c in raw]
    missing = [m for m in missing if m["count"]]
    seen_rows, seen_ids = set(), set()
    counts = dict(
        duplicateRows=0, duplicateIds=0, invalidRecords=0, imputedZero=0, imputedCalculated=0, unknownFilled=0
    )
    records = []
    for values in raw.itertuples(index=False, name=None):
        row = tuple(v.strip() for v in values)
        if row in seen_rows:
            counts["duplicateRows"] += 1
            continue
        seen_rows.add(row)
        r = dict(zip(raw.columns, row))
        get = lambda f: r.get(mapping[f], "")
        ident = get("id")
        if ident in seen_ids:
            counts["duplicateIds"] += 1
            continue
        seen_ids.add(ident)
        tenure, monthly, churn = number(get("tenure")), number(get("monthlyCharges")), boolean(get("churn"))
        if tenure is None or monthly is None or churn is None or tenure < 0 or monthly < 0:
            counts["invalidRecords"] += 1
            continue
        total = number(get("totalCharges"))
        if total is None:
            total = 0 if tenure == 0 else math.floor(monthly * tenure * 100 + 0.5) / 100
            counts["imputedZero" if tenure == 0 else "imputedCalculated"] += 1
        c = {
            "id": ident,
            "tenure": math.floor(tenure + 0.5),
            "monthlyCharges": monthly,
            "totalCharges": total,
            "churn": churn,
        }
        for f in FIELDS:
            if f in c:
                continue
            v = get(f)
            if f in BOOLS:
                c[f] = boolean(v) or False
            else:
                if v.lower() in MISSING:
                    counts["unknownFilled"] += int(mapping[f] is not None)
                    v = "Unknown"
                c[f] = v
        records.append(c)
    if len(records) < 20:
        raise DatasetError("Fewer than 20 valid customer records remain after cleaning.")
    steps = [
        dict(title=t, detail=d, affected=a)
        for t, d, a in [
            (
                "Load dataset",
                f'Parsed {len(raw):,} records and {len(raw.columns)} attributes from "{name}".',
                len(raw),
            ),
            (
                "Inspect data quality",
                "Missing cells detected before cleaning.",
                sum(m["count"] for m in missing),
            ),
            ("Remove duplicates", "First occurrence kept.", counts["duplicateRows"] + counts["duplicateIds"]),
            ("Convert data types", "Numbers and boolean labels converted; tenure rounded.", len(records)),
            (
                "Treat missing values",
                f"TotalCharges: {counts['imputedZero']} tenure-zero values set to $0; {counts['imputedCalculated']} calculated as monthly × tenure; {counts['invalidRecords']} invalid rows dropped.",
                sum(
                    counts[k] for k in ["imputedZero", "imputedCalculated", "unknownFilled", "invalidRecords"]
                ),
            ),
            ("Prepare churn label", "Yes → 1; No → 0.", len(records)),
            (
                "Engineer features",
                "Tenure groups, charge bands, protective add-ons and subscribed services.",
                len(records),
            ),
        ]
    ]
    report = dict(
        sourceName=name,
        sourceKind="upload" if name in ["upload.csv", "inline.csv"] else "bundled",
        processedAt=datetime.now(timezone.utc).isoformat(),
        rawRecords=len(raw),
        rawAttributes=len(raw.columns),
        finalRecords=len(records),
        missingByColumn=missing,
        missingTotal=sum(m["count"] for m in missing),
        steps=steps,
        warnings=[
            f'Optional column "{c}" is missing; values are set to "Unknown"/No.'
            for c, f in zip(COLUMNS, FIELDS)
            if mapping[f] is None
        ],
        **counts,
    )
    return pd.DataFrame(records), report
