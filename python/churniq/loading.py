"""CSV loading without implicit NA conversion."""

import csv
import io
import os
from pathlib import Path
import pandas as pd
from .validation import DatasetError


def default_path() -> Path:
    if os.getenv("CHURNIQ_DATASET"):
        return Path(os.environ["CHURNIQ_DATASET"])
    bundled = Path(__file__).resolve().parents[2] / "src/data/telco-customer-churn.csv"
    return (
        bundled if bundled.exists() else Path(__file__).resolve().parents[1] / "data/telco-customer-churn.csv"
    )


def load(source: str | bytes | Path | None = None) -> tuple[pd.DataFrame, str]:
    """Read a path, UTF-8 bytes, or CSV text."""
    source = default_path() if source is None else source
    try:
        if isinstance(source, bytes):
            text, name = source.decode("utf-8-sig"), "upload.csv"
        elif isinstance(source, Path) or ("\n" not in str(source) and "," not in str(source)):
            text, name = Path(source).read_text(encoding="utf-8-sig"), Path(source).name
        else:
            text, name = str(source).lstrip("\ufeff"), "inline.csv"
        rows = [r for r in csv.reader(io.StringIO(text), strict=True) if r and r != [""]]
        if len(rows) < 2:
            raise DatasetError("The file contains no data rows.")
        headers = [h.strip() for h in rows[0]]
        if len(headers) < 2:
            raise DatasetError("The file is not a valid CSV dataset.")
        body = [(r + [""] * len(headers))[: len(headers)] for r in rows[1:]]
        return pd.DataFrame(body, columns=headers), name
    except DatasetError:
        raise
    except (OSError, UnicodeError, csv.Error, ValueError) as exc:
        raise DatasetError(f"Unable to read CSV dataset: {exc}") from exc
