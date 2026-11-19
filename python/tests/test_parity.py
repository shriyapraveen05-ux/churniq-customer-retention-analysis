import json
from pathlib import Path
import pytest


def test_ts_parity(result):
    path = Path(__file__).parent / "fixtures/ts_reference.json"
    if not path.exists():
        pytest.skip("No TypeScript buildAnalysis fixture at tests/fixtures/ts_reference.json")
    ref = json.loads(path.read_text())
    assert result["report"]["finalRecords"] == ref["report"]["finalRecords"]
    for key in [
        "totalCustomers",
        "churnedCustomers",
        "activeCustomers",
        "churnRate",
        "avgTenure",
        "avgMonthly",
    ]:
        assert result["kpis"][key] == pytest.approx(ref["kpis"][key], abs=1e-6, rel=0)
    for key in ["activeMRR", "lostMRR"]:
        assert result["revenue"][key] == pytest.approx(ref["revenue"][key], abs=1e-6, rel=0)
    for key in ["monthlyMedian", "monthlyP75"]:
        assert result["thresholds"][key] == pytest.approx(ref["thresholds"][key], abs=1e-6, rel=0)
    segments = {s["key"]: s for s in result["segments"]}
    for s in ref["segments"]:
        if s["key"] != "high_risk":
            assert segments[s["key"]]["customers"] == s["customers"]
    for key, value in ref["breakdowns"].items():
        rows = {r["label"]: r for r in result["breakdowns"][key]["rows"]}
        for row in value["rows"]:
            assert rows[row["label"]]["churnRate"] == pytest.approx(row["churnRate"], abs=1e-6, rel=0)
    numeric = {r["variable"]: r for r in result["numericTests"]}
    for r in ref["numericTests"]:
        assert numeric[r["variable"]]["t"] == pytest.approx(r["t"], abs=1e-3, rel=0)
