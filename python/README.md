# CHURNIQ — Python analytics twin

An offline, reproducible version of the CHURNIQ pipeline written with **Pandas, NumPy, SciPy and scikit-learn**. It reproduces the web app's deterministic numbers (cleaning, counts, churn rates, segments, revenue, statistical tests) and adds a scikit-learn comparison of logistic regression, decision tree and random forest models.

## Modules (`churniq/`)
| Module | Purpose |
|---|---|
| `loading.py` | Read a CSV path, bytes or text; clear errors for empty/unreadable files |
| `validation.py` | Required columns, record/column counts, duplicates (`DatasetError`) |
| `cleaning.py` | Type conversion, `TotalCharges` handling, cleaning log |
| `preprocessing.py` | Derived features, thresholds, model feature matrix (no ID/target leakage) |
| `eda.py` | Descriptive statistics and distributions |
| `churn_analysis.py` | Category churn rates, Kaplan–Meier survival |
| `segmentation.py` | Rule-based segments and their metrics |
| `retention_factors.py` | Correlation, chi-square, Welch t-tests |
| `risk.py` | Out-of-fold logistic-regression risk scores, rule-based fallback |
| `model.py` | Model comparison, metrics, selection reason |
| `revenue.py` | Revenue metrics with definitions |
| `cohorts.py` | Tenure bands with the dataset limitation stated |
| `recommendations.py` | Conditional recommendations |
| `pipeline.py` | `run_pipeline(source)` — one JSON-serialisable result |
| `api.py` | FastAPI app serving the same `/api/*` endpoints |

## Setup
```sh
cd python
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
```
The dataset defaults to `../src/data/telco-customer-churn.csv`; override with `CHURNIQ_DATASET=/path/to/file.csv`.

## Run
```sh
python -m churniq report --out report.json          # full analysis to JSON
python -m churniq report --csv my.csv --out my.json # any Telco-format CSV
uvicorn churniq.api:app --port 8000                 # local API, e.g. GET /api/overview
```

## Tests
```sh
pytest -q
```
`tests/test_parity.py` compares results with `tests/fixtures/ts_reference.json`, the TypeScript app's output for the same data (regenerate it from the project root with `bun scripts/export-ts-reference.ts`). Risk-dependent values are excluded from parity because the two implementations train their logistic regressions with different optimisers.
