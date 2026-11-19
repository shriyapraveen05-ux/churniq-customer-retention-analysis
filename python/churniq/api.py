"""Local analytics API; uploads replace the in-memory dataset atomically."""

from threading import RLock
import pandas as pd
from fastapi import FastAPI, Request, UploadFile, File
from fastapi.responses import JSONResponse
from .validation import DatasetError
from .pipeline import run_pipeline, build_analysis
from .segmentation import masks

app = FastAPI(title="CHURNIQ offline analytics")
_lock = RLock()
_state: dict | None = None


@app.exception_handler(DatasetError)
async def dataset_error(request: Request, exc: DatasetError):
    return JSONResponse(status_code=400, content={"ok": False, "error": str(exc)})


def state() -> dict:
    global _state
    with _lock:
        if _state is None:
            _state = run_pipeline()
        return _state


def envelope(data, base: dict) -> dict:
    r = base["report"]
    return dict(
        ok=True,
        data=data,
        meta=dict(dataset=r["sourceName"], records=r["finalRecords"], processed_at=r["processedAt"]),
    )


def filtered(request: Request, base: dict) -> dict:
    p = request.query_params
    names = ["tenure_min", "tenure_max", "contract", "internet", "payment", "segment", "risk"]
    if not any(n in p and p[n] != "all" for n in names):
        return base
    d = pd.DataFrame(base["customers"])
    mask = pd.Series(True, index=d.index)
    for param, col in [
        ("contract", "contract"),
        ("internet", "internetService"),
        ("payment", "paymentMethod"),
        ("risk", "riskCategory"),
    ]:
        if p.get(param, "all") != "all":
            mask &= d[col].eq(p[param])
    try:
        mask &= d.tenure.between(float(p.get("tenure_min", 0)), float(p.get("tenure_max", 1000)))
    except ValueError as exc:
        raise DatasetError("Tenure bounds must be numeric.") from exc
    if p.get("segment", "all") != "all":
        if p["segment"] not in masks(d, base["thresholds"]):
            raise DatasetError("Unknown segment filter.")
        mask &= masks(d, base["thresholds"])[p["segment"]]
    return build_analysis(
        d.loc[mask], base["report"], base["thresholds"], base["risk"]["method"], base["modelPerformance"]
    )


ENDPOINTS = {
    "overview": "kpis",
    "dataset-info": "report",
    "churn-analysis": "breakdowns",
    "customer-behaviour": "behaviour",
    "segments": "segments",
    "retention-factors": None,
    "customer-risk": "customers",
    "cohort-analysis": "cohorts",
    "revenue-impact": "revenue",
    "recommendations": "recommendations",
    "model-performance": "modelPerformance",
}


def handler(endpoint: str, key: str | None):
    async def get(request: Request):
        base = state()
        a = filtered(request, base)
        data = a[key] if key else {k: a[k] for k in ["correlation", "numericTests", "categoricalTests"]}
        if endpoint == "customer-risk":
            data = [c for c in data if not c["churn"]]
            p = request.query_params
            q = p.get("q", "").lower()
            data = [c for c in data if q in c["id"].lower()]
            sort = p.get("sort", "riskScore")
            aliases = {
                "score": "riskScore",
                "risk": "riskScore",
                "monthly": "monthlyCharges",
                "customerID": "id",
            }
            sort = aliases.get(sort, sort)
            if sort not in ["riskScore", "monthlyCharges", "tenure", "id", "riskCategory"]:
                raise DatasetError("Unsupported risk sort field.")
            data = sorted(data, key=lambda c: c[sort], reverse=p.get("dir", "desc") == "desc")
            try:
                page = max(1, int(p.get("page", 1)))
                size = min(1000, max(1, int(p.get("page_size", 25))))
            except ValueError as exc:
                raise DatasetError("Page and page_size must be integers.") from exc
            data = dict(
                rows=data[(page - 1) * size : page * size],
                total=len(data),
                page=page,
                page_size=size,
                method=a["risk"]["method"],
            )
        return envelope(data, base)

    return get


for endpoint, key in ENDPOINTS.items():
    app.add_api_route("/api/" + endpoint, handler(endpoint, key), methods=["GET"])


@app.post("/api/upload-dataset")
async def upload_dataset(file: UploadFile = File(...)):
    global _state
    report = run_pipeline(await file.read())
    report["report"]["sourceName"] = file.filename or "upload.csv"
    with _lock:
        _state = report
    return envelope(report["report"], report)
